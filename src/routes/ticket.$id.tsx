import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Download, Home, Printer, ShieldCheck, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTickets } from "@/lib/tickets";
import { signTicketToken } from "@/lib/ticket-token.functions";
import { requestCashout } from "@/lib/settlement.functions";
import { useFootFixtures } from "@/lib/foot-fixtures";
import { labelForPick } from "@/lib/foot-markets";
import { cn } from "@/lib/utils";
import { WinConfetti } from "@/components/WinConfetti";

export const Route = createFileRoute("/ticket/$id")({
  head: () => ({
    meta: [
      { title: "Reçu de ticket — Coup Sûr" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TicketPage,
});

function TicketPage() {
  const { id } = useParams({ from: "/ticket/$id" });
  const { t } = useI18n();
  const { getTicket } = useTickets();
  const ticket = getTicket(id);
  const { matches: footMatches } = useFootFixtures();
  const [qr, setQr] = useState<string>("");
  const [cashoutBusy, setCashoutBusy] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    (async () => {
      const { token } = await signTicketToken({ data: { ticketId: ticket.id } });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/verify/${token}`;
      const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 280 });
      setQr(dataUrl);
    })().catch(() => undefined);
  }, [ticket]);

  if (!ticket) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-muted-foreground">{t("account.ticketNotFound")}</p>
        <Link to="/" className="mt-4 inline-flex items-center gap-1.5 text-primary font-semibold">
          <Home className="h-4 w-4" /> {t("backHome")}
        </Link>
      </div>
    );
  }

  const isWin = ticket.status === "winning" || ticket.status === "paid";
  const legs = ticket.legs ?? [];
  const winningLegs = legs.filter((l) => l.status === "winning" || l.status === "paid").length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 print:p-0">
      {isWin && <WinConfetti />}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-elevated print:shadow-none print:border-0">
        <div className="relative bg-hero px-6 py-6 text-white">
          <div className="text-xs uppercase tracking-widest text-white/70">
            {t("receipt")} • {ticket.gameName}
          </div>
          <div className="font-display text-2xl font-bold">Coup Sûr</div>
          {ticket.drawName && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-bold text-gold">
              {ticket.drawName}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gold" />
            <span className="text-xs text-white/80">{t("account.officialReceipt")}</span>
          </div>
        </div>

        {isWin && (
          <div className="relative flex items-center gap-3 overflow-hidden border-b border-success/30 bg-gradient-to-r from-success/15 via-success/10 to-success/15 px-6 py-4 text-success">
            <span className="cs-win-shine absolute inset-0" aria-hidden />
            <div className="cs-win-trophy relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-success/20">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="relative">
              <div className="font-display text-base font-extrabold">{t("winNotice")} 🎉</div>
              {ticket.prize && (
                <div className="text-sm">
                  {t("prizeAmount")} :{" "}
                  <span className="font-bold tabular-nums">
                    {ticket.prize.toLocaleString()} {t("fcfa")}
                  </span>
                  {legs.length > 1 ? ` · ${winningLegs}/${legs.length} ${t("winningLegs")}` : ""}
                </div>
              )}
            </div>
            <style>{WIN_BANNER_CSS}</style>
          </div>
        )}

        <div className="grid gap-6 px-6 py-6 sm:grid-cols-[1fr_auto]">
          <dl className="space-y-3 text-sm">
            <Row
              label={t("ticketNumber")}
              value={<span className="font-mono font-bold">{ticket.id}</span>}
            />
            <Row
              label={`${t("firstName")} / ${t("lastName")}`}
              value={[ticket.firstName, ticket.lastName].filter(Boolean).join(" ") || "—"}
            />
            <Row label={t("phone")} value={ticket.phone} />
            {ticket.email && <Row label={t("email")} value={ticket.email} />}
            {legs.length > 1 ? (
              <Row
                label={`${legs.length} ${t("legs")}`}
                value={
                  <ul className="space-y-2">
                    {legs.map((l, i) => (
                      <li
                        key={l.legId}
                        className="rounded-xl border border-border bg-secondary/40 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                            {t("grid")} {i + 1}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                              l.status === "winning" || l.status === "paid"
                                ? "bg-success/15 text-success"
                                : l.status === "losing"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-secondary text-secondary-foreground",
                            )}
                          >
                            {l.status}
                          </span>
                        </div>
                        <div className="mt-1 text-sm">{l.picksLabel}</div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{l.drawName ?? ""}</span>
                          <span className="font-display font-bold tabular-nums">
                            {l.stake.toLocaleString()} {t("fcfa")}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                }
              />
            ) : (
              <Row
                label={
                  ticket.gameId === "loto"
                    ? t("numbers")
                    : ticket.gameId === "pmu"
                      ? t("horses")
                      : t("matches")
                }
                value={<span className="whitespace-pre-wrap">{ticket.picksLabel}</span>}
              />
            )}
            {ticket.gameId === "foot" && ticket.footPickStatuses?.length ? (
              <Row
                label={t("matches")}
                value={
                  <ul className="space-y-1.5">
                    {ticket.footPickStatuses.map((pick, index) => {
                      const match = footMatches.find((m) => m.id === pick.fixtureId);
                      const key = `${pick.fixtureId}:${pick.marketId}:${pick.selection}`;
                      const label = match ? labelForPick(key, match) : key;
                      const color =
                        pick.status === "winning" || pick.status === "paid"
                          ? "border-success/30 bg-success/10 text-success"
                          : pick.status === "losing"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-border bg-secondary/30 text-muted-foreground";
                      return (
                        <li
                          key={`${key}-${index}`}
                          className={cn("rounded-xl border px-3 py-2", color)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-xs font-semibold">{label}</span>
                            <span className="shrink-0 text-[10px] font-bold uppercase">
                              {pick.status}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[10px] font-bold tabular-nums opacity-80">
                            ×{pick.odds.toFixed(2)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                }
              />
            ) : null}
            <Row
              label={t("totalStake")}
              value={
                <span className="font-display text-lg font-bold">
                  {ticket.stake.toLocaleString()} {t("fcfa")}
                </span>
              }
            />
            <Row label={t("payment")} value={ticket.payment} />
            <Row label={t("drawDate")} value={new Date(ticket.drawDate).toLocaleString("fr-FR", { timeZone: "Africa/Niamey" })} />
            <Row label={t("status")} value={<StatusBadge status={ticket.status} />} />
          </dl>

          <div className="flex flex-col items-center justify-start gap-2">
            {qr && (
              <img
                src={qr}
                alt="QR"
                className="h-40 w-40 rounded-xl border border-border bg-white p-2"
              />
            )}
            <div className="text-[10px] text-muted-foreground">{t("account.verifiableQR")}</div>
          </div>
        </div>
      </div>

      {ticket.status === "winning" && (ticket.prize ?? 0) > 0 && (
        <div className="mt-5 rounded-2xl border border-success/30 bg-success/10 p-4 print:hidden">
          <div className="text-sm font-bold text-success">{t("ticket.winningsAvailable")}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Le bouton d'encaissement n'apparaît que pour un coupon entièrement gagnant.
          </p>
          <button
            type="button"
            disabled={cashoutBusy}
            onClick={async () => {
              setCashoutBusy(true);
              try {
                await requestCashout({ data: { code: ticket.id } });
                toast.success(t("ticket.cashoutSaved"));
                window.location.reload();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : t("ticket.cashoutFailed"));
              } finally {
                setCashoutBusy(false);
              }
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-success px-4 py-3 font-bold text-success-foreground shadow-soft disabled:opacity-50"
          >
            {cashoutBusy ? t("ticket.cashoutProcessing") : t("ticket.cashoutAction")}
          </button>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2 print:hidden">
        <button
          onClick={async () => {
            const { downloadTicketPdf } = await import("@/lib/receipt-pdf");
            await downloadTicketPdf(ticket);
          }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-bold text-primary-foreground shadow-soft hover:brightness-105"
        >
          <Download className="h-4 w-4" /> {t("download")}
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 font-semibold hover:border-primary"
        >
          <Printer className="h-4 w-4" /> {t("print")}
        </button>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 font-semibold hover:border-primary"
        >
          <Home className="h-4 w-4" /> {t("backHome")}
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 sm:grid-cols-[140px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-secondary text-secondary-foreground",
    losing: "bg-muted text-muted-foreground",
    winning: "bg-success/15 text-success",
    paid: "bg-success text-success-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider",
        map[status],
      )}
    >
      {status}
    </span>
  );
}

const WIN_BANNER_CSS = `
@keyframes cs-win-trophy-bounce {
  0%, 100% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(1.12) rotate(-8deg); }
  50% { transform: scale(1) rotate(0deg); }
  75% { transform: scale(1.08) rotate(6deg); }
}
@keyframes cs-win-shine-sweep {
  0% { transform: translateX(-120%) skewX(-20deg); }
  100% { transform: translateX(220%) skewX(-20deg); }
}
.cs-win-trophy { animation: cs-win-trophy-bounce 1.8s ease-in-out 300ms 2; }
.cs-win-shine {
  background: linear-gradient(100deg, transparent, oklch(1 0 0 / 0.35) 45%, transparent 70%);
  width: 40%;
  animation: cs-win-shine-sweep 1.4s ease-out 500ms 1;
}
@media (prefers-reduced-motion: reduce) {
  .cs-win-trophy, .cs-win-shine { animation: none !important; }
}
`;
