export type GameId = "pmu" | "loto" | "foot";

export interface Horse {
  number: number;
  name: string;
  intlName: string;
  jockey: string;
  status: "partant" | "non-partant";
  form: string;
  winRate: number;
  placeRate: number;
  weight: number;
}

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

export const horses: Horse[] = [];
export const footMatches: FootMatch[] = [];
export const recentResults: DrawResult[] = [];
export const hotNumbers: number[] = [];
export const coldNumbers: number[] = [];
export const lotoSuggestions: number[][] = [];
export const expertTips: { game: GameId; title: string; text: string }[] = [];
export const games = [
  { id: "pmu" as GameId, name: "PMU", emoji: "🐎", closes: "Tous les jours 15:00", color: "from-[oklch(0.78_0.20_150)] to-[oklch(0.45_0.12_160)]" },
  { id: "loto" as GameId, name: "Loto Balsa", emoji: "🎱", closes: "Tous les jours 15:00", color: "from-[oklch(0.82_0.17_82)] to-[oklch(0.65_0.18_60)]" },
  { id: "foot" as GameId, name: "Pari Foot", emoji: "⚽", closes: "Disponible 24h/24", color: "from-[oklch(0.72_0.13_215)] to-[oklch(0.35_0.10_240)]" },
] as const;

export const drawSchedule = {
  pmu: { openHour: 16, closeHour: 15, drawHour: 15, drawMinute: 30, daily: true, label: "Quinté du jour — 15h30" },
  loto: { openHour: 16, closeHour: 15, drawHour: 15, drawMinute: 30, daily: true, label: "Tirage quotidien — 15h30" },
} as const;

export const lotoMultipliers: Record<number, number> = {
  1: 70, 2: 240, 3: 800, 4: 4000, 5: 20000,
};

export const paymentMethods = [
  { id: "airtel", name: "Airtel Money", color: "#E40000" },
  { id: "moov", name: "Moov Flooz" },
  { id: "zamani", name: "Zamani Cash" },
  { id: "amanata", name: "Amanata" },
  { id: "mynita", name: "MyNita" },
];

export const regions = [
  "Niamey", "Maradi", "Zinder", "Tahoua", "Agadez", "Dosso", "Tillabéri", "Diffa",
] as const;
export type Region = (typeof regions)[number];

export const leagues = [
  { id: "epl", name: "Premier League", country: "🏴" },
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
