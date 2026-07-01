// Système anti-double paiement + rate limiting réutilisable (mock localStorage).
// V1 maquette : validation côté client uniquement. Un vrai backend devra doubler ces checks.

const INTENT_KEY = "lonani.payment.intents";
const WINDOW_MS = 30_000; // fenêtre anti-doublon : 30s

export interface PaymentIntent {
  key: string;
  txRef: string;
  gameId: string;
  phone: string;
  amount: number;
  createdAt: number;
  status: "pending" | "confirmed" | "failed";
}

function isBrowser() { return typeof window !== "undefined"; }
function load(): PaymentIntent[] {
  if (!isBrowser()) return [];
  try { return JSON.parse(localStorage.getItem(INTENT_KEY) ?? "[]"); } catch { return []; }
}
function save(list: PaymentIntent[]) {
  if (isBrowser()) localStorage.setItem(INTENT_KEY, JSON.stringify(list));
}
function gc(list: PaymentIntent[], now: number) {
  // On garde 24h pour audit, on purge au-delà
  return list.filter((i) => now - i.createdAt < 24 * 3600_000);
}

/** Empreinte déterministe du paiement. */
export function paymentKey(input: { phone: string; amount: number; gameId: string; selection: string }): string {
  const s = `${input.phone}|${input.amount}|${input.gameId}|${input.selection}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return `pk_${(h >>> 0).toString(36)}`;
}

/** Vérifie si un paiement identique est en cours ou a déjà été confirmé dans la fenêtre anti-doublon. */
export function checkDuplicate(key: string): { duplicate: boolean; intent?: PaymentIntent } {
  const now = Date.now();
  const list = gc(load(), now);
  const match = list.find((i) =>
    i.key === key &&
    (i.status === "confirmed" || (i.status === "pending" && now - i.createdAt < WINDOW_MS)),
  );
  return { duplicate: !!match, intent: match };
}

/** Crée une intention de paiement "pending". À appeler juste avant l'appel à la MM API. */
export function beginPayment(input: { key: string; gameId: string; phone: string; amount: number }): PaymentIntent {
  const now = Date.now();
  const list = gc(load(), now);
  const txRef = `TX-${now.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`.toUpperCase();
  const intent: PaymentIntent = { ...input, txRef, createdAt: now, status: "pending" };
  save([intent, ...list]);
  return intent;
}

/** Marque l'intention comme confirmée (ticket émis). */
export function confirmPayment(txRef: string) {
  const list = load().map((i) => (i.txRef === txRef ? { ...i, status: "confirmed" as const } : i));
  save(list);
}
/** Marque l'intention comme échouée (annule le blocage anti-doublon). */
export function failPayment(txRef: string) {
  const list = load().map((i) => (i.txRef === txRef ? { ...i, status: "failed" as const } : i));
  save(list);
}

export function listIntents(): PaymentIntent[] { return load(); }