## Objectif
Faire évoluer LoNaNi vers un produit plus crédible : Loto Balsa devient quotidien, l'accueil affiche les compteurs sans cagnotte gonflée, Pari Foot prend une vraie structure sportsbook, on ajoute un compte joueur simple, l'admin devient pro avec analytics régionales + boules, et on intègre une IA Pronostics.

## 1. Page d'accueil (`src/routes/index.tsx`)
- **PMU (carte principale)** : date du jour (DD/MM/YYYY), badge "Tirage quotidien", **Heure d'ouverture** (configurable, ex. 08:00), **Heure de clôture** (14:00), **Heure du tirage** (15:00), compte à rebours dynamique vers le prochain événement.
- **Loto Balsa (carte secondaire, sous PMU)** : devient **quotidien**. Affiche heure d'ouverture / clôture / tirage + compte à rebours + numéros chauds (déjà fait). **Pas de montant jackpot.**
- À la place de la cagnotte Loto, afficher un bloc temps réel : **Gagnants du jour** (nombre) + **Montant total gagné aujourd'hui** (somme mock dérivée des tickets).

## 2. Loto Balsa (`src/routes/loto-balsa.tsx` + `mock-data.ts`)
- `drawSchedule.loto` passe en quotidien : `openHour: 8, closeHour: 19, drawHour: 20, daily: true`.
- Retirer `lotoJackpot` de l'UI (garder le multiplicateur x70…x20000 inchangé).
- Page jeu : bandeau avec horaires du jour + compte à rebours.

## 3. Pari Foot façon 1xBet (`src/routes/pari-foot.tsx` + `mock-data.ts`)
- Étendre `footMatches` : ~20 matchs répartis en **Compétitions** :
  - Premier League, La Liga, Serie A, Bundesliga, Ligue 1
  - Ligue des Champions, Europa League
  - CAN, Coupe du Monde (qualifs)
- Structure `{ id, league, home, away, date, odds: {1,X,2} }`.
- UI sportsbook : sidebar/onglets championnats à gauche (desktop) / chips scrollables (mobile), liste de matchs avec logos texte, 3 cotes cliquables (1 / X / 2), panier (bet slip) flottant à droite qui calcule la cote combinée et le gain potentiel. Conserver le flux de mise existant en sortie de panier.

## 4. Compte joueur (nouveau)
- Nouvelle route `src/routes/compte.tsx` : formulaire d'inscription simple — **Nom**, **Prénom**, **Région** (select : Niamey, Maradi, Zinder, Tahoua, Agadez, Dosso, Tillabéri, Diffa), **Téléphone** (8 chiffres).
- Stockage local (`localStorage`) via un hook `useAccount()` dans `src/lib/account.tsx` (mock V1).
- AppShell : si pas de compte → bouton "Créer un compte" ; sinon avatar + prénom + lien "Mon compte".
- À la mise (BetFlow), pré-remplir le numéro avec celui du compte. Persister la région sur chaque ticket (`region` dans mock tickets) pour alimenter les stats admin.

## 5. Admin pro (`src/routes/admin.tsx`)
Refonte en onglets : **Vue d'ensemble**, **Joueurs**, **Régions**, **Boules**, **SMS & encaissements**, **IA Pronostics**.
- **Vue d'ensemble** : KPIs (joueurs actifs, tickets, montant misé total, gain payé, marge brute) + graphique 7 jours (déjà existant, amélioré).
- **Joueurs** : tableau live (nom, région, tél, tickets, misé, gagné) avec recherche + filtre région.
- **Régions** : barres horizontales montant misé / région + montant gagné / région + tendance (delta vs 7j) → permet de "dégager une tendance de jeux".
- **Boules** (Loto) : grille 1–90 où chaque boule affiche le **nombre de fois jouée** ; au survol/clic, panneau latéral montre la décomposition **jouée seule** vs **en combinaison avec X autres**, plus top 5 paires co-occurrentes.
- **SMS & encaissements** : conserver l'existant.

## 6. IA Pronostics (nouveau)
- Activer **Lovable Cloud** (requis pour appeler l'IA en sécurité côté serveur).
- Server function `src/lib/ai-pronos.functions.ts` utilisant Lovable AI Gateway (`google/gemini-3-flash-preview`) avec `Output.object` :
  - `analyzePmu({ date })` → pour chaque cheval : score 0–100, force, faiblesse, position prédite. Renvoie un tiercé + quinté recommandé.
  - `analyzeLoto({ history })` → analyse de rotation des boules, boules chaudes/froides détectées, 3 grilles suggérées avec justification.
- UI : nouvelle page `src/routes/pronostics.tsx` enrichie d'un onglet "IA" (la page existe déjà ; on ajoute la section IA avec bouton "Analyser maintenant", spinner, rendu structuré). Accessible aussi depuis admin (onglet IA Pronostics) pour préview opérateur.
- **Note importante** : la consigne mentionne "analyser les plateformes en ligne". V1 = analyse basée sur l'historique mock + connaissances générales du modèle (pas de scraping live de sites tiers, hors périmètre légal/technique d'une V1 maquette). À documenter dans l'UI ("Analyse basée sur l'historique de la plateforme et heuristiques IA").

## 7. i18n / utils
- Ajouter clés FR : `openAt`, `closeAt`, `drawAt`, `todayWinners`, `totalPaidToday`, `createAccount`, `myAccount`, `region`, `phone`, `firstName`, `lastName`, leagues, `aiAnalyze`, `aiPmuTitle`, `aiLotoTitle`, etc.
- Helper `formatTime(hour)` → "HH:00".

## Détails techniques
- Pas de DB réelle pour comptes/tickets en V1 : `localStorage` + mock seeds enrichis (≥ 200 tickets simulés répartis sur 8 régions et 90 boules) pour rendre les stats admin crédibles dès le 1er chargement.
- Seeds générés de façon **déterministe** (PRNG seedé) pour éviter les mismatches SSR.
- Activation Lovable Cloud uniquement pour la partie IA (clé `LOVABLE_API_KEY` côté serveur). Le reste reste frontend.
- Aucun changement au design system / palette.

## Fichiers impactés
- edit : `src/routes/index.tsx`, `src/routes/loto-balsa.tsx`, `src/routes/pari-foot.tsx`, `src/routes/admin.tsx`, `src/routes/pronostics.tsx`, `src/lib/mock-data.ts`, `src/lib/i18n.tsx`, `src/lib/tickets.tsx`, `src/components/AppShell.tsx`, `src/components/BetFlow.tsx`, `src/lib/utils.ts`
- create : `src/routes/compte.tsx`, `src/lib/account.tsx`, `src/lib/ai-pronos.functions.ts`, `src/lib/ai-gateway.server.ts`, `src/lib/mock-stats.ts` (générateur seedé)

## Questions avant de coder
1. **Heures d'ouverture officielles** — je propose PMU 08:00 → clôture 14:00 → tirage 15:00 ; Loto Balsa 08:00 → clôture 19:00 → tirage 20:00. OK ou tu préfères d'autres horaires ?
2. **IA & Lovable Cloud** : ok pour activer Cloud (nécessaire pour la fonction IA serveur sécurisée) ?

Si OK sur ces 2 points → j'implémente tout d'un coup.
