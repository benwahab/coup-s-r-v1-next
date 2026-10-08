import { useEffect, useState } from "react";
import { ShieldCheck, ShieldMinus, ShieldPlus, Loader2, Crown } from "lucide-react";
import {
  adminListAdmins,
  adminGrantRole,
  adminRevokeRole,
  adminSetPermissions,
  checkIsSuperAdmin,
  transferSuperAdminOwnership,
  type AdminPermission,
} from "@/lib/admin.functions";
import { useI18n } from "@/lib/i18n";

interface AdminRow {
  userId: string;
  grantedAt: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  permissions: string[];
}

const PERMISSIONS: { id: AdminPermission; label: string; description: string }[] = [
  { id: "complaints", label: "Réclamations", description: "Traiter les réclamations attribuées" },
  {
    id: "player_activity",
    label: "Activités joueurs",
    description: "Voir les transactions et activités de jeu nécessaires au suivi opérationnel",
  },
  {
    id: "ball_stats",
    label: "Statistiques des boules",
    description: "Consulter les statistiques des tirages/boules",
  },
  {
    id: "publish_results",
    label: "Publication des tirages",
    description: "Saisir et publier les résultats officiels",
  },
  {
    id: "player_stats",
    label: "Statistiques joueurs",
    description: "Consulter les statistiques agrégées des joueurs",
  },
  {
    id: "region_stats",
    label: "Statistiques régions",
    description: "Consulter les statistiques agrégées par région",
  },
  {
    id: "security_logs",
    label: "Journaux sécurité",
    description: "Consulter les journaux de sécurité autorisés",
  },
  {
    id: "supervision",
    label: "Supervision technique",
    description: "Consulter l'état technique, les métriques et les incidents",
  },
  {
    id: "operations",
    label: "Opérations",
    description: "Gérer les horaires et opérations autorisées",
  },
];

