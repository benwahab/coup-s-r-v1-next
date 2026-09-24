// Server-only helpers for the provider-backed OTP flow.
// Blocked from client bundles by the *.server.* filename convention.

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return toHex(digest);
}

/** Génère un OTP à 6 chiffres cryptographiquement aléatoire. */
export function generateOtpCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

/** Normalise un numéro nigérien 8 chiffres → format E.164 (+227XXXXXXXX). */
export function toE164Phone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 8) return `+227${clean}`;
  if (clean.startsWith("227")) return `+${clean}`;
  return clean.startsWith("+") ? clean : `+${clean}`;
}
