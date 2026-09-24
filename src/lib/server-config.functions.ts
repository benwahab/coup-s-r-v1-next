import { createServerFn } from "@tanstack/react-start";

/** Indique si le serveur dispose de la configuration nécessaire à l'authentification. N'expose aucune valeur. */
export const getServerConfigStatus = createServerFn({ method: "GET" }).handler(async () => {
  const missing: string[] = [];
  if (!process.env["SUPABASE_URL"]) missing.push("adresse du serveur");
  if (!process.env["SUPABASE_PUBLISHABLE_KEY"]) missing.push("clé publique");
  if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) missing.push("clé serveur");
  return { ready: missing.length === 0, missing };
});
