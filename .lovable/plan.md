## Objectif

Professionnaliser la chaîne "pari → reçu → vérification" et rendre le PMU complet, fluide et accessible (utilisateur analphabète), tout en gardant le design actuel.

## 1. SMS automatique de gain (mock + hook réel optionnel)

- `src/lib/sms.ts` : `sendWinSms(ticket, leg?)` qui formate :
  `"LoNaNi: BRAVO! Ticket #{id} ({drawName}) gagne {amount} FCFA. Reçu: {origin}/verify/{token}"`
- Déclenchement automatique côté Admin quand un leg/ticket passe à `won` (dans `admin.tsx` après `markLegWon`/`markWon`).
- Mode mock par défaut : log + toast + push dans `localStorage.lonani.sms` pour démo, visible dans l'onglet "Ops" de l'admin (table des SMS envoyés).
- Hook prêt pour Twilio/GatewayAPI : `if (import.meta.env.VITE_SMS_PROVIDER) { fetch('/api/public/sms', ...) }` — non câblé sans secret.

## 2. QR Code signé + page de vérification

- `src/lib/ticket-token.ts` :
  - `signToken(ticket, legId?)` → base64url(`{tid, lid?, st, ts}`) + HMAC-SHA256 court (clé `LONANI_LOCAL_SIGN` stockée dans `localStorage` la 1ère fois → cohérent dans la même installation pour la démo).
  - `verifyToken(token)` retourne `{ valid, ticketId, legId, reason? }`.
- QR code (lib `qrcode` déjà présente) encode `https://<origin>/verify/<token>`.
- Nouvelle route `src/routes/verify.$token.tsx` : page publique qui décode, vérifie la signature, retrouve le ticket dans le store local et affiche badge **✅ Authentique** ou **❌ Invalide**, avec récap leg / statut / montant.
- `receipt-pdf.ts` : QR pointe désormais sur l'URL `/verify/<token>` au lieu du payload brut.

## 3. Bet slip — récap clair par leg

Dans `BetFlow.tsx` étape 3 (déjà existante) :
- Ajout colonne **Gain potentiel** = `stake * odds` (odds par défaut selon `gameId` + `betType` PMU ; 1 pour Loto multi-grilles, géré séparément côté Loto).
- Ligne **Total mises** + **Gain potentiel total** mis en valeur (gold).
- Checkbox de validation déjà en place, on garde.

## 4. Mobile First — 3 clics + mode simplifié

- Étape 1 PMU/Loto : boutons d'action `min-h-14`, icônes grandes.
- Étape 4 (identité) :
  - `inputMode="tel"` + `pattern="[0-9]*"` + `autoComplete="tel"` pour clavier numérique.
  - Toggle **"Mode simple 🟢"** en haut : masque la région (auto = compte ou Niamey), agrandit la police (text-xl), réduit à 1 champ visible (téléphone) avec gros bouton "Continuer".
- Préselection : si `account` existe, on saute directement de l'étape 3 → 5 (paiement), avec un petit lien "Modifier mon numéro".

## 5. PMU étape 1 — Grille pro

Refonte `src/routes/pmu.tsx` + extension `mock-data.ts` :

### Données chevaux enrichies
```ts
horses: [{ number, name, intlName, jockey, status: "partant"|"non-partant", form: "1a2a3p", winRate, placeRate, weight }]
```

### UI étape 1
- Bandeau **Type de pari** (chips horizontales scrollables) :
  `Simple Gagnant`, `Simple Placé`, `Couplé Gagnant`, `Couplé Placé`, `Tiercé`, `Quarté`, `Quinté+`, `Champ Réduit`, `Combiné`.
- Chaque type a `{ minPicks, maxPicks, baseStake, odds, helpFr }` — affiché en gros sous les chips.
- Grille 2 sections : **Partants** (cliquables, fond clair) et **Non-partants** (grisés, non cliquables, badge "NP").
- Carte cheval : N°, nom local + `intlName` (italique), jockey, mini stats (`★ V:18% · P:42%`), poids.
- Sélection numérotée (ordre cliqué) pour Tiercé/Quarté/Quinté+ → label "1er, 2e, 3e" ; pour Couplé sans ordre → juste cases.
- Calcul auto **nb combinaisons** (Combiné/Champ Réduit) et mise totale = `combos × baseStake`, affiché en gros gold avant "Continuer".
- Texte d'aide court par type (`helpFr`) pour analphabète + pictogramme.

### Logique
- `getCombinations(betType, picks)` : C(n,k) ou permutations selon ordre.
- `canContinue` = `picks.length >= type.minPicks && picks.length <= type.maxPicks`.
- `BetFlow` reçoit `defaultStake = type.baseStake * combos`, `minStake = type.baseStake`, `picksLabel` inclut `[Tiercé Ordre]` etc.

## 6. Fichiers

**Créés**
- `src/lib/sms.ts`
- `src/lib/ticket-token.ts`
- `src/lib/pmu-bets.ts` (types de paris + combinatoire)
- `src/routes/verify.$token.tsx`

**Édités**
- `src/routes/pmu.tsx` (refonte étape 1)
- `src/components/BetFlow.tsx` (gain potentiel, mode simple, clavier num, skip identité)
- `src/lib/mock-data.ts` (chevaux enrichis + non-partants)
- `src/lib/receipt-pdf.ts` (QR → /verify/<token>)
- `src/routes/admin.tsx` (déclenche `sendWinSms` au marquage gagnant, onglet Ops listant les SMS)
- `src/lib/i18n.tsx` (nouvelles clés)

## Hors-scope (à confirmer plus tard)
- Branchement SMS réel (nécessite secret Twilio/GatewayAPI).
- Persistance multi-device (resterait localStorage tant qu'on n'active pas Lovable Cloud).
- Cotes PMU dynamiques (on garde des cotes mock par type de pari).

