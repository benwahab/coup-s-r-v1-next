export type GameId = "pmu" | "loto" | "foot";

export interface Horse {
  number: number;
  name: string;
  intlName: string;
  jockey: string;
  status: "partant" | "non-partant";
  form: string;       // ex. "1a2a3p"
  winRate: number;    // 0..1
  placeRate: number;  // 0..1
  weight: number;     // kg
}
export interface FootMatch { id: string; league: string; home: string; away: string; date: string; odds: { "1": number; "X": number; "2": number } }
export interface DrawResult { id: string; gameId: GameId; date: string; numbers?: number[]; horses?: number[]; matches?: { matchId: string; result: "1" | "X" | "2" }[] }

export const horses: Horse[] = [
  { number: 1,  name: "Sahara Wind",      intlName: "Desert Breeze",   jockey: "M. Ousmane",  status: "partant",     form: "1a2a3p", winRate: 0.22, placeRate: 0.55, weight: 56 },
  { number: 2,  name: "Niamey Star",      intlName: "Capital Star",    jockey: "A. Idrissa",  status: "partant",     form: "3a1a2a", winRate: 0.18, placeRate: 0.48, weight: 57 },
  { number: 3,  name: "Tahoua Flash",     intlName: "Northern Flash",  jockey: "B. Saidou",   status: "partant",     form: "1a1a2p", winRate: 0.28, placeRate: 0.62, weight: 58 },
  { number: 4,  name: "Zinder King",      intlName: "Eastern King",    jockey: "M. Abdou",    status: "non-partant", form: "4a5a6a", winRate: 0.08, placeRate: 0.25, weight: 55 },
  { number: 5,  name: "Agadez Pride",     intlName: "Pride of Sahel",  jockey: "S. Issa",     status: "partant",     form: "2a3a1a", winRate: 0.20, placeRate: 0.52, weight: 56 },
  { number: 6,  name: "Maradi Lightning", intlName: "Lightning Bolt",  jockey: "H. Moussa",   status: "partant",     form: "5a4a3p", winRate: 0.12, placeRate: 0.36, weight: 54 },
  { number: 7,  name: "Niger Gold",       intlName: "Golden River",    jockey: "T. Ali",      status: "partant",     form: "1a3a1a", winRate: 0.24, placeRate: 0.58, weight: 57 },
  { number: 8,  name: "Sahel Spirit",     intlName: "Spirit of Sahel", jockey: "R. Hama",     status: "partant",     form: "6a5a4a", winRate: 0.09, placeRate: 0.28, weight: 55 },
  { number: 9,  name: "Dosso Express",    intlName: "Express South",   jockey: "K. Boubacar", status: "partant",     form: "2a2a1p", winRate: 0.17, placeRate: 0.50, weight: 56 },
  { number: 10, name: "Tillabéri Storm",  intlName: "River Storm",     jockey: "L. Maman",    status: "partant",     form: "3a4a2a", winRate: 0.14, placeRate: 0.42, weight: 56 },
  { number: 11, name: "Diffa Dream",      intlName: "Eastern Dream",   jockey: "Y. Garba",    status: "non-partant", form: "7a6a8a", winRate: 0.05, placeRate: 0.18, weight: 54 },
  { number: 12, name: "Sahara Queen",     intlName: "Desert Queen",    jockey: "F. Souley",   status: "partant",     form: "1a2a1a", winRate: 0.26, placeRate: 0.60, weight: 57 },
];

export const leagues = [
  { id: "epl", name: "Premier League", country: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "liga", name: "La Liga", country: "🇪🇸" },
  { id: "seriea", name: "Serie A", country: "🇮🇹" },
  { id: "bundes", name: "Bundesliga", country: "🇩🇪" },
  { id: "l1", name: "Ligue 1", country: "🇫🇷" },
  { id: "ucl", name: "Ligue des Champions", country: "🏆" },
  { id: "uel", name: "Europa League", country: "🥈" },
  { id: "can", name: "CAN", country: "🌍" },
  { id: "wc", name: "Coupe du Monde — Qualif.", country: "🌐" },
  { id: "ng", name: "Championnat Niger", country: "🇳🇪" },
] as const;

