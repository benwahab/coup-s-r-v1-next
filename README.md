# Coup Sûr V1 - Next

Créer un nouveau projet Lovable nommé « Coup Sûr V1 ».

IMPORTANT : ce projet est NOUVEAU et indépendant de l’ancien projet Lovable Coup Sûr. Ne modifie, ne remixe et ne supprime jamais l’ancien projet.

Le projet de référence est le dépôt GitHub privé benwahab/Coup-sur, branche security/hardening-production-foundation. Cette branche est désormais la référence de Coup Sûr et contient le frontend et le backend existants ainsi que la fondation Supabase sécurisée.

Objectif de cette première étape : préparer Coup Sûr V1 comme nouveau frontend Lovable en conservant l’architecture métier et les règles serveur existantes. Connecter le projet au dépôt/branche de référence si l’intégration GitHub est disponible. Ne pas réécrire ni affaiblir les fonctions backend de sécurité existantes.

Backend canonique à utiliser : Supabase project gisjxogimycghgkxedif (eu-central-1). Ne jamais utiliser l’ancien projet Supabase yfiragxuyvasboufffpa.

Le frontend doit respecter l’identité Coup Sûr : professionnel, moderne, adapté au Niger, responsive mobile-first, Space Grotesk pour les titres, Manrope pour le texte, vert émeraude profond, orange CTA #FF8A00, cartes modernes et lisibles.

Fonctionnalités à préserver/intégrer dans l’interface : accueil, authentification, PMU, Loto, Pari Foot, panier/ticket, mes tickets, résultats, compte utilisateur et espace administration selon les permissions existantes.

Ne crée aucune fausse donnée métier ni faux paiement. Les données doivent venir du backend réel ou afficher explicitement un état vide/en attente.

Pour cette première construction, privilégie la connexion correcte au dépôt de référence et au Supabase canonique avant les améliorations visuelles. Ne touche pas au dépôt GitHub ni à l’ancien projet Lovable autrement que via l’intégration nécessaire à ce nouveau projet.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0465a7d1-b881-494f-8ede-641482e2bc4b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. The current Coup Sûr reference branch is `security/hardening-production-foundation`.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
