/** Static product configuration only. No draws, fixtures, horses, results or simulated data live here. */
export type GameId = "pmu" | "loto" | "foot";

export const paymentMethods = [
  { id: "airtel", name: "Airtel Money", color: "#E40000" },
  { id: "amanata", name: "Amanata", color: "#0F766E" },
  { id: "mynita", name: "MyNita", color: "#7C3AED" },
  { id: "moov", name: "Moov Flooz", color: "#005EB8" },
  { id: "zamani", name: "Zamani Cash", color: "#1A6B5E" },
] as const;

export const regions = [
  "Niamey", "Maradi", "Zinder", "Tahoua", "Agadez", "Dosso", "Tillabéri", "Diffa",
] as const;
export type Region = (typeof regions)[number];

export const lotoMultipliers: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 70,
  2: 240,
  3: 800,
  4: 4000,
  5: 20000,
};
