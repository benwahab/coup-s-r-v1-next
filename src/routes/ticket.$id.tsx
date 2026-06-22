import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Home, Printer, ShieldCheck, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTickets } from "@/lib/tickets";
import { downloadTicketPdf } from "@/lib/receipt-pdf";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ticket/$id")({
  head: () => ({ meta: [{ title: "Reçu de ticket — LoNaNi" }] }),
  component: TicketPage,
});

function TicketPage() {
  const { id } = useParams({ from: "/ticket/$id" });
  const { t } = useI18n();
  const { getTicket } = useTickets();
  const ticket = getTicket(id);
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    if (!ticket) return;
    QRCode.toDataURL(`LONANI|${ticket.id}|${ticket.phone}|${ticket.stake}`, { margin: 1, width: 280 })
      .then(setQr).catch(() => undefined);
  }, [ticket]);

  if (!ticket) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-muted-foreground">Ticket introuvable.</p>
        <Link to="/" className="mt-4 inline-flex items-center gap-1.5 text-primary font-semibold">
          <Home className="h-4 w-4" /> {t("backHome")}
        </Link>
      </div>
    );
  }

  const isWin = ticket.status === "winning" || ticket.status === "paid";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 print:p-0">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-elevated print:shadow-none print:border-0">
        <div className="relative bg-hero px-6 py-6 text-white">
          <div className="text-xs uppercase tracking-widest text-white/70">{t("receipt")} • {ticket.gameName}</div>
          <div className="font-display text-2xl font-bold">LoNaNi — Loterie Nationale du Niger</div>
          <div className="mt-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gold" />
            <span className="text-xs text-white/80">Reçu officiel sécurisé</span>
          </div>
        </div>

        {isWin && (
          <div className="flex items-center gap-3 border-b border-border bg-success/10 px-6 py-4 text-success">
            <Trophy className="h-5 w-5" />
            <div>
              <div className="font-bold">{t("winNotice")}</div>
              {ticket.prize && <div className="text-sm">{t("prizeAmount")} : {ticket.prize.toLocaleString()} {t("fcfa")}</div>}
            </div>
          </div>
        )}

        <div className="grid gap-6 px-6 py-6 sm:grid-cols-[1fr_auto]">
          <dl className="space-y-3 text-sm">
            <Row label={t("ticketNumber")} value={<span className="font-mono font-bold">{ticket.id}</span>} />
            <Row label={`${t("firstName")} / ${t("lastName")}`} value={[ticket.firstName, ticket.lastName].filter(Boolean).join(" ") || "—"} />
            <Row label={t("phone")} value={ticket.phone} />
            {ticket.email && <Row label={t("email")} value={ticket.email} />}
            <Row label={ticket.gameId === "loto" ? t("numbers") : ticket.gameId === "pmu" ? t("horses") : t("matches")} value={<span className="whitespace-pre-wrap">{ticket.picksLabel}</span>} />
            <Row label={t("stake")} value={<span className="font-display text-lg font-bold">{ticket.stake.toLocaleString()} {t("fcfa")}</span>} />
            <Row label={t("payment")} value={ticket.payment} />
            <Row label={t("drawDate")} value={new Date(ticket.drawDate).toLocaleString()} />
            <Row label={t("status")} value={<StatusBadge status={ticket.status} />} />
          </dl>

          <div className="flex flex-col items-center justify-start gap-2">
            {qr && <img src={qr} alt="QR" className="h-40 w-40 rounded-xl border border-border bg-white p-2" />}
            <div className="text-[10px] text-muted-foreground">QR vérifiable</div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 print:hidden">
        <button onClick={() => downloadTicketPdf(ticket)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-bold text-primary-foreground shadow-soft hover:brightness-105">
          <Download className="h-4 w-4" /> {t("download")}
        </button>
        <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 font-semibold hover:border-primary">
          <Printer className="h-4 w-4" /> {t("print")}
        </button>
        <Link to="/" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 font-semibold hover:border-primary">
          <Home className="h-4 w-4" /> {t("backHome")}
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 sm:grid-cols-[140px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</dt>
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
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider", map[status])}>{status}</span>;
}