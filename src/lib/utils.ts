import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deterministic DD/MM/YYYY formatter — SSR-safe, locale-free. */
export function formatDate(iso: string): string {
  const d = iso.includes("T") ? iso.slice(0, 10) : iso;
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return iso;
  return `${day}/${m}/${y}`;
}

export function formatFcfa(n: number): string {
  return n.toLocaleString("fr-FR").replace(/\u202f/g, " ");
}

/** Formatte une heure entière (0–23) en "HH:00". */
export function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/** Hash de chaîne déterministe (FNV-1a 32-bit) — pour PRNG seedé. */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** PRNG mulberry32 (déterministe). */
export function seedRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