export const footMatches: FootMatch[] = [
  // Premier League
  { id: "epl1", league: "epl", home: "Arsenal", away: "Chelsea", date: "Sam. 16:00", odds: { "1": 1.85, "X": 3.6, "2": 4.1 } },
  { id: "epl2", league: "epl", home: "Liverpool", away: "Man. City", date: "Sam. 18:30", odds: { "1": 2.4, "X": 3.4, "2": 2.7 } },
  { id: "epl3", league: "epl", home: "Tottenham", away: "Man. United", date: "Dim. 17:00", odds: { "1": 2.1, "X": 3.3, "2": 3.2 } },
  // La Liga
  { id: "liga1", league: "liga", home: "Real Madrid", away: "Barcelona", date: "Sam. 21:00", odds: { "1": 2.05, "X": 3.5, "2": 3.2 } },
  { id: "liga2", league: "liga", home: "Atlético", away: "Sevilla", date: "Dim. 19:00", odds: { "1": 1.7, "X": 3.4, "2": 4.6 } },
  // Serie A
  { id: "ita1", league: "seriea", home: "Inter", away: "Juventus", date: "Sam. 20:45", odds: { "1": 2.0, "X": 3.2, "2": 3.7 } },
  { id: "ita2", league: "seriea", home: "Milan", away: "Napoli", date: "Dim. 20:45", odds: { "1": 2.3, "X": 3.1, "2": 2.95 } },
  // Bundesliga
  { id: "bun1", league: "bundes", home: "Bayern", away: "Dortmund", date: "Sam. 18:30", odds: { "1": 1.6, "X": 4.2, "2": 4.8 } },
  { id: "bun2", league: "bundes", home: "Leipzig", away: "Leverkusen", date: "Dim. 17:30", odds: { "1": 2.6, "X": 3.4, "2": 2.5 } },
  // Ligue 1
  { id: "l1a", league: "l1", home: "PSG", away: "Marseille", date: "Dim. 20:45", odds: { "1": 1.45, "X": 4.6, "2": 6.5 } },
  { id: "l1b", league: "l1", home: "Monaco", away: "Lille", date: "Sam. 17:00", odds: { "1": 2.1, "X": 3.3, "2": 3.2 } },
  // UCL
  { id: "ucl1", league: "ucl", home: "Real Madrid", away: "Bayern", date: "Mer. 21:00", odds: { "1": 2.2, "X": 3.4, "2": 3.0 } },
  { id: "ucl2", league: "ucl", home: "Man. City", away: "PSG", date: "Mar. 21:00", odds: { "1": 1.9, "X": 3.6, "2": 3.6 } },
  // UEL
  { id: "uel1", league: "uel", home: "Roma", away: "Ajax", date: "Jeu. 18:45", odds: { "1": 1.95, "X": 3.4, "2": 3.5 } },
  // CAN
  { id: "can1", league: "can", home: "Sénégal", away: "Maroc", date: "Sam. 19:00", odds: { "1": 2.6, "X": 3.0, "2": 2.6 } },
  { id: "can2", league: "can", home: "Niger", away: "Algérie", date: "Dim. 16:00", odds: { "1": 4.5, "X": 3.4, "2": 1.7 } },
  { id: "can3", league: "can", home: "Côte d'Ivoire", away: "Nigeria", date: "Lun. 19:00", odds: { "1": 2.3, "X": 3.1, "2": 2.95 } },
  // Qualif WC
  { id: "wc1", league: "wc", home: "Niger", away: "Burkina", date: "Sam. 17:00", odds: { "1": 2.1, "X": 3.1, "2": 3.3 } },
  // Championnat Niger
  { id: "ng1", league: "ng", home: "Sahel SC", away: "AS GNN", date: "Sam. 16:00", odds: { "1": 1.85, "X": 3.2, "2": 4.1 } },
  { id: "ng2", league: "ng", home: "Akokana", away: "Zumunta", date: "Dim. 16:00", odds: { "1": 1.6, "X": 3.5, "2": 5.2 } },
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
  { id: "loto" as GameId, name: "Loto Balsa", emoji: "🎱", closes: "Tous les jours 19:00", color: "from-[oklch(0.82_0.17_82)] to-[oklch(0.65_0.18_60)]" },
  { id: "foot" as GameId, name: "Pari Foot", emoji: "⚽", closes: "Samedi 16:00", color: "from-[oklch(0.72_0.13_215)] to-[oklch(0.35_0.10_240)]" },
];

/** Calendrier officiel des tirages. */
export const drawSchedule = {
  pmu: { openHour: 8, closeHour: 14, drawHour: 15, daily: true, label: "Quinté du jour — 15h00" },
  loto: { openHour: 8, closeHour: 19, drawHour: 20, daily: true, label: "Tirage quotidien — 20h00" },
} as const;

/** Régions du Niger. */
export const regions = [
  "Niamey", "Maradi", "Zinder", "Tahoua", "Agadez", "Dosso", "Tillabéri", "Diffa",
] as const;
export type Region = (typeof regions)[number];