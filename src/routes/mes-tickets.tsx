import { createFileRoute, Link } from "@tanstack/react-router";
import { Ticket as TicketIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTickets } from "@/lib/tickets";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mes-tickets")({
  head: () => ({ meta: [{ title: "Mes tickets — LoNaNi" }] }),
  component: TicketsPage,
});

const statusColor: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  losing: "bg-muted text-muted-foreground",
  winning: "bg-success/15 text-success",
  paid: "bg-success text-success-foreground",
};

function TicketsPage() {
  const { t } = useI18n();
  const { tickets } = useTickets();

  return (
    <>
      <PageHeader title={t("myTickets")} icon={<TicketIcon className="h-5 w-5" />} />
      <div className="mx-auto max-w-3xl px-4 py-4">
        {tickets.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">{t("noTickets")}</p>
            <Link to="/" className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-primary-foreground shadow-soft">
              {t("startPlaying")}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {tickets.map((tk) => (
              <li key={tk.id}>
                <Link
                  to="/ticket/$id"
                  params={{ id: tk.id }}
                  className="block rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elevated"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{tk.gameName}</div>
                      <div className="font-mono text-sm font-bold">{tk.id}</div>
                      <div className="mt-1 truncate text-sm text-muted-foreground">{tk.picksLabel}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg font-bold tabular-nums">{tk.stake.toLocaleString()} {t("fcfa")}</div>
                      <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", statusColor[tk.status])}>
                        {tk.status}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}