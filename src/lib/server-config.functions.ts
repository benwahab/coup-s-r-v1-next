import { createServerFn } from "@tanstack/react-start";

type ServerConfigEnv = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};

/**
 * Vérifie la configuration Supabase côté serveur sans exposer aucune valeur.
 *
 * Un Server Function s'exécute dans le runtime serveur : les variables serveur
 * doivent donc être lues dans le handler, au moment de la requête.
 */
export const getServerConfigStatus = createServerFn({ method: "GET" }).handler(async () => {
  const env = process.env as ServerConfigEnv;
  const missing: string[] = [];

  if (!env.SUPABASE_URL) missing.push("adresse du serveur");
  if (!env.SUPABASE_PUBLISHABLE_KEY) missing.push("clé publique");

  return { ready: missing.length === 0, missing };
});
