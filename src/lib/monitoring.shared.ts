// Outils partagés (navigateur + serveur) de la supervision technique.
// Aucune dépendance serveur ici.

export type MonitoringLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export function newTraceId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return "trace_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Masque automatiquement les informations sensibles (jetons, clés, numéros, e-mails, mots de passe). */
export function sanitize(value: string | null | undefined, max = 500): string | null {
  if (value == null) return null;
  let s = String(value);
  s = s.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[jeton masqué]");
  s = s.replace(/\bsb_(publishable|secret)_[\w-]+/g, "[clé masquée]");
  s = s.replace(/(bearer\s+)[\w.-]+/gi, "$1[masqué]");
  s = s.replace(/((?:password|mot_de_passe|pwd|token|secret|apikey|api_key|code|otp)["'\s:=]+)[^\s"',}&]+/gi, "$1[masqué]");
  s = s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail masqué]");
  s = s.replace(/\+?\d[\d\s]{7,}\d/g, "[numéro masqué]");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

const SERVICE_LABELS: Record<string, string> = {
  otp: "Authentification",
  password: "Authentification",
  account: "Compte joueur",
  "secure-user": "Authentification",
  payment: "Paiement",
  tickets: "Tickets",
  "ticket-token": "Signature des tickets",
  settlement: "Règlement des gains",
  admin: "Administration",
  "ai-foot": "Pronostics IA",
  "ai-pronos": "Pronostics IA",
  "game-schedule": "Horaires des jeux",
  "server-config": "Configuration",
  monitoring: "Supervision",
};

export function serviceFromFilename(filename: string | undefined): string {
  if (!filename) return "Serveur";
  const base = filename.split("/").pop() ?? filename;
  const key = base.replace(/\.(functions|server)\.tsx?$/, "").replace(/\.tsx?$/, "");
  return SERVICE_LABELS[key] ?? key;
}

/** Fonctions exclues de la collecte pour ne pas se mesurer elles-mêmes. */
export function isUntracked(name: string | undefined): boolean {
  return !!name && (name === "ingestClientEvents" || name.startsWith("supervision"));
}
