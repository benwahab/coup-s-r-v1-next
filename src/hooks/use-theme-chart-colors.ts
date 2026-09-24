import { useEffect, useState } from "react";

/** Palette recharts alignée sur les tokens du thème.
 *  Les couleurs OKLCH du projet ne peuvent pas être injectées via `var()`
 *  dans un attribut SVG (stroke/fill) — on les résout au montage. */
export type ChartColors = {
  primary: string; // orange CTA
  teal: string; // émeraude
  success: string; // vert gain
  destructive: string;
  muted: string;
  border: string;
  card: string;
  mutedForeground: string;
  gold: string;
};

const FALLBACK: ChartColors = {
  primary: "oklch(0.75 0.18 55)",
  teal: "oklch(0.72 0.14 172)",
  success: "oklch(0.76 0.16 165)",
  destructive: "oklch(0.66 0.22 27)",
  muted: "oklch(0.32 0.05 172)",
  border: "oklch(0.36 0.05 172)",
  card: "oklch(0.30 0.055 172)",
  mutedForeground: "oklch(0.78 0.02 180)",
  gold: "oklch(0.78 0.16 60)",
};

function read(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function useThemeChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(FALLBACK);
  useEffect(() => {
    setColors({
      primary: read("--primary", FALLBACK.primary),
      teal: read("--teal", FALLBACK.teal),
      success: read("--success", FALLBACK.success),
      destructive: read("--destructive", FALLBACK.destructive),
      muted: read("--muted", FALLBACK.muted),
      border: read("--border", FALLBACK.border),
      card: read("--card", FALLBACK.card),
      mutedForeground: read("--muted-foreground", FALLBACK.mutedForeground),
      gold: read("--gold", FALLBACK.gold),
    });
  }, []);
  return colors;
}
