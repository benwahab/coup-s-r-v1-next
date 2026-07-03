// Versions & registre légal (mock frontend)
export const TERMS_VERSION = "1.0.0";
export const PRIVACY_VERSION = "1.0.0";
export const TERMS_DATE = "01/01/2026";
export const PRIVACY_DATE = "01/01/2026";

export interface ConsentRecord {
  acceptedAt: number;
  termsVersion: string;
  privacyVersion: string;
  ip: string;
  userId: string;
}

export function mockIp(): string {
  if (typeof window === "undefined") return "0.0.0.0";
  try {
    const KEY = "lonani.mockip";
    let ip = localStorage.getItem(KEY);
    if (!ip) {
      const rnd = () => Math.floor(Math.random() * 254) + 1;
      ip = `41.203.${rnd()}.${rnd()}`;
      localStorage.setItem(KEY, ip);
    }
    return ip;
  } catch {
    return "0.0.0.0";
  }
}

export function makeUserId(phone: string): string {
  return `usr_${phone}_${Date.now().toString(36)}`;
}