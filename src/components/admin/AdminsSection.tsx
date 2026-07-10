import { useEffect, useState } from "react";
import { ShieldCheck, ShieldMinus, ShieldPlus, Loader2 } from "lucide-react";
import { adminListAdmins, adminGrantRole, adminRevokeRole } from "@/lib/admin.functions";

interface AdminRow {
  userId: string;
  grantedAt: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
}

export function AdminsSection() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { admins: rows } = await adminListAdmins();
      setAdmins(rows);
    } catch {
      setMessage({ kind: "error", text: "Impossible de charger la liste des administrateurs." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grant = async () => {
    setMessage(null);
    if (!/^\d{8}$/.test(phone)) { setMessage({ kind: "error", text: "Numéro invalide (8 chiffres attendus)." }); return; }
    setBusy(true);
    try {
      const res = await adminGrantRole({ data: { phone } });
      if (!res.ok) {
        setMessage({ kind: "error", text: "Aucun compte trouvé pour ce numéro. La personne doit d'abord s'être connectée au moins une fois sur l'app." });
      } else {
        setMessage({ kind: "success", text: "Accès admin accordé." });
        setPhone("");
        await load();
      }
    } catch {
      setMessage({ kind: "error", text: "Échec de l'opération." });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (userId: string) => {
    setMessage(null);
    setBusy(true);
    try {
      const res = await adminRevokeRole({ data: { userId } });
      if (!res.ok) {
        setMessage({ kind: "error", text: "Vous ne pouvez pas retirer votre propre accès admin." });
      } else {
        await load();
      }
    } catch {
      setMessage({ kind: "error", text: "Échec de l'opération." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold">Gestion des administrateurs</h2>
      </div>
      <p className="text-xs text-muted-foreground">Donnez ou retirez l'accès au panneau admin à un compte existant.</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="Numéro (8 chiffres)"
          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs"
        />
        <button
          type="button"
          disabled={busy}
          onClick={grant}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldPlus className="h-3.5 w-3.5" />}
          Donner l'accès admin
        </button>
      </div>

      {message && (
        <p className={message.kind === "error" ? "mt-2 text-xs font-semibold text-destructive" : "mt-2 text-xs font-semibold text-success"}>
          {message.text}
        </p>
      )}

      <div className="mt-4 divide-y divide-border rounded-2xl border border-border">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Chargement…</div>
        ) : admins.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Aucun administrateur trouvé.</div>
        ) : (
          admins.map((a) => (
            <div key={a.userId} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {a.firstName || a.lastName ? `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() : "Sans nom"}
                </div>
                <div className="text-[11px] text-muted-foreground">{a.phone ?? "—"}</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => revoke(a.userId)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/30 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <ShieldMinus className="h-3.5 w-3.5" /> Retirer
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
