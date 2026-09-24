// Versions des documents juridiques affichés par l'application.
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

export function makeUserId(phone: string): string {
  return `usr_${phone}_${Date.now().toString(36)}`;
}
