// Signed token for ticket receipts. HMAC-SHA256 with a local-installation key
// (stored in localStorage). This is enough for demo / single-install verification.
// In production with Lovable Cloud, move the key + verify logic to a server function.

const KEY_NAME = "lonani.sign.key";

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function getKey(): Promise<CryptoKey> {
  if (typeof window === "undefined") throw new Error("server context");
  let raw = localStorage.getItem(KEY_NAME);
  if (!raw) {
    const r = new Uint8Array(32);
    crypto.getRandomValues(r);
    raw = b64urlEncode(r);
    localStorage.setItem(KEY_NAME, raw);
  }
  return crypto.subtle.importKey("raw", b64urlDecode(raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

interface Payload { tid: string; lid?: string; ts: number }

export async function signTicketToken(ticketId: string, legId?: string): Promise<string> {
  const payload: Payload = { tid: ticketId, lid: legId, ts: Date.now() };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  // Truncate signature for shorter QR — full 32 bytes is overkill for demo
  const sigShort = b64urlEncode(new Uint8Array(sig).slice(0, 12));
  return `${body}.${sigShort}`;
}

export interface VerifyResult { valid: boolean; ticketId?: string; legId?: string; ts?: number; reason?: string }

export async function verifyTicketToken(token: string): Promise<VerifyResult> {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return { valid: false, reason: "Format invalide" };
    const key = await getKey();
    const fullSig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const expected = b64urlEncode(new Uint8Array(fullSig).slice(0, 12));
    if (expected !== sig) return { valid: false, reason: "Signature invalide" };
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as Payload;
    return { valid: true, ticketId: payload.tid, legId: payload.lid, ts: payload.ts };
  } catch (e) {
    return { valid: false, reason: (e as Error).message };
  }
}