// Calcule un "sessionId" par jeu pour purger les brouillons quand la session change.
// PMU : session = date du jour (ouverture 8h → clôture 14h → nouvelle session le lendemain 8h)
// Loto : session = date du jour
// Foot : session = date du jour

import { nigerParts } from "./schedule";
import type { GameId } from "./mock-data";

export function currentSessionId(gameId: GameId, now: Date = new Date()): string {
  const p = nigerParts(now);
  const day = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  // Séance : avant l'ouverture (8h), on rattache à la veille pour ne pas casser la session en cours
  const dayIso = p.hour < 8 ? shiftDay(day, -1) : day;
  return `${gameId}:${dayIso}`;
}

function shiftDay(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}