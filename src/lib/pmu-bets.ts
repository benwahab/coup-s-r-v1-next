// PMU bet types — Niger / France standards (simulés).
export type PmuBetId =
  | "simple_g" | "simple_p"
  | "couple_g" | "couple_p"
  | "tierce_o" | "tierce_d"
  | "quarte_o" | "quarte_d"
  | "quinte_p"
  | "champ_reduit" | "combine";

export interface PmuBet {
  id: PmuBetId;
  name: string;
  short: string;
  help: string;           // texte simple pour analphabète
  emoji: string;
  minPicks: number;
  maxPicks: number;
  baseStake: number;      // FCFA par combinaison
  odds: number;           // cote mock pour calcul gain potentiel
  ordered: boolean;       // ordre cliqué important
  /** Nb de combinaisons facturées pour n chevaux sélectionnés. */
  combos: (n: number) => number;
}

function C(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}
function P(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r *= n - i;
  return r;
}

export const pmuBets: PmuBet[] = [
  { id: "simple_g", name: "Simple Gagnant", short: "Gagnant", emoji: "🥇",
    help: "Trouve le cheval qui arrive 1er.", minPicks: 1, maxPicks: 1,
    baseStake: 300, odds: 4.5, ordered: false, combos: () => 1 },
  { id: "simple_p", name: "Simple Placé", short: "Placé", emoji: "🏅",
    help: "Ton cheval doit finir dans le top 3.", minPicks: 1, maxPicks: 1,
    baseStake: 300, odds: 2.2, ordered: false, combos: () => 1 },
  { id: "couple_g", name: "Couplé Gagnant", short: "Couplé G", emoji: "🤝",
    help: "Les 2 premiers chevaux, peu importe l'ordre.", minPicks: 2, maxPicks: 6,
    baseStake: 300, odds: 12, ordered: false, combos: (n) => Math.max(1, C(n, 2)) },
  { id: "couple_p", name: "Couplé Placé", short: "Couplé P", emoji: "🎯",
    help: "2 chevaux parmi les 3 premiers.", minPicks: 2, maxPicks: 6,
    baseStake: 300, odds: 6, ordered: false, combos: (n) => Math.max(1, C(n, 2)) },
  { id: "tierce_o", name: "Tiercé — Ordre", short: "Tiercé O", emoji: "🥇🥈🥉",
    help: "Les 3 premiers, dans le bon ordre.", minPicks: 3, maxPicks: 5,
    baseStake: 300, odds: 80, ordered: true, combos: (n) => Math.max(1, P(n, 3)) },
  { id: "tierce_d", name: "Tiercé — Désordre", short: "Tiercé D", emoji: "🎲",
    help: "Les 3 premiers, ordre indifférent.", minPicks: 3, maxPicks: 6,
    baseStake: 300, odds: 20, ordered: false, combos: (n) => Math.max(1, C(n, 3)) },
  { id: "quarte_o", name: "Quarté — Ordre", short: "Quarté O", emoji: "🏆",
    help: "Les 4 premiers, dans l'ordre.", minPicks: 4, maxPicks: 6,
    baseStake: 500, odds: 200, ordered: true, combos: (n) => Math.max(1, P(n, 4)) },
  { id: "quarte_d", name: "Quarté — Désordre", short: "Quarté D", emoji: "🎰",
    help: "Les 4 premiers, ordre indifférent.", minPicks: 4, maxPicks: 7,
    baseStake: 500, odds: 60, ordered: false, combos: (n) => Math.max(1, C(n, 4)) },
  { id: "quinte_p", name: "Quinté+", short: "Quinté+", emoji: "👑",
    help: "Les 5 premiers — la grande cagnotte.", minPicks: 5, maxPicks: 7,
    baseStake: 300, odds: 400, ordered: false, combos: (n) => Math.max(1, C(n, 5)) },
  { id: "champ_reduit", name: "Champ Réduit", short: "Champ", emoji: "🎯",
    help: "1 base + plusieurs outsiders pour multiplier les chances.", minPicks: 3, maxPicks: 8,
    baseStake: 300, odds: 25, ordered: false, combos: (n) => Math.max(1, n - 1) },
  { id: "combine", name: "Combiné", short: "Combiné", emoji: "🧩",
    help: "Tu joues plus de chevaux que demandé pour couvrir plusieurs combinaisons.", minPicks: 4, maxPicks: 8,
    baseStake: 300, odds: 35, ordered: false, combos: (n) => Math.max(1, C(n, 3)) },
];

export function findBet(id: PmuBetId) {
  return pmuBets.find((b) => b.id === id) ?? pmuBets[0];
}