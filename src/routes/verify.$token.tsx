import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Home, ShieldCheck, ShieldX, Trophy } from "lucide-react";
import { useTickets } from "@/lib/tickets";
import { verifyTicketToken } from "@/lib/ticket-token.functions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/verify/$token")({
  head: () => ({
    meta: [{ title: "Vérification de ticket — Coup Sûr" }, { name: "robots", content: "noindex" }],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { t } = useI18n();
  const { token } = useParams({ from: "/verify/$token" });
  const { getTicket } = useTickets();
  const [state, setState] = useState<"loading" | "valid" | "invalid">("loading");
  const [reason, setReason] = useState<string>("");
  const [ticketId, setTicketId] = useState<string>("");
  const [legId, setLegId] = useState<string | undefined>();
  const [ts, setTs] = useState<number | undefined>();

  useEffect(() => {
    verifyTicketToken({ data: { token } }).then((r) => {
      if (!r.valid) {
        setState("invalid");
        setReason(r.reason || t("verify.invalidToken"));
        return;
      }
      setTicketId(r.ticketId!);
      setLegId(r.legId);
      setTs(r.ts);
      setState("valid");
    });
  }, [token]);

  const ticket = ticketId ? getTicket(ticketId) : undefined;
  const leg = ticket?.legs?.find((l) => l.legId === legId);

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div
        className={cn(
          "rounded-3xl border p-6 shadow-elevated text-center",
          state === "valid"
            ? "border-success/40 bg-success/5"
            : state === "invalid"
              ? "border-destructive/40 bg-destructive/5"
              : "border-border bg-card",
        )}
      >
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-full mb-3"
          style={{
            background:
              state === "valid"
                ? "color-mix(in oklab, var(--success) 15%, transparent)"
                : "color-mix(in oklab, var(--destructive) 15%, transparent)",
          }}
        >
          {state === "valid" ? (
            <ShieldCheck className="h-8 w-8 text-success" />
          ) : state === "invalid" ? (
            <ShieldX className="h-8 w-8 text-destructive" />
          ) : (
            <ShieldCheck className="h-8 w-8 text-muted-foreground animate-pulse" />
          )}
        </div>
        <h1 className="font-display text-2xl font-extrabold">
          {state === "loading"
            ? t("verify.verifying")
            : state === "valid"
              ? t("verify.authentic")
              : t("verify.invalid")}
        </h1>
        {state === "invalid" && <p className="mt-2 text-sm text-muted-foreground">{reason}</p>}
        {state === "valid" && (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("verify.signedOn", { date: ts ? new Date(ts).toLocaleString() : "—" })}
            </p>
            <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-left">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("verify.ticketNumber")}
              </div>
              <div className="font-mono text-sm font-bold">{ticketId}</div>
              {ticket ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {t("verify.game")}
                      </div>
                      <div className="font-bold">{leg?.gameName ?? ticket.gameName}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {t("verify.draw")}
                      </div>
                      <div className="font-bold">{leg?.drawName ?? ticket.drawName ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {t("verify.stake")}
                      </div>
                      <div className="font-display font-extrabold tabular-nums">
                        {(leg?.stake ?? ticket.stake).toLocaleString()} FCFA
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {t("verify.status")}
                      </div>
                      <div
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          (leg?.status ?? ticket.status) === "winning" ||
                            (leg?.status ?? ticket.status) === "paid"
                            ? "bg-success/20 text-success"
                            : (leg?.status ?? ticket.status) === "losing"
                              ? "bg-muted text-muted-foreground"
                              : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {leg?.status ?? ticket.status}
                      </div>
                    </div>
                  </div>
                  {(leg?.status === "winning" ||
                    leg?.status === "paid" ||
                    ticket.status === "winning" ||
                    ticket.status === "paid") && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-success">
                      <Trophy className="h-4 w-4" />
                      <span className="text-sm font-bold">
                        {t("verify.prizeAmount", {
                          amount: (leg?.prize ?? ticket.prize ?? 0).toLocaleString(),
                        })}
                      </span>
                    </div>
                  )}
                  <div className="mt-3">
                    <Link
                      to="/ticket/$id"
                      params={{ id: ticketId }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary underline"
                    >
                      <Check className="h-3.5 w-3.5" /> {t("verify.viewFullReceipt")}
                    </Link>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">{t("verify.notFoundLocally")}</p>
              )}
            </div>
          </>
        )}
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center gap-1.5 text-sm font-bold text-muted-foreground"
        >
          <Home className="h-4 w-4" /> {t("home")}
        </Link>
      </div>
    </div>
  );
}
