# Plan d'évolution LoNaNi

Périmètre large — je découpe en 7 chantiers indépendants. Tout reste frontend + mock data (pas de Lovable Cloud sauf IA déjà branchée).

## 1. Fuseau horaire Niger (Africa/Niamey, UTC+1, pas de DST)

- Nouveau helper `src/lib/schedule.ts`:
  - `nowNiger()` → Date corrigée UTC+1
  - `nextDraw(game)` → calcule la prochaine ouverture / clôture / tirage du jour
  - `drawNameForDate(date)` → renvoie le nom du tirage Balsa selon le jour:
    - Lun: MAMAKI, Mar: SOUDJI, Mer: ARZIKI, Jeu: GOMNI, Ven: IRMA SABOU, Sam: FARAHA, Dim: BALSA
- Countdown précis à la seconde sur `index.tsx` et `loto-balsa.tsx`.
- Horaires: PMU 08:00 → clôture 14:00 → tirage 15:00. Loto Balsa 08:00 → clôture 19:00 → tirage 20:00.

## 2. Page d'accueil

- Bouton "Jouer maintenant" Loto Balsa = même style premium gold-gradient que PMU (gradient, ombre, icône, badge nom du tirage du jour).
- Badge dynamique sous Loto Balsa: "Aujourd'hui · Tirage IRMA SABOU".
- Countdown synchronisé Niger.

## 3. Loto Balsa — multi-tirages + mise

- Supprimer le bloc mise dupliqué (un seul).
- Mise min **300 FCFA**, max **100 000 FCFA**, input manuel libre + chips rapides (300/500/1000/2000/5000/10000).
- Nom du tirage du jour affiché en en-tête + stocké sur le ticket (`drawName`).
- **Multi-grilles**: bouton "+ Ajouter une grille" pour empiler plusieurs sélections (1–5 boules) avant paiement. Chaque grille a sa propre mise. Total cumulé affiché en bas.
- Un seul reçu agrégeant toutes les grilles (voir §5).

## 4. Bet slip clair + étape de confirmation (PMU & Pari Foot)

- Nouvelle étape "Récap & validation" insérée avant paiement:
  - Liste des sélections (numéros chevaux / matchs avec choix 1/X/2)
  - Cote totale (Foot) ou nb chevaux (PMU)
  - Mise par grille + total
  - Case à cocher "Je valide mes sélections"
- Pari Foot: bet slip flottant déjà présent → ajouter total cote en gros + bouton "Valider mes paris".
- PMU: idem, liste ordonnée des chevaux choisis.

## 5. Tickets multi-jeux + reçu groupé

- `Ticket` accepte `legs: TicketLeg[]` (chaque grille = un leg avec picks/mise/drawName/status).
- `addTicket` accepte un tableau de legs; `total = sum(legs.stake)`.
- Page `ticket/$id`: affiche tous les legs avec statut individuel (gagnant/perdant/en attente) et nom du tirage.
- PDF reçu reflète la liste.

## 6. Étape 3 simplifiée (paiement mobile money simulé)

- Si compte existant → étape 3 montre uniquement **téléphone + région** (pré-remplis), pas de nom/prénom/email.
- Étape 4 (paiement) refonte:
  1. Choix opérateur (auto-détecté depuis l'indicatif/numéro: Airtel/Moov/Orange/Amanata/MyNita via préfixe simulé)
  2. Affichage "Compte détecté: M. XYZ" (mock)
  3. Saisie **mot de passe mobile money** (4–6 chiffres)
  4. Validation → 30% du temps simule "Fonds insuffisants" si stake > seuil aléatoire déterministe ; bouton "Changer de numéro" rejoue
  5. Sinon succès → ticket créé
- Toujours mock, aucun vrai paiement.

## 7. Admin

### Export CSV
- Sélecteur de période (date début / date fin) + bouton "Exporter CSV":
  - Tickets (id, date, joueur, région, jeu, picks, mise, statut, paiement, gain)
  - Gagnants uniquement
  - Encaissements (paiements approuvés)
- Génération côté client via Blob; nom: `lonani-tickets-YYYYMMDD-YYYYMMDD.csv`.

### Détection multi-legs gagnants
- Vue tickets: pour un reçu multi-grilles, badge "2/3 gagnants" + liste des legs avec leur status. Bouton "Marquer gagnant" par leg.

### Panneau IA détaillé
- Nouvelle route `/pronostics` enrichie (ou panneau dans existant): pour PMU → score par cheval (forme, jockey, distance, terrain) + justification texte; pour Loto → chaleur/rotation par boule + 3 grilles recommandées avec raison. Bouton "Utiliser cette grille" → préremplit la page de jeu.
- IA déjà branchée via `ai-pronos.functions.ts`, j'étends le schéma de sortie + l'UI.

## Fichiers touchés

**Créés**: `src/lib/schedule.ts`, `src/lib/mobile-money.ts`, `src/lib/csv-export.ts`

**Modifiés**: `src/routes/index.tsx`, `src/routes/loto-balsa.tsx`, `src/routes/pmu.tsx`, `src/routes/pari-foot.tsx`, `src/routes/admin.tsx`, `src/routes/pronostics.tsx`, `src/routes/ticket.$id.tsx`, `src/components/BetFlow.tsx`, `src/lib/tickets.tsx`, `src/lib/mock-data.ts`, `src/lib/ai-pronos.functions.ts`, `src/lib/i18n.tsx`, `src/lib/receipt-pdf.ts`

## Notes
- Pas de vrai mobile money / SMS — tout simulé côté frontend.
- L'IA reste sur Gemini via gateway déjà configuré, sortie structurée enrichie.
- Aucun changement de design système (gold/green conservés).

Confirme et je lance l'implémentation.