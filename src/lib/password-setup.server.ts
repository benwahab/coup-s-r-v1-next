// Server-only, short-lived authorization token used after OTP verification.
// It deliberately avoids creating an authenticated browser session before the
// user has chosen a permanent password.

const encoder = new TextEncoder();
const TTL_MS = 10 * 60 * 1000;

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getKey(): Promise<CryptoKey> {
  // Keep the secret server-side. TICKET_HMAC_SECRET is already required by
  // this deployment; a dedicated secret can be introduced later without
  // changing the token format.
  const secret = process.env.PASSWORD_SETUP_TOKEN_SECRET || process.env.TICKET_HMAC_SECRET;
  if (!secret) throw new Error("PASSWORD_SETUP_TOKEN_SECRET missing");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function signPasswordSetupToken(userId: string): Promise<string> {
  const payload = { uid: userId, exp: Date.now() + TTL_MS };
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await getKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return `${body}.${b64urlEncode(sig)}`;
}

export async function verifyPasswordSetupToken(token: string): Promise<{ userId: string } | null> {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const key = await getKey();
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
    const supplied = b64urlDecode(sig);
    if (supplied.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ supplied[i];
    if (diff !== 0) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as { uid?: string; exp?: number };
    if (!payload.uid || !payload.exp || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    return { userId: payload.uid };
  } catch {
    return null;
  }
}
