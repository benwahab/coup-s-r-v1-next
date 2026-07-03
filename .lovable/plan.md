# Plan — Page d'accueil image-only « Coup Sûr »

## Objectif

Remplacer la page d'accueil actuelle (`src/routes/index.tsx` — hero + jeux + résultats) par une **page purement visuelle** : seule l'image de marque apparaît, sans aucun texte ni contrôle de navigation. La carte qui contient l'image est centrée (vertical + horizontal), plus compacte qu'avant, avec coins arrondis 14-16 px, ombre douce flottante, fallback de chargement léger, et adaptation mobile.

L'image de marque est déjà en place : `public/og-image.png` (1200×1200, square). Pas besoin d'en créer une nouvelle.

---

## Comportement attendu

| Cas | Rendu |
|-----|-------|
| Ouverture du lien `/` | Carte centrée, image seule, fond émeraude profond, animation flottante très lente |
| Image encore en cours de chargement | Skeleton shimmer de mêmes dimensions que la carte, même border-radius, animation `pulse`/`shimmer` |
| Image chargée | Apparition douce (`fade-in`/`scale-in`, ~600 ms) |
| Mobile (≤ 640 px) | Carte pleine largeur moins marges internes confortables (px-6 / py-8) |
| Desktop | Carte centrée, max-width réduite à ~280 px (plus compact qu'avant — l'ancien PremiumPhoneCard faisait 400 px) |
| Clic utilisateur | **Aucun** — purement visuel, conformément à la réponse « Aucune interaction » |
| Splash | Supprimé (la page d'accueil est désormais le splash) |

---

## Fichiers modifiés

### 1. `src/routes/index.tsx` — Réécriture complète

Remplacer toute la section `component: Index` par une page minimale :

- Conteneur plein écran (`min-h-dvh`) avec flex center.
- Fond émeraude profond (réutiliser la palette `#003a31` → `#002821` → `#001612` déjà dans `cs-app-bg`).
- Carte centrée : `max-w-[280px]` desktop, `w-full mx-4` mobile.
- Border radius `rounded-2xl` (16 px, conforme au spec).
- Ombre flottante : 3 couches (lift + halo + ombre profonde).
- Image : `<img src="/og-image.png" alt="Coup Sûr" />` avec `loading="eager"` et `decoding="async"`.
- Skeleton de fallback : `aspect-square`, `bg-white/[0.06]`, `animate-pulse`, **affiché tant que `imageState === "loading"`**, puis fade-out à 200 ms.
- Image : apparition `animate-fade-in` + léger `scale(1.02 → 1)`, durée 600 ms.
- Animation flottante continue : `@keyframes cs-card-float` sur `translate3d + scale`, durée 14-18 s (GPU-friendly, aucun layout).
- Aria-hidden sur le skeleton et l'image décorative, alt vide ou rempli selon la préférence.
- `head()` conserve le `<title>` actuel, plus `og:title`/`og:description`/`og:image` (déjà présents sur `__root.tsx`).

### 2. `src/components/AppShell.tsx` — Masquer le chrome sur `/`

Ajouter une condition dans `RootComponent` ou en amont : si `pathname === "/"`, ne rendre **que les enfants**, sans :

- `<header>` (logo + Connexion + Compte + Admin + Lang switch)
- `<nav>` mobile bottom bar
- `<SiteFooter />`
- Pas de `cs-app-bg` (la page d'accueil a son propre fond)

Approche : extraire un flag `isLanding` via `useRouterState({ select: (s) => s.location.pathname === "/" })` puis court-circuiter le rendu.

### 3. `src/routes/__root.tsx` — Retirer le `Splash`

Supprimer l'import `{ Splash }` et le composant `<Splash />` du `RootComponent`. La page d'accueil image-only joue désormais ce rôle. Les autres routes n'auront plus de splash non plus — c'est volontaire, conformément à la directive « aucune écriture ».

### 4. `src/styles.css` — Ajouter 2 utilitaires

Sous `@layer utilities` :

- `.cs-landing-bg` : dégradé radial émeraude avec léger vignettage (réutilise la palette `#003a31` → `#001612`).
- `.cs-card-float` : keyframes `transform: translate3d(0, var(--y), 0) scale(var(--s))` avec `will-change: transform`, durée 16 s, `ease-in-out infinite`, `prefers-reduced-motion` désactive.
- `.cs-shimmer` : keyframes `background-position: -200% 0` pour un shimmer diagonal subtil sur le skeleton.

### 5. `public/og-image.png` (déjà présent)

Aucune modification. Le fichier existe déjà (la conversion logo → partage/favicon a été faite précédemment).

---

## Design tokens (cohérence /auth)

Repris de la palette Coup Sûr déjà en place :

| Token | Valeur | Usage |
|-------|--------|-------|
| `--background` | `#003a31` (emerald deep) | Fond page d'accueil |
| `--card` | `rgba(255,255,255,0.06)` (verre) | Skeleton de chargement |
| `--shadow-soft` | `0 8px 24px -8px oklch(0 0 0 / 0.5)` | Lift de la carte |
| `--shadow-elevated` | `0 26px 60px -20px oklch(0 0 0 / 0.65)` | Halo inférieur |
| `--primary` | `#FF8A00` | Halo subtil derrière la carte (optionnel, très faible opacité) |
| `--radius-lg` | `1rem` (= 16 px, conforme spec) | Border radius de la carte |

---

## Hiérarchie visuelle (desktop)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   fond : radial-gradient émeraude profond, vignettage noir │
│                                                            │
│                  ┌──────────────────────┐                  │
│                  │                      │                  │
│                  │     [ IMAGE OG ]     │ ← max-w-[280px] │
│                  │                      │   rounded-2xl    │
│                  │     (square 1:1)     │   shadow-3-layer │
│                  │                      │   float 16 s     │
│                  └──────────────────────┘                  │
│                                                            │
│  (skeleton de mêmes dimensions tant que image non chargée) │
└────────────────────────────────────────────────────────────┘
```

---

## Hiérarchie visuelle (mobile)

```
┌──────────────────────────┐
│                          │
│   px-6 / py-8 / safe-top │
│                          │
│  ┌────────────────────┐  │
│  │                    │  │
│  │   [ IMAGE OG ]     │  │  ← w-full, marges 24 px
│  │   aspect-square    │  │     rounded-2xl
│  │                    │  │     shadow-soft
│  └────────────────────┘  │
│                          │
│        pb-24 (mobile nav)│
└──────────────────────────┘
```

Note : pas de bottom-nav mobile sur `/` (cf. § 2).

---

## Garanties techniques

- **Aucun nouveau composant React complexe** — pas de parallax, pas de hooks lourds. Juste `useState` pour l'état de chargement.
- **GPU-only animations** : uniquement `transform` (translate3d, scale) + `opacity`. Aucun `top/left/width/height` animé.
- **`prefers-reduced-motion`** : désactive le float + le shimmer (déjà géré dans le `cs-app-bg` existant — on réutilise le pattern).
- **Aucun layout shift** : skeleton et image ont exactement les mêmes dimensions (aspect-square + max-w).
- **Aucun changement de logique métier** : pas de modification des providers, de l'auth, des paiements, etc.
- **Pas de modification des autres routes** : `/pmu`, `/loto-balsa`, `/pari-foot`, `/auth`, `/compte`, `/admin`, etc. restent intactes.

---

## Vérification après implémentation

1. Ouvrir la racine `/` :
   - Fond émeraude profond visible immédiatement.
   - Skeleton shimmer apparaît (200-500 ms) puis image `/og-image.png` remplace en fondu.
   - Aucun header, aucun footer, aucune nav, aucun texte.
   - Carte centrée verticalement et horizontalement.
2. Vérifier en viewport mobile (≤ 640 px) : carte pleine largeur avec marges intérieures confortables, ombre douce conservée.
3. Vérifier `prefers-reduced-motion` : float et shimmer désactivés.
4. Naviguer vers `/pmu` puis revenir `/` : la page d'accueil doit s'afficher sans splash intermédiaire.
5. Naviguer vers `/auth` : la coque téléphone premium est inchangée (référence visuelle absolue).
