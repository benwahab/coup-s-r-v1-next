import { Search, X } from "lucide-react";
import { cn, formatFcfa } from "@/lib/utils";
import { statusColor } from "../shared";
import type { Ticket } from "@/lib/tickets";
import type { AuthEvent } from "@/lib/auth-logs";
import type { PaymentIntent } from "@/lib/payments";

interface Draft { id: string; gameName: string; totalStake: number }

interface Claim {
  tickets: Ticket[];
  drafts: Draft[];
  authEvents: AuthEvent[];
  intents: PaymentIntent[];
}

interface Props {
  claimPhone: string; setClaimPhone: (v: string) => void;
  claim: Claim | null;
  updateStatus: (id: string, status: Ticket["status"], prize?: number) => void;
  removeDraft: (id: string) => void;
}

export function ClaimsTab({ claimPhone, setClaimPhone, claim, updateStatus, removeDraft }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Réclamations — recherche par numéro</h2>
        <p className="text-xs text-muted-foreground">Consultez l'historique complet du joueur.</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={claimPhone} onChange={(e) => setClaimPhone(e.target.value)} placeholder="ex. +227 90 12 34 56" className="w-full rounded-2xl border border-border bg-background pl-10 pr-3 py-2.5 text-sm" />
          </div>
          {claimPhone && (
            <button onClick={() => setClaimPhone("")} aria-label="Effacer la recherche" className="rounded-full border border-border bg-background p-2 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
          )}
        </div>
      </div>
      {claim && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card shadow-soft">
            <div className="border-b border-border px-5 py-3"><h3 className="font-display font-bold">Tickets ({claim.tickets.length})</h3></div>
            {claim.tickets.length === 0 ? <p className="p-5 text-xs text-muted-foreground">Aucun ticket.</p> : (
              <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                {claim.tickets.map((tk) => (
                  <li key={tk.id} className="p-3 text-xs">
                    <div className="flex items-center justify-between"><span className="font-mono font-bold">{tk.id}</span><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", statusColor[tk.status])}>{tk.status}</span></div>
                    <div className="mt-0.5 text-muted-foreground truncate">{tk.gameName} · {formatFcfa(tk.stake)} FCFA</div>
                    <div className="mt-1 flex gap-1.5">
                      <button onClick={() => updateStatus(tk.id, "paid", tk.prize ?? tk.stake * 12)} className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">Marquer payé</button>
                      <button onClick={() => updateStatus(tk.id, "losing")} className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">Annuler</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-3xl border border-border bg-card shadow-soft">
            <div className="border-b border-border px-5 py-3"><h3 className="font-display font-bold">Brouillons ({claim.drafts.length})</h3></div>
            {claim.drafts.length === 0 ? <p className="p-5 text-xs text-muted-foreground">Aucun brouillon.</p> : (
              <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                {claim.drafts.map((d) => (
                  <li key={d.id} className="p-3 text-xs flex items-center justify-between">
                    <div className="min-w-0"><div className="font-mono font-bold">{d.id}</div><div className="text-muted-foreground truncate">{d.gameName} · {formatFcfa(d.totalStake)} FCFA</div></div>
                    <button onClick={() => removeDraft(d.id)} className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">Supprimer</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-3xl border border-border bg-card shadow-soft">
            <div className="border-b border-border px-5 py-3"><h3 className="font-display font-bold">Événements auth ({claim.authEvents.length})</h3></div>
            {claim.authEvents.length === 0 ? <p className="p-5 text-xs text-muted-foreground">Aucun événement.</p> : (
              <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                {claim.authEvents.map((e, i) => (
                  <li key={i} className="p-3 text-xs flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{new Date(e.at).toLocaleString("fr-FR", { hour12: false })}</span>
                    <span className="font-bold">{e.kind}</span>
                    <span className="font-mono text-muted-foreground">{e.ip}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-3xl border border-border bg-card shadow-soft">
            <div className="border-b border-border px-5 py-3"><h3 className="font-display font-bold">Paiements ({claim.intents.length})</h3></div>
            {claim.intents.length === 0 ? <p className="p-5 text-xs text-muted-foreground">Aucun paiement.</p> : (
              <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                {claim.intents.map((p) => (
                  <li key={p.txRef} className="p-3 text-xs flex items-center justify-between gap-2">
                    <span className="font-mono">{p.txRef}</span>
                    <span className="tabular-nums font-bold">{formatFcfa(p.amount)} FCFA</span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      p.status === "confirmed" ? "bg-success/15 text-success" :
                      p.status === "failed" ? "bg-destructive/15 text-destructive" :
                      "bg-secondary text-muted-foreground",
                    )}>{p.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}