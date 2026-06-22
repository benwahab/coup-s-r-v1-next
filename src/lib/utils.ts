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
