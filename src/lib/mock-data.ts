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
  { id: "d1", gameId: "loto", date: "2026-06-21", numbers: [7, 12, 19, 28, 34, 41] },
  { id: "d2", gameId: "loto", date: "2026-06-18", numbers: [3, 11, 17, 22, 36, 45] },
  { id: "d3", gameId: "loto", date: "2026-06-15", numbers: [5, 9, 14, 27, 33, 40] },
  { id: "d4", gameId: "pmu", date: "2026-06-21", horses: [3, 7, 5, 1, 9] },
  { id: "d5", gameId: "pmu", date: "2026-06-20", horses: [10, 2, 6, 4, 8] },
  { id: "d6", gameId: "foot", date: "2026-06-15", matches: [
    { matchId: "m1", result: "1" }, { matchId: "m2", result: "X" }, { matchId: "m3", result: "1" },
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

export const jackpot = 187_500_000; // FCFA

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
];

export const games = [
  { id: "pmu" as GameId, name: "PMU", emoji: "🐎", closes: "Sam. 18:00", color: "from-[oklch(0.78_0.20_150)] to-[oklch(0.45_0.12_160)]" },
  { id: "loto" as GameId, name: "Loto Balsa", emoji: "🎱", closes: "Ven. 21:00", color: "from-[oklch(0.82_0.17_82)] to-[oklch(0.65_0.18_60)]" },
  { id: "foot" as GameId, name: "Pari Foot", emoji: "⚽", closes: "Sam. 16:00", color: "from-[oklch(0.72_0.13_215)] to-[oklch(0.35_0.10_240)]" },
];