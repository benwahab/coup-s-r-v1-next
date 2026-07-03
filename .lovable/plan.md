## Méthode

J'ai passé en revue les 15 routes, 22 fichiers `lib/`, les 5 composants applicatifs, le styles.css, l'auth, les logs runtime et le comportement observé en preview. Les problèmes ci-dessous sont **réels et localisés dans le code** — pas des généralités.

---

## P0 — À corriger immédiatement (bugs qui cassent la prod)

### 1. Bug d'hydratation SSR sur la page d'accueil
`src/routes/index.tsx:37-45` — `useCountdown` appelle `nextDailyEvent()` qui utilise `new Date()`. Au SSR l'heure serveur diffère du client → React remplace le libellé "Clôture dans" par "Tirage dans" à l'hydratation, ce qui déclenche l'erreur runtime déjà remontée et un flash visible.
**Fix** : rendre le compte à rebours en `client-only` (retourner `null` tant que `now === null`, ce qui masque aussi le libellé, pas seulement les chiffres).

### 2. Tous les tokens de session en `localStorage` en clair
`src/lib/auth.tsx`, `drafts.tsx`, `tickets.tsx`, `account.tsx`, `payments.ts`, `auth-logs.ts`, `sms.ts` → **9 clés `lonani.*`** contenant OTP, téléphone, tickets, paiements, brouillons. Un XSS = fuite totale. De plus tout est mock côté client, donc :
- un utilisateur peut forger un ticket "gagnant" en éditant `localStorage`,
- un utilisateur peut valider un paiement sans passer par la MM.
**Fix** : bascule vers Lovable Cloud (Supabase) pour auth (OTP SMS), tickets et paiements. RLS strict + `has_role` pour l'admin. Édition du client purement UI.

### 3. Panneau `/admin` accessible à tous
`src/routes/admin.tsx` n'a **aucun gate**. N'importe qui tapant `/admin` voit les tickets, chiffres d'affaires, logs SMS, IPs. Route publique dans TanStack.
**Fix** : déplacer sous `_authenticated/admin.tsx` + vérification `has_role('admin')` dans `beforeLoad`.

### 4. Route `/verify/$token` — vérification côté client uniquement
`src/lib/ticket-token.ts` signe/vérifie avec un secret embarqué dans le bundle → n'importe qui peut forger un token gagnant.
**Fix** : déplacer la signature + vérif en `createServerFn` avec `SUPABASE_SERVICE_ROLE_KEY`. Générer un secret HMAC via `generate_secret`.

### 5. Fichier `ai-gateway.server.ts` (11 lignes) importé côté client ?
À vérifier — s'il fuit dans le bundle, la clé Lovable AI est exposée. Doit être `*.server.ts` **et** jamais importé au module scope d'un `*.functions.ts`.

---

## P1 — Expérience utilisateur (frictions majeures)

### 6. Splash 60 s bloquant
`src/components/Splash.tsx` affiche un compte à rebours 00:59 → 00:00 avant toute interaction (visible dans le session replay). Pour un site de paris où l'utilisateur revient plusieurs fois par jour, c'est éliminatoire.
**Fix** : splash uniquement au 1er chargement (flag `sessionStorage`), max 1,5 s, skippable au clic. Ne pas bloquer le rendu.

### 7. Compte à rebours "Tirage dans" invisible au 1er render
Lié au P0 #1 : après le fix, la carte affichera un skeleton pendant ~1 frame au lieu d'un décalage visuel.

### 8. Formulaire d'inscription : friction sur la confirmation CGU
`src/routes/auth.tsx` — la modale CGU/Confidentialité s'ouvre après clic "Créer mon compte" alors que les champs sont déjà remplis. Utilisateurs mobiles reculent souvent = compte non créé.
**Fix** : case à cocher inline "J'accepte les [CGU] et la [Politique]" **au-dessus** du bouton, désactive le bouton tant que non cochée. Lien qui ouvre les documents dans un tiroir sans quitter la page.

### 9. Persistance des brouillons trop agressive
`src/lib/drafts.tsx` : purge selon `session-window`. Si l'utilisateur ferme le navigateur pendant la fenêtre de jeu, le brouillon disparaît. Mock actuel = perte de mise potentielle.
**Fix** : stocker en DB liée à l'utilisateur, TTL serveur, avec UI claire "Expire à HH:MM".

### 10. `/mes-tickets` — 64 lignes, aucun filtre ni tri
Pour un joueur avec 20+ tickets/semaine c'est illisible.
**Fix** : filtres (statut, jeu, période), tri par date, pagination, recherche par n° ticket.

### 11. Textes trop denses sur mobile 375px
`admin.tsx` (957 lignes), `pari-foot.tsx` (250 lignes), `pmu.tsx` (237 lignes) contiennent des `header` avec `flex flex-wrap` sans `min-w-0`/`shrink-0` → débordement horizontal sur iPhone SE.
**Fix** : appliquer le pattern `grid grid-cols-[minmax(0,1fr)_auto]` + `truncate` (voir `responsive-layout-patterns`).

### 12. Aucun feedback réseau (tout instantané car mock)
Quand on branchera un vrai backend, il manque partout : loading skeletons, disabled state pendant submit, toast d'erreur réseau, retry. À prévoir dans la même phase.

---

## P2 — Design & cohérence visuelle

