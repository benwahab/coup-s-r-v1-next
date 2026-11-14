import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { adminCompleteCashoutRequest, adminListCashoutRequests } from "@/lib/cashout.functions";
import { formatFcfa } from "@/lib/utils";

type CashoutRequest = {
  id: string; ticket_code: string; prize: number; status: "pending" | "completed";
  requested_at: string; completed_at: string | null; provider_reference: string | null;
  player_name?: string | null; player_phone?: string | null; region?: string | null;
};

export function CashoutsTab() {
  const [requests, setRequests] = useState<CashoutRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [referenceById, setReferenceById] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminListCashoutRequests();
      setRequests(result.requests as CashoutRequest[]);
      setPendingCount(result.pendingCount);
      setCompletedCount(result.completedCount);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de charger les encaissements.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const complete = async (request: CashoutRequest) => {
    if (!window.confirm("Confirmez-vous que le gain de ce ticket a réellement été remis au joueur ?")) return;
    setBusyId(request.id);
    setMessage(null);
    try {
      await adminCompleteCashoutRequest({ data: {
        requestId: request.id,
        providerReference: referenceById[request.id]?.trim() || undefined,
      } });
      setMessage("Encaissement confirmé. Le ticket est maintenant marqué comme payé.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de confirmer cet encaissement.");
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-500/30 bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Clock3 className="h-4 w-4" /> Encaissements en attente</div>
          <div className="mt-2 text-3xl font-extrabold tabular-nums">{pendingCount}</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> Encaissements effectués</div>
          <div className="mt-2 text-3xl font-extrabold tabular-nums">{completedCount}</div>
        </div>
      </section>
      <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">Suivi des encaissements</h2><p className="mt-1 text-xs text-muted-foreground">Chaque demande concerne un seul ticket gagnant.</p></div>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Actualiser
          </button>
        </div>
        {message && <p role="status" className="mt-3 rounded-xl border border-border p-3 text-sm">{message}</p>}
        {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Chargement des demandes…</p> :
          requests.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Aucune demande d'encaissement pour le moment.</p> :
          <div className="mt-4 space-y-3">
            {requests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-bold">{request.ticket_code}</p>
                    <p className="mt-1 text-sm">{request.player_name || "Joueur"} · {request.player_phone || "Téléphone non renseigné"}</p>
                    <p className="text-xs text-muted-foreground">{request.region || "Région non renseignée"} · Demande du {new Date(request.requested_at).toLocaleString("fr-FR", { timeZone: "Africa/Niamey" })}</p>
                  </div>
                  <span className={request.status === "pending" ? "rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700" : "rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700"}>
                    {request.status === "pending" ? "En attente" : "Effectué"}
                  </span>
                </div>
                <p className="mt-3 text-xl font-extrabold tabular-nums">{formatFcfa(request.prize)} FCFA</p>
                {request.status === "pending" ? (
                  <div className="mt-3 space-y-2">
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Référence du paiement (facultatif)
                      <input value={referenceById[request.id] ?? ""} onChange={(event) => setReferenceById((prev) => ({ ...prev, [request.id]: event.target.value }))} maxLength={200} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="Référence de transaction ou reçu" />
                    </label>
                    <button type="button" disabled={busyId !== null} onClick={() => void complete(request)} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
                      {busyId === request.id ? "Confirmation…" : "Confirmer l'encaissement effectué"}
                    </button>
                    <p className="text-[11px] text-muted-foreground">À confirmer uniquement après remise réelle du gain au joueur.</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Effectué le {request.completed_at ? new Date(request.completed_at).toLocaleString("fr-FR", { timeZone: "Africa/Niamey" }) : "—"}
                    {request.provider_reference ? " · Référence : " + request.provider_reference : ""}
                  </p>
                )}
              </article>
            ))}
          </div>
        }
      </section>
    </div>
  );
}
