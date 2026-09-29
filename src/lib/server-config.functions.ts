import { createServerFn } from "@tanstack/react-start";

/** Indique si le serveur dispose de la configuration nécessaire à l'authentification. N'expose aucune valeur. */
export const getServerConfigStatus = createServerFn({ method: "GET" }).handler(async () => {
  const missing: string[] = [];
  if (!import.meta.env.VITE_SUPABASE_URL) missing.push("adresse du serveur");
  if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) missing.push("clé publique");
  return { ready: missing.length === 0, missing };
});
