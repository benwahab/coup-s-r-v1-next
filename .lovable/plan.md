## Objectif

Quand quelqu'un partage le lien du site (WhatsApp, Facebook, SMS, iMessage, X…), afficher le logo **Coup Sûr** que tu as envoyé au lieu de l'aperçu générique actuel.

## Étapes

1. **Uploader le logo sur le CDN Lovable**
   - Fichier source : `logo_coup_sur.png` (déjà reçu dans le chat)
   - Destination : `src/assets/og-coup-sur.png.asset.json` via `lovable-assets`

2. **Ajouter `og:image` + `twitter:image` sur la page d'accueil**
   - Fichier : `src/routes/index.tsx` (route `/`, page partagée par défaut)
   - Ajout dans `head().meta` :
     - `og:image` → URL absolue du logo sur le CDN
     - `og:image:width` / `og:image:height` (dimensions du logo)
     - `og:image:alt` = "Coup Sûr — Loterie Nationale du Niger"
   - Passer `twitter:card` de `summary` à `summary_large_image` dans `src/routes/__root.tsx` et ajouter `twitter:image` sur la home.

3. **URL absolue**
   - Les crawlers (Facebook, WhatsApp…) exigent une URL `https://` absolue.
   - Utilisation de l'URL stable de publication Lovable : `https://project--d012cc30-70a9-4deb-91e9-b223040ce8ed.lovable.app` + chemin CDN du logo.
   - Cette URL reste valide même après un renommage du projet et pointe toujours vers la dernière version publiée.

## Ce qui n'est PAS modifié

- Aucune modification visuelle du site, aucune logique métier, aucun changement de texte.
- Le logo n'est ajouté que comme métadonnée de partage — pas affiché dans l'UI existante.

## Remarque importante à te transmettre après la mise en place

Les plateformes (WhatsApp, Facebook…) **mettent en cache** l'ancienne image de prévisualisation. Le nouveau logo n'apparaîtra pas immédiatement dans les liens déjà partagés. Pour forcer le rafraîchissement :
- **Facebook/Instagram** : passer l'URL dans le [Sharing Debugger](https://developers.facebook.com/tools/debug/) puis cliquer "Scrape Again".
- **WhatsApp/iMessage** : partager depuis un nouveau contact ou attendre ~24 h.
- Le site doit avoir été **publié au moins une fois** pour que les crawlers puissent lire l'image (l'URL preview n'est pas indexable).
