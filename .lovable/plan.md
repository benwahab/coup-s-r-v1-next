## Objectif

Harmoniser les couleurs de toute l'application sur la référence visuelle de `/auth` : dégradés émeraude profond (#003a31 → #007A67 → #00C896), accent orange chaud (#FF8A00 → #FFA23A), surfaces en verre blanc translucide, focus états émeraude clair. Zéro changement de logique métier — uniquement tokens CSS et petites retouches de composants qui utilisent encore des couleurs hors palette.

## Palette de référence (extraite de /auth)

- Fond global : `#003a31` avec halos radiaux `#009B77` / `#007A67`
- Émeraude claire (accent, focus, boules) : `#00C896`
- Orange CTA : gradient `#FFA23A → #FF8A00 → #E67A00`
- Rouge alerte / verrouillage : `#ef4444 → #b91c1c`
- Surfaces verre : `rgba(255,255,255,0.06)` bord `rgba(255,255,255,0.12)`
- Texte : blanc / `rgba(255,255,255,0.55)` pour labels

## Changements

### 1. `src/styles.css` — tokens unifiés
- Recaler les OKLCH de `:root` pour qu'ils correspondent exactement aux hex ci-dessus (background, card, primary, accent, ring, teal, gold, destructive, border, input) au lieu des valeurs approximatives actuelles.
- Recaler `--gradient-hero`, `--gradient-card`, `--gradient-gold`, `--gradient-green` sur les mêmes stops que la coque `/auth` (`#003a31 / #007A67 / #00C896` et `#FFA23A / #FF8A00 / #E67A00`).
- Recaler `--shadow-gold` et `--shadow-green` sur les ombres orange/émeraude utilisées dans `.cs-cta` et `.cs-field-wrap`.
- Aligner le dark theme sur la même palette (aujourd'hui il dérive vers un cyan/bleu — le ramener sur l'émeraude).
- Mettre à jour `.cs-app-bg` pour utiliser exactement les mêmes stops que le fond de `PremiumPhoneCard` (cohérence entre pages avec/sans coque téléphone).
- Ajouter/normaliser les utilitaires partagés `.glass-card`, `.btn-cta`, `.field-emerald`, `.focus-emerald` pour que toute page puisse reproduire les surfaces et focus émeraude de `/auth` sans redéfinir de couleurs locales.

### 2. Composants qui définissent encore des couleurs hors palette
Balayer et remplacer les classes/valeurs hors tokens par les utilitaires ci-dessus :
- `src/components/AppShell.tsx` : header, nav mobile, badge `-18`, bouton connexion/déconnexion (déjà proche mais quelques `red-500/40` et `border-border/60` à harmoniser avec les tokens).
- `src/routes/index.tsx`, `resultats.tsx`, `pronostics.tsx`, `mes-tickets.tsx`, `pmu.tsx`, `loto-balsa.tsx`, `pari-foot.tsx`, `admin.tsx`, `compte.tsx`, `conditions.tsx`, `confidentialite.tsx`, `ticket.$id.tsx`, `verify.$token.tsx` : remplacer les `bg-white/…`, `text-emerald-*`, `text-amber-*`, `bg-slate-*`, `from-…-to-…` codés en dur par les tokens (`bg-card`, `text-primary`, `text-accent`, `.glass-card`, `.btn-cta`, `bg-gold-gradient`, `bg-green-gradient`).
- `src/components/BetFlow.tsx`, `src/components/SiteFooter.tsx`, `src/components/Splash.tsx` : même traitement.

Aucune modification de structure, de texte, ni de logique — uniquement les classes/valeurs de couleur.

### 3. Vérification
- Charger `/`, `/auth`, `/compte`, `/pronostics`, `/pmu`, `/loto-balsa`, `/pari-foot`, `/mes-tickets`, `/admin`, `/resultats`, `/conditions`, `/confidentialite` via Playwright, screenshots 1280×1800, comparer visuellement pour confirmer la même identité émeraude/orange partout.

## Notes techniques

- Tous les changements de couleurs passent par les tokens `@theme inline` de `src/styles.css` — les composants continuent d'utiliser `bg-primary`, `text-accent`, etc.
- Les utilitaires `.cs-*` déjà scoppés à `/auth` restent tels quels ; on ajoute leurs équivalents génériques (`.glass-card`, `.btn-cta`) pour le reste de l'app.
- Aucun changement d'API, de route, de schéma, ni de dépendance.