### 13. Alignement `/auth` réalisé mais incomplet
Après l'harmonisation `amber → primary` faite hier, il reste 3 zones off-palette :
- `admin.tsx` : `recharts` utilise des couleurs hardcodées (`#22c55e`, `#ef4444`, etc.) → passer aux tokens CSS via `var(--primary)`.
- `SiteFooter.tsx` : dégradés en dur (à vérifier ligne par ligne).
- Icônes lucide : parfois `text-white/60` (arbitraire) au lieu de `text-muted-foreground`.

### 14. Typo incohérente entre pages
`__root.tsx` charge Manrope + Space Grotesk. `PremiumPhoneCard` utilise `font-display` sans définir la police. Vérifier que `space-grotesk` = `font-display` partout et que les autres pages ne retombent pas sur la police système.

### 15. Aucune image `og:image` sur les 14 routes autres que `/`
Déjà fait pour `/`. Manque pour `/pmu`, `/loto-balsa`, `/pari-foot`, `/resultats`, `/pronostics` → prévisualisations génériques quand un joueur partage un jeu spécifique.

### 16. Dark mode incohérent
`src/styles.css` définit `.dark` mais aucun toggle dans l'UI et certaines pages ont des `bg-white` en dur → thème cassé si l'OS force sombre.

---

## P3 — Performance & qualité technique

### 17. Bundle bloat probable
- `recharts` (utilisé uniquement dans `/admin`) chargé sur toutes les pages ? À vérifier avec code-split par route (TanStack le fait auto avec `component: () => import(...)`).
- `receipt-pdf.ts` charge probablement `pdf-lib` — même problème si importé statiquement.
**Fix** : imports dynamiques `const { X } = await import("...")` dans les handlers.

### 18. `hero-winners.jpg` non optimisé
Utilisé en LCP sur `/`. Vérifier taille, prévoir variantes AVIF/WebP via `vite-imagetools` et `<link rel="preload">` dans `head().links` de `/`.

### 19. Console propre requise
Le hook d'error reporting (`lovable-error-reporting.ts`) est en place mais l'erreur d'hydratation ci-dessus prouve qu'il n'y a aucun test SSR. Ajouter un check `bun run build` avant chaque commit.

### 20. Fichiers > 500 lignes
`admin.tsx` (957) et `BetFlow.tsx` (531) — trop gros pour être maintenables. Découper en sous-composants par section (Dashboard, Transactions, Players, Activity…).

### 21. Aucune validation Zod côté client sur les formulaires
`auth.tsx`, `compte.tsx`, `pari-foot.tsx` prennent des inputs sans schéma → risque XSS quand un vrai backend arrivera.

### 22. Sitemap statique
`sitemap[.]xml.ts` à vérifier — doit lister les 15 routes publiques avec `lastmod`.

### 23. Accessibilité
- Beaucoup de `<button>` icon-only sans `aria-label` (`admin.tsx`, `BetFlow.tsx`).
- Aucun `<main>` déclaré (rangés dans `AppShell`).
- Contraste `text-white/60` sur fond clair : échoue AA.

### 24. i18n partiel
`i18n.tsx` (384 lignes) définit FR/EN/HA mais 40 % des pages utilisent des strings hardcodées en français. Soit assumer FR only et retirer le système, soit compléter.

---

## Plan d'action phasé

### Phase 0 — Stop the bleed (2-3 h)
1. Fix hydratation `useCountdown` (P0 #1)
2. Gate `/admin` derrière rôle admin (P0 #3)
3. Splash désactivé après 1er chargement (P1 #6)
4. Case CGU inline (P1 #8)

### Phase 1 — Sécurité fondations (1-2 jours)
5. Activer Lovable Cloud + schéma DB (users, tickets, payments, roles, otp_codes, audit_logs)
6. RLS + `has_role` + policies + GRANT
7. Migrer auth OTP en `createServerFn` avec Twilio ou Vonage (secret ajouté via `add_secret`)
8. Migrer tickets/paiements en DB, retirer `localStorage`
9. Signature ticket en HMAC serveur (P0 #4)
10. Audit `ai-gateway.server.ts` (P0 #5)

### Phase 2 — UX & Design (2 jours)
11. Refonte `/mes-tickets` (filtres, tri, pagination)
12. Responsive pass sur toutes les pages (P1 #11)
13. Loading states, toasts, retry (P1 #12)
14. Harmonisation couleurs recharts + footer (P2 #13)
15. `og:image` par jeu (P2 #15)
16. Validation Zod tous formulaires (P3 #21)

### Phase 3 — Perf & polish (1 jour)
17. Code split `recharts` et `pdf-lib` (P3 #17)
18. Optimisation images LCP (P3 #18)
19. Découpage `admin.tsx` et `BetFlow.tsx` (P3 #20)
20. A11y sweep (aria-labels, main, contraste) (P3 #23)
21. Décision i18n : FR only ou compléter (P3 #24)
22. Sitemap dynamique (P3 #22)

---

## Ce que ce plan ne fait PAS

- Ne change pas la charte graphique validée (`/auth` reste la référence)
- Ne modifie pas les règles métier des jeux (PMU, Loto, Foot)
- Ne casse pas les URLs existantes (SEO préservé)
- Ne branche pas de vrai fournisseur mobile money (nécessite un contrat séparé Airtel/Moov)

## Décision attendue de ta part

Approuver ce plan lance **la Phase 0 uniquement** (les 4 fixes critiques, 2-3 h). Ensuite je te redemande validation avant chaque phase — parce que la Phase 1 nécessite d'activer Lovable Cloud et de choisir un fournisseur SMS OTP (surcoût).
