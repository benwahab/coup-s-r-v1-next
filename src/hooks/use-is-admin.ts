import { useEffect, useState } from "react";
import { checkIsAdmin } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";

type AdminCheckState = "checking" | "allowed" | "denied" | "error";

/**
 * Vérifie les droits du compte connecté sans jamais accorder l'accès en cas d'erreur.
 * L'état d'erreur est exposé à l'interface pour distinguer un refus d'accès
 * d'un problème de session ou d'appel serveur.
 */
export function useIsAdmin(): { isAdmin: boolean; verificationFailed: boolean } {
  const { authed, session } = useAuth();
  const userId = session?.userId;
  const [state, setState] = useState<AdminCheckState>("checking");

  useEffect(() => {
    if (!authed || !userId) {
      setState("denied");
      return;
    }

    let cancelled = false;
    setState("checking");

    (async () => {
      try {
        const { isAdmin } = await checkIsAdmin();
        if (!cancelled) setState(isAdmin ? "allowed" : "denied");
      } catch (error) {
        console.error("[Coup Sûr] Échec de vérification des droits administrateur.", error);
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authed, userId]);

  return {
    isAdmin: state === "allowed",
    verificationFailed: state === "error",
  };
}
