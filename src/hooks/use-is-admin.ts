import { useEffect, useState } from "react";
import { checkIsAdmin } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";

/**
 * Retourne le statut admin de l'utilisateur courant.
 * `null` tant que la vérification est en cours (évite tout flash du bouton Admin).
 */
export function useIsAdmin(): boolean | null {
  const { authed, session } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!authed || !session) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { isAdmin: result } = await checkIsAdmin();
        if (!cancelled) setIsAdmin(result);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, session]);

  return isAdmin;
}
