// Logs de tentatives + rate limiting mock (par numéro et par "IP" mock localStorage).
// V1 maquette : aucun backend — un attaquant côté client peut contourner. Voir TODO Cloud.

const LOG_KEY = "lonani.auth.log";
const IP_KEY = "lonani.mock.ip";
const ATTEMPTS_KEY = "lonani.auth.attempts"; // { byPhone: {p: [ts...]}, byIp: {ip: [ts...]} }

export type AuthEventKind =
  | "otp-request"
  | "verify-ok"
  | "verify-fail"
  | "locked"
  | "rate-limited"
  | "logout"
  | "session-expired";

export interface AuthEvent {
  at: number;
  phone: string;
  ip: string;
  kind: AuthEventKind;
  note?: string;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_PHONE = 5;
const MAX_PER_IP = 10;
const MAX_LOG = 200;

function isBrowser() { return typeof window !== "undefined"; }

export function getMockIp(): string {
  if (!isBrowser()) return "0.0.0.0";
  let ip = localStorage.getItem(IP_KEY);
  if (!ip) {
    // Fake IP déterministe basée sur un nombre aléatoire à la 1re visite (mock seulement).
    ip = `10.${rand(0, 254)}.${rand(0, 254)}.${rand(1, 254)}`;
    localStorage.setItem(IP_KEY, ip);
  }
  return ip;
}
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function loadAttempts(): { byPhone: Record<string, number[]>; byIp: Record<string, number[]> } {
  if (!isBrowser()) return { byPhone: {}, byIp: {} };
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return { byPhone: {}, byIp: {} };
    return JSON.parse(raw);
  } catch { return { byPhone: {}, byIp: {} }; }
}
function saveAttempts(a: { byPhone: Record<string, number[]>; byIp: Record<string, number[]> }) {
  if (isBrowser()) localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(a));
}
function gc(list: number[], now: number) {
  return list.filter((t) => now - t < WINDOW_MS);
}

export interface RateCheck { ok: boolean; reason?: "phone" | "ip"; retryInMs?: number }

/** Vérifie si on peut tenter une nouvelle requête OTP / vérification. */
export function checkRate(phone: string): RateCheck {
  const ip = getMockIp();
  const now = Date.now();
  const a = loadAttempts();
  const ph = gc(a.byPhone[phone] ?? [], now);
  const ipList = gc(a.byIp[ip] ?? [], now);
  if (ph.length >= MAX_PER_PHONE) {
    const retryInMs = WINDOW_MS - (now - ph[0]);
    return { ok: false, reason: "phone", retryInMs };
  }
  if (ipList.length >= MAX_PER_IP) {
    const retryInMs = WINDOW_MS - (now - ipList[0]);
    return { ok: false, reason: "ip", retryInMs };
  }
  return { ok: true };
}

/** Enregistre une tentative (à appeler à chaque request / verify). */
export function pushAttempt(phone: string) {
  const ip = getMockIp();
  const now = Date.now();
  const a = loadAttempts();
  a.byPhone[phone] = [...gc(a.byPhone[phone] ?? [], now), now];
  a.byIp[ip] = [...gc(a.byIp[ip] ?? [], now), now];
  saveAttempts(a);
}

export function logAuthEvent(kind: AuthEventKind, phone: string, note?: string) {
  if (!isBrowser()) return;
  const entry: AuthEvent = { at: Date.now(), phone, ip: getMockIp(), kind, note };
  let arr: AuthEvent[] = [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    arr = raw ? JSON.parse(raw) : [];
  } catch { arr = []; }
  arr.unshift(entry);
  arr = arr.slice(0, MAX_LOG);
  localStorage.setItem(LOG_KEY, JSON.stringify(arr));
}

export function readAuthLog(): AuthEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export const RATE_LIMITS = { WINDOW_MS, MAX_PER_PHONE, MAX_PER_IP } as const;