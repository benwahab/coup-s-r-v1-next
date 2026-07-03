# Phase 2 — UX & Design (une passe)

Portée large (10+ fichiers, ~3000 lignes). Je propose un plan pour valider l'approche avant de tout écrire d'un bloc, car certains points supposent des choix esthétiques (illustration téléphone, images OG) qui peuvent coûter cher à refaire.

## A. Refonte /auth + /compte

- Nouveau composant partagé `src/components/PremiumPhoneCard.tsx` : coque iPhone réaliste, 100% CSS + SVG (dégradés, ombres internes, encoche "dynamic island", reflets glass, cadre métal). Aucun asset image généré — plus léger, thème-aware, plus rapide à itérer.
- Slot `children` pour le contenu écran (l'OTP dans /auth, le résumé compte dans /compte).
- Restyle des "boules" de fond : composant local `LottoBall` (SVG dégradé émeraude/orange + chiffre blanc bold), gardé dans chaque route (pas partagé — ce sont deux ambiances distinctes).
- **Aucune modification** du hook `useAuth`, du flux OTP, des appels Supabase, du `useAccount`, du drawer CGU, ni de la logique du formulaire.
- `/compte` : title `Coup Sûr — Créer mon compte` (au lieu de "LoNaNi — …").

## B. /mes-tickets

Aujourd'hui : liste brute des tickets. Cible :
- Barre de filtres sticky : `select` statut (tous/pending/winning/paid/losing), `select` jeu (tous/pmu/loto/foot), `select` période (7j/30j/tous), `input` recherche par n° ticket.
- Tri par date desc/asc (bouton toggle).
- Pagination 10 par page.
- Skeleton pendant le chargement Supabase (nouveau : la liste vient du réseau).
- État vide illustré selon filtres actifs vs aucun ticket.

## C. Responsive 375px

Cibles : headers et barres d'action de `admin.tsx`, `pari-foot.tsx`, `pmu.tsx`. Application systématique du pattern :
```
grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:flex sm:items-center sm:justify-between
+ min-w-0 sur les blocs texte, shrink-0 sur icônes, truncate sur titres
```
Je passe aussi `loto-balsa.tsx` et `mes-tickets.tsx` dans le même audit (même pattern d'en-tête).

## D. Loading states & feedback réseau

- `useTickets` : ajouter `loading` boolean → skeleton dans `mes-tickets`, `admin`, `ticket.$id`.
- `useAuth.requestOtp` / `verifyOtp` : bouton disabled + spinner pendant l'appel, toast d'erreur si le serveur throw.
- `addTicket` (pari-foot / pmu / loto) : bouton "Valider" disabled pendant l'insert, toast succès/erreur.
- `payments.beginPayment` / `confirmPayment` : idem.
- `admin` : skeletons sur `adminListAllPayments`, disabled + toast sur `updateStatus`.
- Retry : uniquement sur `useTickets` initial load (bouton "Réessayer" dans l'état d'erreur). Ailleurs, toast + laisser l'utilisateur relancer manuellement (les mutations ne doivent pas retry silencieusement pour éviter les doubles paiements).

## E. Harmonisation couleurs

- `admin.tsx` recharts : remplacer les couleurs hex dur (`#22c55e`, `#ef4444`, palettes camemberts) par `hsl(var(--primary))`, `hsl(var(--success))`, `hsl(var(--destructive))`, `hsl(var(--muted-foreground))`. Recharts exige des valeurs CSS résolues → je lis via `getComputedStyle(document.documentElement)` dans un `useEffect` pour extraire les tokens en HSL numérique.
- `SiteFooter.tsx` : dégradés en dur → tokens (`from-primary to-primary/60` etc.).
- Audit rapide `text-white/60`, `bg-black/20` non-sémantiques → `text-muted-foreground`, `bg-muted/50`.

## F. og:image par jeu

Génération de 5 images (1200×630, `imagegen` fast, JPG) :
- `/pmu` — chevaux au galop, ambiance turf
- `/loto-balsa` — boules dorées/émeraude
- `/pari-foot` — ballon + terrain, ambiance stade
- `/resultats` — grille de résultats stylisée
- `/pronostics` — étoiles/analyse

Images sauvées dans `src/assets/og-*.jpg`, uploadées via `lovable-assets create`, référencées en URL absolue dans le `head()` de chaque route.

**Décision à confirmer** : OK pour 5 générations d'images (~5 crédits) ? Sinon je peux réutiliser une seule image générique pour toutes.

## G. Validation Zod client

- `auth.tsx` : schéma `{ phone: 8 chiffres }`, `{ code: 6 chiffres }`.
- `compte.tsx` : schéma `{ firstName, lastName: min 2 max 80, region enum, phone: 8 chiffres, cguAccepted: true }`.
- `pari-foot.tsx` : schéma sur la mise et la sélection (au moins N picks).

Messages d'erreur en français, affichés inline sous les champs.

## Ordre d'exécution proposé

1. E (tokens, base pour tout le reste)
2. A (nouveau composant partagé + refonte)
3. G (validation formulaires)
4. B (refonte /mes-tickets)
5. C (responsive audit)
6. D (loading/feedback — nécessite d'avoir touché tous les formulaires)
7. F (og:image — indépendant, en dernier après confirmation crédits)

## Non-touché

- `src/routes/index.tsx` (verrouillé)
- Règles métier PMU/Loto/Foot
- Flux OTP Supabase (Phase 1)
- URLs, routing, `drafts.tsx`

## Question bloquante

**F. og:image** : je génère les 5 images (~5 crédits `imagegen fast`) ou je réutilise une image unique générique ?

Le reste est déterministe, je peux enchaîner sans autre décision.
