import { regions } from "./mock-data";
import { seedRandom } from "./utils";

export interface SimTicket {
  id: string;
  gameId: "pmu" | "loto" | "foot";
  region: string;
  player: string;
  stake: number;
  status: "pending" | "winning" | "paid" | "losing";
  prize: number;
  picks: number[]; // for loto only
  daysAgo: number;
  iso: string;
}

const firstNames = ["Aïssa", "Moussa", "Hadiza", "Ibrahim", "Fatouma", "Souley", "Mariama", "Abdoul", "Salamatou", "Hama", "Zeinabou", "Karim", "Rakia", "Ousmane", "Bintou", "Issoufou"];
const lastNames = ["Issa", "Maïga", "Garba", "Souley", "Abdou", "Hassane", "Mamoudou", "Ali", "Boubacar", "Yacouba", "Sani", "Idrissa"];

/** Génère un dataset déterministe de N tickets sur 14 jours pour alimenter l'admin. */
export function generateSimTickets(n = 240): SimTicket[] {
  const rnd = seedRandom(0x1e7a1);
  const out: SimTicket[] = [];
  const games = ["pmu", "loto", "foot"] as const;
  // Distribution régionale : Niamey/Maradi/Zinder dominent
  const regWeights = [3.5, 2.8, 2.4, 1.6, 1.0, 1.2, 0.9, 0.6];
  const totalW = regWeights.reduce((a, b) => a + b, 0);
  const pickReg = () => {
    const r = rnd() * totalW;
    let acc = 0;
    for (let i = 0; i < regions.length; i++) { acc += regWeights[i]; if (r <= acc) return regions[i]; }
    return regions[0];
  };

  for (let i = 0; i < n; i++) {
    const game = games[Math.floor(rnd() * games.length)];
    const region = pickReg();
    const stake = [100, 200, 500, 1000, 2000, 5000][Math.floor(rnd() * 6)];
    const daysAgo = Math.floor(rnd() * 14);
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const rWin = rnd();
    const status: SimTicket["status"] =
      daysAgo === 0 ? (rWin < 0.05 ? "winning" : rWin < 0.12 ? "paid" : rWin < 0.5 ? "pending" : "losing")
      : (rWin < 0.08 ? "paid" : rWin < 0.12 ? "winning" : "losing");
    const prize = (status === "paid" || status === "winning") ? stake * (10 + Math.floor(rnd() * 60)) : 0;

    // For loto: pick 1–5 balls; weighted towards hot numbers
    const picks: number[] = [];
    if (game === "loto") {
      const mode = 1 + Math.floor(rnd() * 5);
      const hot = [7, 19, 34, 56, 72, 88, 12, 27, 45];
      while (picks.length < mode) {
        const useHot = rnd() < 0.45;
        const n2 = useHot ? hot[Math.floor(rnd() * hot.length)] : 1 + Math.floor(rnd() * 90);
        if (!picks.includes(n2)) picks.push(n2);
      }
    }

    const fn = firstNames[Math.floor(rnd() * firstNames.length)];
    const ln = lastNames[Math.floor(rnd() * lastNames.length)];
    out.push({
      id: `SIM-${String(i + 1).padStart(4, "0")}`,
      gameId: game,
      region,
      player: `${fn} ${ln}`,
      stake,
      status,
      prize,
      picks,
      daysAgo,
      iso: d.toISOString().slice(0, 10),
    });
  }
  return out;
}

export interface BallStat {
  ball: number;
  total: number;
  solo: number;
  combo: number;
  topPairs: { ball: number; count: number }[];
}

export function computeBallStats(tickets: SimTicket[]): BallStat[] {
  const stats: Record<number, { total: number; solo: number; combo: number; pairs: Record<number, number> }> = {};
  for (let i = 1; i <= 90; i++) stats[i] = { total: 0, solo: 0, combo: 0, pairs: {} };
  for (const t of tickets) {
    if (t.gameId !== "loto" || t.picks.length === 0) continue;
    const solo = t.picks.length === 1;
    for (const b of t.picks) {
      stats[b].total += 1;
      if (solo) stats[b].solo += 1; else stats[b].combo += 1;
      for (const o of t.picks) {
        if (o !== b) stats[b].pairs[o] = (stats[b].pairs[o] || 0) + 1;
      }
    }
  }
  return Object.entries(stats).map(([b, s]) => ({
    ball: Number(b),
    total: s.total,
    solo: s.solo,
    combo: s.combo,
    topPairs: Object.entries(s.pairs)
      .map(([k, v]) => ({ ball: Number(k), count: v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  }));
}

export interface RegionStat {
  region: string;
  staked: number;
  paid: number;
  tickets: number;
  players: number;
  delta7d: number;
}

export function computeRegionStats(tickets: SimTicket[]): RegionStat[] {
  const out: Record<string, RegionStat> = {};
  for (const r of regions) out[r] = { region: r, staked: 0, paid: 0, tickets: 0, players: 0, delta7d: 0 };
  const playersByRegion: Record<string, Set<string>> = {};
  for (const r of regions) playersByRegion[r] = new Set();
  let last7 = 0, prev7 = 0;
  const last7byR: Record<string, number> = {};
  const prev7byR: Record<string, number> = {};
  for (const r of regions) { last7byR[r] = 0; prev7byR[r] = 0; }
  for (const t of tickets) {
    out[t.region].staked += t.stake;
    out[t.region].paid += t.prize;
    out[t.region].tickets += 1;
    playersByRegion[t.region].add(t.player);
    if (t.daysAgo < 7) { last7 += t.stake; last7byR[t.region] += t.stake; }
    else { prev7 += t.stake; prev7byR[t.region] += t.stake; }
  }
  void last7; void prev7;
  for (const r of regions) {
    out[r].players = playersByRegion[r].size;
    const p = prev7byR[r] || 1;
    out[r].delta7d = Math.round(((last7byR[r] - prev7byR[r]) / p) * 100);
  }
  return Object.values(out).sort((a, b) => b.staked - a.staked);
}

export function computePlayerStats(tickets: SimTicket[]) {
  const m: Record<string, { player: string; region: string; tickets: number; staked: number; won: number }> = {};
  for (const t of tickets) {
    const k = `${t.player}|${t.region}`;
    if (!m[k]) m[k] = { player: t.player, region: t.region, tickets: 0, staked: 0, won: 0 };
    m[k].tickets += 1;
    m[k].staked += t.stake;
    m[k].won += t.prize;
  }
  return Object.values(m).sort((a, b) => b.staked - a.staked);
}