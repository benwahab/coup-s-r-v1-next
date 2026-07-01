// Catalogue de marchés type 1xBet pour chaque match.
// V1 : cotes générées de manière déterministe depuis le triplet 1/X/2 pour rester crédible.

import type { FootMatch } from "./mock-data";

export interface MarketOption { key: string; label: string; odd: number }
export interface Market {
  id: string;
  name: string;
  group: "Résultat" | "Buts" | "Cartons" | "Corners" | "Score" | "Mi-temps" | "Buteurs";
  options: MarketOption[];
}

function jitter(seed: number, base: number, spread = 0.2): number {
  const r = Math.abs(Math.sin(seed) * 10000) % 1;
  return Math.max(1.05, Number((base + (r - 0.5) * spread * base).toFixed(2)));
}
function seedOf(matchId: string, key: string): number {
  let s = 0; const str = matchId + "|" + key;
  for (let i = 0; i < str.length; i++) s = (s * 33 + str.charCodeAt(i)) | 0;
  return s;
}

export function marketsForMatch(m: FootMatch): Market[] {
  const s = (k: string) => seedOf(m.id, k);
  const o1 = m.odds["1"], oX = m.odds["X"], o2 = m.odds["2"];

  return [
    {
      id: "1x2", name: "1X2 — Résultat final", group: "Résultat",
      options: [
        { key: "1", label: `Victoire ${m.home}`, odd: o1 },
        { key: "X", label: "Match nul", odd: oX },
        { key: "2", label: `Victoire ${m.away}`, odd: o2 },
      ],
    },
    {
      id: "dc", name: "Double chance", group: "Résultat",
      options: [
        { key: "1X", label: `${m.home} ou nul`, odd: jitter(s("1X"), (o1 + oX) / 2.5) },
        { key: "12", label: "Pas de nul", odd: jitter(s("12"), (o1 + o2) / 2.8) },
        { key: "X2", label: `Nul ou ${m.away}`, odd: jitter(s("X2"), (oX + o2) / 2.5) },
      ],
    },
    {
      id: "ou", name: "Total de buts", group: "Buts",
      options: [
        { key: "o05", label: "+0.5 but", odd: jitter(s("o05"), 1.08) },
        { key: "u05", label: "-0.5 but", odd: jitter(s("u05"), 9.0, 0.3) },
        { key: "o15", label: "+1.5 but", odd: jitter(s("o15"), 1.35) },
        { key: "u15", label: "-1.5 but", odd: jitter(s("u15"), 3.2) },
        { key: "o25", label: "+2.5 buts", odd: jitter(s("o25"), 1.85) },
        { key: "u25", label: "-2.5 buts", odd: jitter(s("u25"), 1.95) },
        { key: "o35", label: "+3.5 buts", odd: jitter(s("o35"), 2.9) },
        { key: "u35", label: "-3.5 buts", odd: jitter(s("u35"), 1.4) },
      ],
    },
    {
      id: "btts", name: "Les deux équipes marquent", group: "Buts",
      options: [
        { key: "yes", label: "Oui", odd: jitter(s("btts_y"), 1.75) },
        { key: "no", label: "Non", odd: jitter(s("btts_n"), 2.05) },
      ],
    },
    {
      id: "cs", name: "Score exact", group: "Score",
      options: ["1:0", "2:0", "2:1", "3:1", "3:2", "0:0", "1:1", "2:2", "0:1", "0:2", "1:2", "1:3"].map((k) => ({
        key: k, label: k, odd: jitter(s("cs_" + k), 8.5, 0.6),
      })),
    },
    {
      id: "ht", name: "Mi-temps", group: "Mi-temps",
      options: [
        { key: "1", label: `${m.home} MT`, odd: jitter(s("ht1"), o1 * 1.4) },
        { key: "X", label: "Nul MT", odd: jitter(s("htX"), 2.15) },
        { key: "2", label: `${m.away} MT`, odd: jitter(s("ht2"), o2 * 1.4) },
      ],
    },
    {
      id: "cards", name: "Cartons jaunes (total)", group: "Cartons",
      options: [
        { key: "o25", label: "+2.5 cartons", odd: jitter(s("c25"), 1.55) },
        { key: "u25", label: "-2.5 cartons", odd: jitter(s("cu25"), 2.35) },
        { key: "o45", label: "+4.5 cartons", odd: jitter(s("c45"), 2.65) },
        { key: "u45", label: "-4.5 cartons", odd: jitter(s("cu45"), 1.45) },
      ],
    },
    {
      id: "corners", name: "Corners", group: "Corners",
      options: [
        { key: "o75", label: "+7.5 corners", odd: jitter(s("k75"), 1.6) },
        { key: "u75", label: "-7.5 corners", odd: jitter(s("ku75"), 2.25) },
        { key: "o95", label: "+9.5 corners", odd: jitter(s("k95"), 2.15) },
        { key: "u95", label: "-9.5 corners", odd: jitter(s("ku95"), 1.65) },
      ],
    },
    {
      id: "scorer", name: "Buteur dans le match", group: "Buteurs",
      options: [
        { key: "home_star", label: `Attaquant ${m.home}`, odd: jitter(s("sh1"), 2.2) },
        { key: "home_mid", label: `Milieu ${m.home}`, odd: jitter(s("sh2"), 4.4) },
        { key: "away_star", label: `Attaquant ${m.away}`, odd: jitter(s("sa1"), 2.3) },
        { key: "away_mid", label: `Milieu ${m.away}`, odd: jitter(s("sa2"), 4.6) },
      ],
    },
  ];
}

/** Trouve la cote d'un pick "matchId:marketId:optionKey". */
export function oddForPick(pick: string, match: FootMatch): number {
  const [, marketId, optionKey] = pick.split(":");
  const market = marketsForMatch(match).find((mk) => mk.id === marketId);
  return market?.options.find((o) => o.key === optionKey)?.odd ?? 1;
}

/** Libellé humain d'un pick. */
export function labelForPick(pick: string, match: FootMatch): string {
  const [, marketId, optionKey] = pick.split(":");
  const market = marketsForMatch(match).find((mk) => mk.id === marketId);
  const opt = market?.options.find((o) => o.key === optionKey);
  return `${match.home}–${match.away} · ${market?.name ?? marketId} → ${opt?.label ?? optionKey}`;
}