# Diagnostic : pourquoi l'aperçu tombe sur « Cette page n'a pas pu être chargée »

Diagnostic seul. Rien n'a été modifié.

## Conclusion courte

Ce n'est pas un bug précis d'un écran. L'application est construite pour qu'**une seule erreur au démarrage, n'importe où, remplace toute la page** par un écran d'erreur générique. Et l'aperçu redémarre à chaque modification venue de GitHub, ce qui fait apparaître ces erreurs même quand la modification « n'a rien à voir ».

## Les deux écrans d'erreur (preuve qu'il y a deux origines)

1. **En français** « Cette page n'a pas pu être chargée » : `ErrorComponent` dans `src/routes/__root.tsx` (l. 55-91). Il s'affiche quand une erreur se produit pendant l'affichage React (navigateur ou serveur). C'est celui que vous voyez.
2. **En anglais** « This page didn't load » : `renderErrorPage()` dans `src/lib/error-page.ts`, renvoyé par `src/server.ts` et `errorMiddleware` de `src/start.ts` quand le serveur plante avant même React.

Le fait que vous voyiez la version française signifie : le serveur a répondu, puis **le rendu React a planté** (ou le chargement d'un morceau de code dans le navigateur a échoué).

## Chaîne d'exécution responsable

```text
src/server.ts -> @tanstack/react-start/server-entry
  -> src/router.tsx -> src/routeTree.gen.ts
       -> importe TOUTES les pages (admin, auth, pmu, ...) et leurs modules
  -> __root.tsx RootComponent
       I18nProvider > Splash > AccountProvider > AuthProvider
       > TicketsProvider > DraftsProvider > AppShell > <Outlet/>
  -> toute erreur ici remonte au seul ErrorComponent de la racine
```

Points précis :
- **`routeTree.gen.ts` importe chaque page.** Une erreur au chargement d'un seul fichier (même la page admin, ou un module qu'elle importe comme `admin.functions.ts`, `monitoring-*`) casse toutes les pages, y compris l'accueil.
- **Un seul filet de sécurité, à la racine.** Aucune page n'a son propre `errorComponent`. Les fournisseurs (`I18nProvider`, `AuthProvider`, `TicketsProvider`, `DraftsProvider`, `AccountProvider`) et `AppShell`/`Splash` entourent toutes les pages : s'ils plantent, tout le site tombe.
- **`src/integrations/supabase/client.ts` (l. 36-47) lance une erreur** si l'adresse ou la clé Supabase manque. Il est importé par `auth.tsx`, `tickets.tsx`, etc. Quand l'aperçu redémarre et relit mal `.env` (cas déjà vécu dans ce projet), tout tombe.
- **`src/start.ts`** charge `attachSupabaseAuth` et `monitoringMiddleware` (ajouté récemment) pour chaque appel serveur ; `monitoring-middleware.ts` importe `monitoring-client.ts` au démarrage. Une erreur dans ces fichiers touche toute l'application.
- **Lecture de `localStorage` pendant le rendu** (`src/lib/i18n.tsx` l. 1611, `src/lib/auth.tsx` l. 64-66, `rootLangText` dans `__root.tsx`) : le serveur et le téléphone affichent un contenu différent, ce qui peut provoquer des erreurs d'hydratation.

## Pourquoi un changement GitHub « sans rapport » déclenche l'erreur

- Chaque envoi GitHub resynchronise les fichiers et **redémarre le serveur de l'aperçu** ; `routeTree.gen.ts` est regénéré. Pendant ces quelques secondes, la page demande des morceaux de code anciens ou pas encore prêts : le navigateur échoue à les charger et l'écran d'erreur racine s'affiche. Déjà observé ici : rechargement automatique toutes les ~4 s, page OTP qui disparaît, aperçu qui « refuse de charger » puis revient après redémarrage.
- Si l'envoi modifie `package.json`/`bun.lock`, l'aperçu réinstalle les dépendances et redémarre : même effet, plus long.
- Le contrôle GitHub (`.github/workflows/ci.yml`) vérifie la compilation, mais **ne vérifie pas que les pages s'affichent** : une erreur qui n'apparaît qu'à l'exécution passe.
- Le bouton « Try again » n'appelle que `router.invalidate()` : il ne recharge pas le code neuf, donc l'erreur peut persister jusqu'à un vrai rechargement de la page.

## Preuves disponibles et limites

- Au moment de ce diagnostic, les journaux de l'aperçu (compilation, erreurs, serveur) sont **vides** : l'erreur n'est pas en cours, je ne peux donc pas citer le message exact d'un incident passé.
- Les preuves viennent du code lu et des incidents déjà constatés dans cette conversation (`.env` absent, redémarrages, rechargements automatiques).
- Pour confirmer à la prochaine panne : noter l'heure, ne pas recharger, et me demander de lire les journaux à ce moment-là.

## Pistes (non appliquées, à valider plus tard si vous le souhaitez)

- Ajouter un `errorComponent` par page et autour des fournisseurs, pour qu'une erreur reste locale.
- Faire recharger réellement la page au bouton « Réessayer » quand un morceau de code n'a pas pu être chargé.
- Ne plus lire `localStorage` pendant le premier affichage.
- Ajouter au contrôle GitHub un test qui ouvre réellement les pages principales.
