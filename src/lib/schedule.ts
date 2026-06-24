// Niger timezone helpers (Africa/Niamey, UTC+1 fixe, pas de DST).
// Tous les calculs sont faits dans le fuseau Niger en convertissant
// l'instant courant via toLocaleString. Pas de dépendance externe.

const NIGER_TZ = "Africa/Niamey";

const DRAW_NAMES = [
  "BALSA",       // dimanche
  "MAMAKI",      // lundi
  "SOUDJI",      // mardi
  "ARZIKI",      // mercredi
  "GOMNI",       // jeudi
  "IRMA SABOU",  // vendredi
  "FARAHA",      // samedi
] as const;

export function nigerParts(d: Date = new Date()) {
  // Convertit l'instant en composants horaires Niger.
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: NIGER_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
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
export function nigerInstant(year: number, month: number, day: number, hour: number, minute = 0): Date {
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

/** Date du jour Niger formatée JJ/MM/AAAA. */
export function nigerDateLabel(d: Date = new Date()): string {
  const p = nigerParts(d);
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${p.year}`;
}

export type DrawStage = "openAt" | "closesIn" | "drawIn";
export interface NextEvent { stage: DrawStage; target: Date; }

/** Prochain jalon (ouverture / clôture / tirage) pour un jeu à 3 horaires quotidiens, sur fuseau Niger. */
export function nextDailyEvent(openHour: number, closeHour: number, drawHour: number, now: Date = new Date()): NextEvent {
  const p = nigerParts(now);
  const open = nigerInstant(p.year, p.month, p.day, openHour);
  const close = nigerInstant(p.year, p.month, p.day, closeHour);
  const draw = nigerInstant(p.year, p.month, p.day, drawHour);
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

/** Détecte l'opérateur Mobile Money depuis un numéro nigérien. */
export function detectOperator(phone: string): { id: string; name: string; color: string } {
  const clean = phone.replace(/\D/g, "").replace(/^227/, "");
  const first = clean.charAt(0);
  // Préfixes simulés calés sur l'écosystème Niger.
  if (["9"].includes(first)) return { id: "airtel", name: "Airtel Money", color: "#E40000" };
  if (["8"].includes(first)) return { id: "moov", name: "Moov Money", color: "#005EB8" };
  if (["7"].includes(first)) return { id: "zamani", name: "Zamani Cash", color: "#1A6B5E" };
  if (["6"].includes(first)) return { id: "nita", name: "Nita", color: "#FFB300" };
  if (["5"].includes(first)) return { id: "amanata", name: "Amanata", color: "#0F766E" };
  if (["4"].includes(first)) return { id: "mynita", name: "MyNita", color: "#7C3AED" };
  return { id: "airtel", name: "Airtel Money", color: "#E40000" };
}

/** Nom mock d'un titulaire de compte selon le numéro (déterministe). */
export function mockAccountHolder(phone: string): string {
  const noms = ["M. Souley", "Mme Aïcha", "M. Oumarou", "Mme Hadiza", "M. Boubacar", "Mme Mariama", "M. Hassane", "Mme Fatima"];
  const sum = phone.replace(/\D/g, "").split("").reduce((a, c) => a + Number(c), 0);
  return noms[sum % noms.length];
}
