// Niger timezone helpers (Africa/Niamey, UTC+1 fixe, pas de DST).
// Tous les calculs sont faits dans le fuseau Niger en convertissant
// l'instant courant via toLocaleString. Pas de dépendance externe.

export const NIGER_TIME_ZONE = "Africa/Niamey";
export type DailyGameSchedule = { day: number; open_hour: number; open_minute?: number; close_hour: number; close_minute?: number; draw_hour: number; draw_minute: number };
export type WeeklyGameSchedule = DailyGameSchedule[];

const DRAW_NAMES = [
  "BALSA", // dimanche
  "MAMAKI", // lundi
  "SOUDJI", // mardi
  "ARZIKI", // mercredi
  "GOMNI", // jeudi
  "IRMA SABOU", // vendredi
  "FARAHA", // samedi
] as const;

export function nigerParts(d: Date = new Date()) {
  // Convertit l'instant en composants horaires Niger.
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: NIGER_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday,
  };
}

/** Construit l'instant UTC correspondant à une date locale Niger (UTC+1, sans DST). */
export function nigerInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  // Niger = UTC+1 → l'UTC = local - 1h
  return new Date(Date.UTC(year, month - 1, day, hour - 1, minute, 0));
}

/** Renvoie l'index 0–6 du jour de la semaine Niger (0 = dimanche). */
export function nigerDayOfWeek(d: Date = new Date()): number {
  const p = nigerParts(d);
  // construit une date locale UTC à 12:00 pour pouvoir lire getUTCDay
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 12)).getUTCDay();
}

/** Nom du tirage Loto Balsa pour la date donnée (Niger TZ). */
export function drawNameForDate(d: Date = new Date()): string {
  return `Tirage ${DRAW_NAMES[nigerDayOfWeek(d)]}`;
}

