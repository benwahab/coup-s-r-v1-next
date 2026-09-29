// Collecte côté navigateur (tampon local). L'envoi vers le serveur n'est pas encore branché.
export interface ClientCall {
  traceId: string;
  fnId: string;
  method: string;
  durationMs: number;
  ok: boolean;
  message?: string;
}

const buffer: ClientCall[] = [];

export function recordClientCall(call: ClientCall): void {
  if (typeof window === "undefined") return;
  buffer.push(call);
  if (buffer.length > 50) buffer.shift();
}