export function AdminsSection() {
  const { t: translate } = useI18n();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<AdminPermission[]>([]);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [transferTarget, setTransferTarget] = useState<AdminRow | null>(null);
  const [transferConfirmation, setTransferConfirmation] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { isSuperAdmin: ok } = await checkIsSuperAdmin();
      setIsSuperAdmin(ok);
      if (!ok) return;
      const { admins: rows } = await adminListAdmins();
      setAdmins(rows);
    } catch {
      setMessage({ kind: "error", text: translate("admin.admins.loadError") });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grant = async () => {
    setMessage(null);
    if (!/^\d{8}$/.test(phone)) {
      setMessage({ kind: "error", text: translate("admin.admins.invalidPhone") });
      return;
    }
    setBusy(true);
    try {
      const res = await adminGrantRole({ data: { phone } });
      if (!res.ok) {
        setMessage({ kind: "error", text: translate("admin.admins.noAccount") });
      } else {
        setMessage({ kind: "success", text: translate("admin.admins.granted") });
        setPhone("");
        await load();
      }
    } catch {
      setMessage({ kind: "error", text: translate("admin.admins.failed") });
    } finally {
      setBusy(false);
    }
  };

  const savePermissions = async () => {
    if (!selectedAdmin) return;
    setMessage(null);
    setBusy(true);
    try {
      await adminSetPermissions({
        data: { userId: selectedAdmin, permissions: selectedPermissions },
      });
      setMessage({ kind: "success", text: "Permissions mises à jour." });
      await load();
    } catch {
      setMessage({ kind: "error", text: "Impossible de mettre à jour les permissions." });
    } finally {
      setBusy(false);
    }
  };

  const togglePermission = (permission: AdminPermission) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission],
    );
  };

  const transfer = async () => {
    if (!transferTarget || transferConfirmation !== "TRANSFERER") return;
    setMessage(null);
    setBusy(true);
    try {
      await transferSuperAdminOwnership({ data: { targetUserId: transferTarget.userId } });
      setTransferTarget(null);
      setTransferConfirmation("");
      setMessage({
        kind: "success",
        text: "Transfert effectué. Votre compte n'est plus Super Admin.",
      });
    } catch {
      setMessage({ kind: "error", text: "Le transfert n'a pas pu être effectué." });
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
        setMessage({ kind: "error", text: translate("admin.admins.cannotSelfRevoke") });
      } else {
        setSelectedAdmin(null);
        await load();
      }
    } catch {
      setMessage({ kind: "error", text: translate("admin.admins.failed") });
    } finally {
      setBusy(false);
    }
  };

  if (isSuperAdmin === null) {
    return (
      <section
        className="h-24 animate-pulse rounded-3xl border border-border bg-card"
        aria-hidden
      />
    );
  }

  if (!isSuperAdmin) {
    return (
      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-lg font-bold text-muted-foreground">
            {translate("admin.admins.title")}
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{translate("admin.admins.restricted")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold">Gestion des administrateurs</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Un administrateur ordinaire n'a aucun accès global. Attribue-lui uniquement les permissions
        nécessaires.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder={translate("admin.admins.phonePlaceholder")}
          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs"
        />
        <button
          type="button"
          disabled={busy}
          onClick={grant}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldPlus className="h-3.5 w-3.5" />
          )}
          {translate("admin.admins.grantButton")}
        </button>
      </div>

      {message && (
        <p
          className={
            message.kind === "error"
              ? "mt-2 text-xs font-semibold text-destructive"
              : "mt-2 text-xs font-semibold text-success"
          }
        >
          {message.text}
        </p>
      )}

      <div className="mt-4 divide-y divide-border rounded-2xl border border-border">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {translate("admin.admins.loading")}
          </div>
        ) : admins.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {translate("admin.admins.none")}
          </div>
        ) : (
          admins.map((a) => (
            <div
              key={a.userId}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {a.firstName || a.lastName
                    ? `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim()
                    : translate("admin.admins.noName")}
                </div>
                <div className="text-[11px] text-muted-foreground">{a.phone ?? "—"}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {a.permissions.length ? a.permissions.join(" · ") : "Aucune permission attribuée"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setSelectedAdmin(a.userId);
                    setSelectedPermissions(
                      a.permissions.filter((p): p is AdminPermission =>
                        PERMISSIONS.some((x) => x.id === p),
                      ),
                    );
                  }}
                  className="rounded-full border border-primary/30 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  Permissions
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setTransferTarget(a);
                    setTransferConfirmation("");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-500/10 disabled:opacity-50"
                >
                  <Crown className="h-3.5 w-3.5" /> Transférer
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => revoke(a.userId)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <ShieldMinus className="h-3.5 w-3.5" /> {translate("admin.admins.revoke")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {transferTarget && (
        <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-destructive" />
            <h3 className="text-sm font-bold">Transfert de propriété Super Admin</h3>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Vous allez transférer définitivement votre rôle Super Admin à{" "}
            <strong>
              {[transferTarget.firstName, transferTarget.lastName].filter(Boolean).join(" ") ||
                transferTarget.phone ||
                "cet administrateur"}
            </strong>
            . Après confirmation, votre compte perdra le rôle Super Admin.
          </p>
          <p className="mt-2 text-xs font-semibold">Pour confirmer, saisissez TRANSFERER.</p>
          <input
            value={transferConfirmation}
            onChange={(e) =>
              setTransferConfirmation(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z]/g, "")
                  .slice(0, 10),
              )
            }
            placeholder="TRANSFERER"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
            autoComplete="off"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || transferConfirmation !== "TRANSFERER"}
              onClick={transfer}
              className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crown className="h-3.5 w-3.5" />
              )}
              Confirmer le transfert
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setTransferTarget(null);
                setTransferConfirmation("");
              }}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {selectedAdmin && (
        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Accès de l'administrateur</h3>
              <p className="text-[11px] text-muted-foreground">
                Plusieurs permissions peuvent être attribuées. Le tableau de bord complet reste
                réservé au Super Admin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAdmin(null)}
              className="text-xs text-muted-foreground"
            >
              Fermer
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PERMISSIONS.map((permission) => (
              <label
                key={permission.id}
                className="flex cursor-pointer gap-3 rounded-xl border border-border bg-card p-3"
              >
                <input
                  type="checkbox"
                  checked={selectedPermissions.includes(permission.id)}
                  onChange={() => togglePermission(permission.id)}
                />
                <span>
                  <span className="block text-xs font-bold">{permission.label}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {permission.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={savePermissions}
            className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            Enregistrer les permissions
          </button>
        </div>
      )}
    </section>
  );
}