/** Clé de date civile au Niger (AAAA-MM-JJ), indépendante du fuseau du navigateur. */
export function nigerDateIso(d: Date = new Date()): string {
  const p = nigerParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Clé de mois civil au Niger (AAAA-MM), indépendante du fuseau du navigateur. */
export function nigerMonthKey(d: Date = new Date()): string {
  const p = nigerParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/** Date du jour Niger formatée JJ/MM/AAAA. */
export function nigerDateLabel(d: Date = new Date()): string {
  const p = nigerParts(d);
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${p.year}`;
}

export type DrawStage = "openAt" | "closesIn" | "drawIn";
export interface NextEvent {
  stage: DrawStage;
  target: Date;
}

/** Prochain jalon (ouverture / clôture / tirage) pour un jeu à 3 horaires quotidiens, sur fuseau Niger.
 *  Supporte le cycle traversant minuit (ex : ouverture 16h, fermeture 15h le
 *  lendemain, tirage peu après la fermeture). Dans ce cas, l'ordre chronologique
 *  des jalons dans une même journée Niger est : fermeture → tirage → ouverture. */
export function nextDailyEvent(
  openHour: number,
  closeHour: number,
  drawHour: number,
  now: Date = new Date(),
  drawMinute = 0,
): NextEvent {
  const p = nigerParts(now);
  const open = nigerInstant(p.year, p.month, p.day, openHour);
  const close = nigerInstant(p.year, p.month, p.day, closeHour);
  const draw = nigerInstant(p.year, p.month, p.day, drawHour, drawMinute);

  if (openHour > closeHour) {
    // Cycle traversant minuit : fermeture → tirage → ouverture, dans cet ordre.
    if (now < close) return { stage: "closesIn", target: close };
    if (now < draw) return { stage: "drawIn", target: draw };
    if (now < open) return { stage: "openAt", target: open };
    // Session en cours depuis 'open' aujourd'hui : ferme demain à closeHour.
    return { stage: "closesIn", target: new Date(close.getTime() + 24 * 3600 * 1000) };
  }

  if (now < open) return { stage: "openAt", target: open };
  if (now < close) return { stage: "closesIn", target: close };
  if (now < draw) return { stage: "drawIn", target: draw };
  // demain
  const tomorrow = new Date(open.getTime() + 24 * 3600 * 1000);
  return { stage: "openAt", target: tomorrow };
}

export function diffParts(target: Date, now: Date = new Date()) {
  const diff = Math.max(0, target.getTime() - now.getTime());
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff / 3_600_000) % 24),
    m: Math.floor((diff / 60_000) % 60),
    s: Math.floor((diff / 1000) % 60),
    totalMs: diff,
  };
}

/** V1 : Airtel Money est le seul moyen de paiement supporté par le backend. */
export function detectOperator(_phone: string): { id: string; name: string; color: string } {
  return { id: "airtel", name: "Airtel Money", color: "#E40000" };
}

/** Indique si un jeu est ouvert à la prise de paris à l'instant t (Niger TZ).
 *  Gère le cas d'un cycle traversant minuit (ex : ouverture 16h, fermeture
 *  15h le lendemain) — le jeu n'est alors fermé que sur la courte fenêtre
 *  quotidienne [closeHour, openHour). */
export function isGameOpen(openHour: number, closeHour: number, now: Date = new Date()): boolean {
  const p = nigerParts(now);
  const open = nigerInstant(p.year, p.month, p.day, openHour);
  const close = nigerInstant(p.year, p.month, p.day, closeHour);
  if (openHour < closeHour) return now >= open && now < close;
  if (openHour > closeHour) return !(now >= close && now < open);
  return true; // openHour === closeHour : ouvert en continu (ex. Pari Foot)
}

/** Renvoie l'instant de réouverture (lendemain à openHour) si actuellement fermé. */
export function nextOpenInstant(openHour: number, now: Date = new Date()): Date {
  const p = nigerParts(now);
  const todayOpen = nigerInstant(p.year, p.month, p.day, openHour);
  if (now < todayOpen) return todayOpen;
  return new Date(todayOpen.getTime() + 24 * 3600 * 1000);
}

export function scheduleForNigerDay(schedules: WeeklyGameSchedule | null | undefined, now: Date = new Date()): DailyGameSchedule | null {
  return Array.isArray(schedules) ? schedules.find((x) => x.day === nigerDayOfWeek(now)) ?? null : null;
}
export function isWeeklyGameOpen(schedules: WeeklyGameSchedule | null | undefined, now: Date = new Date()): boolean {
  if (!Array.isArray(schedules) || schedules.length !== 7) return false;
  const day = nigerDayOfWeek(now);
  const parts = nigerParts(now);
  const currentMinute = parts.hour * 60 + parts.minute;
  const today = schedules.find((item) => item.day === day);
  const yesterday = schedules.find((item) => item.day === (day + 6) % 7);
  const openMinute = (item: DailyGameSchedule) => item.open_hour * 60 + (item.open_minute ?? 0);
  const closeMinute = (item: DailyGameSchedule) => item.close_hour * 60 + (item.close_minute ?? 0);
  if (yesterday && openMinute(yesterday) > closeMinute(yesterday) && currentMinute < closeMinute(yesterday)) return true;
  if (!today) return false;
  const opening = openMinute(today);
  const closing = closeMinute(today);
  if (opening === closing) return true;
  return opening > closing
    ? currentMinute >= opening || currentMinute < closing
    : currentMinute >= opening && currentMinute < closing;
}

export function nextWeeklyEvent(schedules: WeeklyGameSchedule, now: Date = new Date()): NextEvent {
  const p=nigerParts(now), base=Date.UTC(p.year,p.month-1,p.day,12), events:NextEvent[]=[];
  for(let offset=-1;offset<=8;offset++){const d=new Date(base+offset*86400000),item=schedules.find(x=>x.day===d.getUTCDay());if(!item)continue;const y=d.getUTCFullYear(),m=d.getUTCMonth()+1,day=d.getUTCDate();events.push({stage:"openAt",target:nigerInstant(y,m,day,item.open_hour,item.open_minute ?? 0)},{stage:"closesIn",target:nigerInstant(y,m,day,item.close_hour,item.close_minute ?? 0)},{stage:"drawIn",target:nigerInstant(y,m,day,item.draw_hour,item.draw_minute)});}
  return events.filter(x=>x.target>now).sort((a,b)=>a.target.getTime()-b.target.getTime())[0]??{stage:"openAt",target:new Date(now.getTime()+86400000)};
}
