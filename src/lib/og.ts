/** Origine publique utilisée pour construire les URLs absolues d'og:image.
 *  Les crawlers sociaux (Facebook, WhatsApp, Twitter, LinkedIn) exigent
 *  une URL absolue https:// — un chemin relatif est ignoré silencieusement. */
export const SITE_ORIGIN = "https://coupsur.ne";

/** Construit une URL absolue pour un pointeur d'asset Lovable. */
export function absoluteOgUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}