// Server-only HMAC helpers for signing ticket receipts.
// Blocked from client bundles by the *.server.* filename convention.

const encoder = new TextEncoder();

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

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.TICKET_HMAC_SECRET;
  if (!secret) throw new Error("TICKET_HMAC_SECRET missing");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

interface Payload { tid: string; lid?: string; ts: number }

export async function signTicketTokenServer(ticketId: string, legId?: string): Promise<string> {
  const payload: Payload = { tid: ticketId, lid: legId, ts: Date.now() };
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const sigShort = b64urlEncode(new Uint8Array(sig).slice(0, 12));
  return `${body}.${sigShort}`;
}

export interface VerifyResult { valid: boolean; ticketId?: string; legId?: string; ts?: number; reason?: string }

export async function verifyTicketTokenServer(token: string): Promise<VerifyResult> {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return { valid: false, reason: "Format invalide" };
    const key = await getHmacKey();
    const fullSig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expected = b64urlEncode(new Uint8Array(fullSig).slice(0, 12));
    if (expected !== sig) return { valid: false, reason: "Signature invalide" };
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as Payload;
    return { valid: true, ticketId: payload.tid, legId: payload.lid, ts: payload.ts };
  } catch (e) {
    return { valid: false, reason: (e as Error).message };
  }
}