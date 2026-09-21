// Marchés exposés uniquement lorsque les cotes sont fournies par le backend.
// Tant que le schéma source ne fournit que 1X2, aucun marché synthétique n’est affiché.

import type { FootMatch } from "./foot.types";

export interface MarketOption { key: string; label: string; odd: number }
export interface Market {
  id: string;
  name: string;
  group: "Résultat" | "Buts" | "Cartons" | "Corners" | "Score" | "Mi-temps" | "Buteurs";
  options: MarketOption[];
}

export function marketsForMatch(m: FootMatch): Market[] {
  return [{
    id: "1x2",
    name: "1X2 — Résultat final",
    group: "Résultat",
    options: [
      { key: "1", label: `Victoire ${m.home}`, odd: m.odds["1"] },
      { key: "X", label: "Match nul", odd: m.odds["X"] },
      { key: "2", label: `Victoire ${m.away}`, odd: m.odds["2"] },
    ],
  }];
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