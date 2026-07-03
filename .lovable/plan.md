## Plan d'amélioration majeure — LoNaNi V1

Travail volumineux découpé en 8 chantiers cohérents. Tout reste en frontend (mock localStorage + provider), conformément à la V1 fonctionnelle.

---

### 1. Admin — Journal des connexions (`src/routes/admin.tsx`)
- Nouvelle section **"Journal de connexions"** lisant `readAuthLog()`.
- Filtres : numéro de téléphone, IP, type d'événement (otp-request, verify-ok, verify-fail, locked, rate-limited, logout, session-expired), plage de dates.
- Tableau paginé (20/page), tri par date desc.
- **Export CSV** filtré.

### 2. Admin — Réclamations (`src/routes/admin.tsx`)
- Nouvelle section **"Réclamations"** : champ de recherche par numéro.
- Affiche pour le numéro saisi : tickets (statuts), brouillons, paiements, événements d'auth, demandes de cashout, dernière session.
- Boutons d'action mock : "Réinitialiser verrouillage", "Marquer ticket payé", "Annuler ticket".

### 3. Admin — Dashboard pro (vue d'ensemble)
- Remplacement des barres rudimentaires par des graphiques **Recharts** (déjà dispo via shadcn `chart.tsx`) :
  - Area chart revenus 7/30 jours
  - Bar chart par jeu (PMU / Loto / Foot)
  - Pie chart répartition opérateurs de paiement
  - KPI cards avec deltas (% vs période précédente)
- Layout en grille responsive, palette cohérente teal/gold.

### 4. Anti-double paiement (`src/lib/payments.ts` nouveau)
- `paymentIntents` map (localStorage) : clé = hash(phone+amount+gameId+selection+window15s).
- Avant génération du ticket dans `BetFlow`, vérifier qu'aucune intent identique n'est en cours / déjà validée.
- Si doublon détecté : toast "Paiement déjà en cours / déjà encaissé" + blocage.
- Marquage final après émission du ticket avec `transactionRef` unique.

### 5. Rate limiting renforcé (`src/lib/auth-logs.ts`)
- Algorithme **token bucket** + fenêtre glissante par numéro/IP.
- Limites : 3 OTP/min, 5/15min, 20/h par numéro ; 10/min, 30/h par IP.
- Backoff exponentiel après 3 échecs successifs (1s → 2s → 4s → 8s).
- Exposer `RateStats` pour affichage admin.

### 6. Stockage temporaire (purge auto)
- **Tickets** : nouveau champ `expiresAt = createdAt + 7 jours`. À chaque chargement du `TicketsProvider`, purge des tickets expirés (sauf gagnants non payés conservés).
- **Drafts** (`src/lib/drafts.tsx`) : nouveau champ `sessionId` lié à la session de jeu (PMU = jour, Loto = tirage du jour, Foot = jour). Au démarrage du provider, purger tous les brouillons dont la session est fermée et non payés.

### 7. Sessions 30 min (déjà OK, vérification)
- Confirmer `SESSION_IDLE_MS = 30 * 60 * 1000` dans `auth.tsx` → exigence respectée.
- Ajouter modale "Session expirée — reconnexion nécessaire" au lieu du redirect silencieux.

### 8. Pari Foot façon 1xBet (`src/lib/mock-data.ts`, `src/routes/pari-foot.tsx`)
- Étendre `footMatches` avec **marchés multiples** :
  - 1X2, Double chance, Total buts (Over/Under 0.5/1.5/2.5/3.5), BTTS Oui/Non, Handicap asiatique, Score exact (grille), Mi-temps/Fin de match, Cartons (Over/Under), Corners (Over/Under), Premier buteur (liste joueurs).
- UI : onglets de marchés par match (accordéon), bet slip cumulatif avec cote totale, mode **Combiné/Simple/Système**.
- Filtres : Live / À venir / Aujourd'hui / Demain.

### 9. PMU multi-tirages (`src/routes/pmu.tsx`)
- Système de "panier de tirages" identique à Loto Balsa : ajout de plusieurs paris (Simple/Couplé/Tiercé/etc.) avant paiement unique.
- Bouton "Ajouter un autre pari" entre sélection et paiement.
- Sauvegarde en brouillon si jeu fermé (déjà via `DraftsProvider`, étendre au multi-legs).

### 10. Parcours 3 clics
- Refonte `BetFlow` en **mode express** :
  - Clic 1 : sélection (combinaison/cheval/match)
  - Clic 2 : confirmation mise + opérateur (auto-détecté depuis profil)
  - Clic 3 : validation mot de passe → ticket
- Profil par défaut mémorisé (numéro + opérateur + région) dans `account.tsx` pour pré-remplir.
- Mode "Avancé" toujours disponible pour ceux qui veulent les 5 étapes.

---

### Détails techniques

- Pas de backend : tout en `localStorage` + providers React.
- Recharts est déjà installé (`src/components/ui/chart.tsx`).
- Nouveaux fichiers :
  - `src/lib/payments.ts` (anti-doublon + token bucket admin stats)
  - `src/lib/foot-markets.ts` (catalogue marchés 1xBet)
  - `src/lib/session-window.ts` (calcul sessionId par jeu)
- Fichiers modifiés : `admin.tsx`, `auth-logs.ts`, `auth.tsx`, `drafts.tsx`, `tickets.tsx`, `BetFlow.tsx`, `pari-foot.tsx`, `pmu.tsx`, `mock-data.ts`.

### Notes

- Volume estimé : ~1500-2000 lignes ajoutées/modifiées sur 12 fichiers.
- Livraison en une seule passe puis vérification build + smoke test du flow 3 clics.
- Aucune incidence sur `verify/$token`, `pronostics`, `resultats`.
