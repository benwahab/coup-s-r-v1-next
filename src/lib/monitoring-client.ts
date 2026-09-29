import { ingestClientEvents } from "@/lib/monitoring.ingest.functions";

export interface ClientCall {
  traceId: string;
  fnId: string;
  method: string;
  durationMs: number;
  ok: boolean;
  message?: string;
}

type BufferedCall = ClientCall & { page: string; device: string; appVersion: string; userAgent: string };
const buffer: BufferedCall[] = [];
let flushTimer: number | null = null;
let flushing = false;

function scheduleFlush() {
  if (flushTimer !== null || typeof window === "undefined") return;
  flushTimer = window.setTimeout(() => { flushTimer = null; void flush(); }, 3000);
}

async function flush() {
  if (flushing || buffer.length === 0) return;
  flushing = true;
  const batch = buffer.splice(0, 20);
  try {
    await ingestClientEvents({ data: { events: batch } });
  } catch {
    buffer.unshift(...batch.slice(0, 10));
  } finally {
    flushing = false;
    if (buffer.length) scheduleFlush();
  }
}

export function recordClientCall(call: ClientCall): void {
  if (typeof window === "undefined") return;
  buffer.push({
    ...call,
    page: window.location.pathname.slice(0, 200),
    device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
    appVersion: document.documentElement.dataset.appVersion ?? "v1",
    userAgent: navigator.userAgent.slice(0, 500),
  });
  while (buffer.length > 50) buffer.shift();
  if (buffer.length >= 10) void flush();
  else scheduleFlush();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => { void flush(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flush(); });
}
