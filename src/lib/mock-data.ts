export type GameId = "pmu" | "loto" | "foot";

export interface Horse { number: number; name: string; jockey: string }
export interface FootMatch { id: string; home: string; away: string; date: string; odds: { "1": number; "X": number; "2": number } }
export interface DrawResult { id: string; gameId: GameId; date: string; numbers?: number[]; horses?: number[]; matches?: { matchId: string; result: "1" | "X" | "2" }[] }

export const horses: Horse[] = [
  { number: 1, name: "Sahara Wind", jockey: "M. Ousmane" },
  { number: 2, name: "Niamey Star", jockey: "A. Idrissa" },
  { number: 3, name: "Tahoua Flash", jockey: "B. Saidou" },
  { number: 4, name: "Zinder King", jockey: "M. Abdou" },
  { number: 5, name: "Agadez Pride", jockey: "S. Issa" },
  { number: 6, name: "Maradi Lightning", jockey: "H. Moussa" },
  { number: 7, name: "Niger Gold", jockey: "T. Ali" },
  { number: 8, name: "Sahel Spirit", jockey: "R. Hama" },
  { number: 9, name: "Dosso Express", jockey: "K. Boubacar" },
  { number: 10, name: "Tillabéri Storm", jockey: "L. Maman" },
  { number: 11, name: "Diffa Dream", jockey: "Y. Garba" },
  { number: 12, name: "Sahara Queen", jockey: "F. Souley" },
];

export const footMatches: FootMatch[] = [
  { id: "m1", home: "Sahel SC", away: "AS GNN", date: "Sam. 20:00", odds: { "1": 1.85, "X": 3.2, "2": 4.1 } },
  { id: "m2", home: "AS FAN", away: "Olympic FC", date: "Sam. 17:00", odds: { "1": 2.1, "X": 3.0, "2": 3.4 } },
  { id: "m3", home: "Akokana", away: "Zumunta", date: "Dim. 16:00", odds: { "1": 1.6, "X": 3.5, "2": 5.2 } },
  { id: "m4", home: "Espoir Zinder", away: "USGN", date: "Dim. 18:30", odds: { "1": 2.4, "X": 2.9, "2": 2.9 } },
  { id: "m5", home: "Liberté FC", away: "Jangorzo", date: "Dim. 20:30", odds: { "1": 1.9, "X": 3.1, "2": 3.8 } },
];

export const recentResults: DrawResult[] = [
  // Loto Balsa — tirages hebdomadaires (vendredi 21h)
  { id: "l1", gameId: "loto", date: "2026-06-19", numbers: [7, 12, 19, 28, 34] },
  { id: "l2", gameId: "loto", date: "2026-06-12", numbers: [3, 11, 17, 22, 36] },
  { id: "l3", gameId: "loto", date: "2026-06-05", numbers: [5, 9, 14, 27, 33] },
  { id: "l4", gameId: "loto", date: "2026-05-29", numbers: [21, 44, 58, 67, 81] },
  // PMU — tirages quotidiens (15h)
  { id: "p1", gameId: "pmu", date: "2026-06-22", horses: [3, 7, 5, 1, 9] },
  { id: "p2", gameId: "pmu", date: "2026-06-21", horses: [10, 2, 6, 4, 8] },
  { id: "p3", gameId: "pmu", date: "2026-06-20", horses: [4, 11, 1, 7, 12] },
  { id: "p4", gameId: "pmu", date: "2026-06-19", horses: [2, 9, 6, 3, 5] },
  { id: "p5", gameId: "pmu", date: "2026-06-18", horses: [8, 1, 10, 12, 4] },
  { id: "p6", gameId: "pmu", date: "2026-06-17", horses: [5, 7, 2, 6, 11] },
  { id: "p7", gameId: "pmu", date: "2026-06-16", horses: [9, 3, 8, 1, 10] },
  // Pari Foot — week-ends
  { id: "f1", gameId: "foot", date: "2026-06-15", matches: [
    { matchId: "m1", result: "1" }, { matchId: "m2", result: "X" }, { matchId: "m3", result: "1" },
  ]},
  { id: "f2", gameId: "foot", date: "2026-06-08", matches: [
    { matchId: "m4", result: "2" }, { matchId: "m5", result: "1" },
  ]},
];

export const hotNumbers = [7, 19, 34, 56, 72, 88];
export const coldNumbers = [2, 23, 41, 63, 77, 90];
export const lotoSuggestions = [
  [12, 27, 45, 68, 84],
  [7, 19, 33, 56, 72],
  [3, 21, 49, 64, 88],
];

/** Loto Balsa — multiplicateurs officiels simulés (style Niger : 1 à 5 boules sur 90). */
export const lotoMultipliers: Record<number, number> = {
  1: 70,
  2: 240,
  3: 800,
  4: 4000,
  5: 20000,
};

/** Jackpot principal — PMU Quinté du jour (cagnotte cumulée). */
export const pmuJackpot = 187_500_000; // FCFA
/** Cagnotte Loto Balsa du vendredi. */
export const lotoJackpot = 42_000_000; // FCFA

export const expertTips = [
  { game: "pmu" as GameId, title: "Tiercé du jour", text: "Sahara Wind (1) en pole position. Niamey Star (2) confirme. Outsider : Niger Gold (7)." },
  { game: "pmu" as GameId, title: "Favori absolu", text: "Akokana (3) a remporté 4 des 5 dernières courses." },
  { game: "foot" as GameId, title: "Match phare", text: "Sahel SC très solide à domicile (8 victoires de suite)." },
  { game: "foot" as GameId, title: "Tendance", text: "Plus de 70% des matchs du week-end finissent avec +2,5 buts." },
  { game: "loto" as GameId, title: "Combinaison à surveiller", text: "Le 7 et le 19 sortent souvent ensemble (12 fois cette saison)." },
];

export const paymentMethods = [
  { id: "airtel", name: "Airtel Money", color: "#E40000" },
  { id: "zamani", name: "Zamani Cash", color: "#1A6B5E" },
  { id: "nita", name: "Nita", color: "#FFB300" },
  { id: "moov", name: "Moov Money", color: "#005EB8" },
  { id: "amanata", name: "Amanata", color: "#0F766E" },
  { id: "mynita", name: "MyNita", color: "#7C3AED" },
];

export const games = [
  { id: "pmu" as GameId, name: "PMU", emoji: "🐎", closes: "Tous les jours 14:00", color: "from-[oklch(0.78_0.20_150)] to-[oklch(0.45_0.12_160)]" },
  { id: "loto" as GameId, name: "Loto Balsa", emoji: "🎱", closes: "Vendredi 20:00", color: "from-[oklch(0.82_0.17_82)] to-[oklch(0.65_0.18_60)]" },
  { id: "foot" as GameId, name: "Pari Foot", emoji: "⚽", closes: "Samedi 16:00", color: "from-[oklch(0.72_0.13_215)] to-[oklch(0.35_0.10_240)]" },
];

/** Calendrier officiel des tirages. */
export const drawSchedule = {
  pmu: { closeHour: 14, drawHour: 15, daily: true, label: "Quinté du jour — 15h00" },
  loto: { closeHour: 20, drawHour: 21, weekday: 5 /* Friday */, label: "Vendredi 21h00" },
} as const;