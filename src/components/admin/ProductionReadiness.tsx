import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  superAdminGetProductionReadiness,
  type ReadinessCheck,
} from "@/lib/admin.functions";

export function ProductionReadiness() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ready: boolean; checks: ReadinessCheck[]; checkedAt: string } | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await superAdminGetProductionReadiness());
    } catch {
      setError("Vérification impossible. Seul le super administrateur peut la lancer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-4 rounded-lg border border-border bg-card p-4" aria-labelledby="readiness-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="readiness-title" className="font-display text-lg font-bold text-foreground">
            Prêt pour la production ?
          </h2>
          {result && (
            <p className={`text-sm font-semibold ${result.ready ? "text-primary" : "text-destructive"}`}>
              {result.ready ? "Oui, tout est prêt." : "Non, des points restent à régler."}
            </p>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {result ? "Revérifier" : "Vérifier"}
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {result && (
        <ul className="mt-3 space-y-2">
          {result.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              {c.status === "ok" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : c.status === "warning" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              )}
              <span>
                <span className="font-semibold text-foreground">{c.label} : </span>
                <span className="text-muted-foreground">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
