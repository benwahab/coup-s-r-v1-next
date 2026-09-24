# Refonte Connexion et création de compte

## Résultat attendu

Refaire uniquement l’expérience d’authentification de Coup Sûr avec trois parcours clairement séparés dans `/auth` :

- **Connexion** : numéro nigérien avec indicatif fixe `+227`, mot de passe, affichage/masquage, erreurs sous les champs, lien de récupération et lien de création de compte.
- **Créer un compte** : numéro, mot de passe, confirmation, validation visible, acceptation obligatoire des conditions, puis vérification OTP avant l’ouverture de session.
- **Mot de passe oublié** : numéro, OTP, nouveau mot de passe et confirmation, en réutilisant le mécanisme sécurisé existant.

## Parcours et sécurité

- Conserver Supabase Auth et les fonctions serveur existantes ; aucune migration, règle RLS ou fonction SQL ne sera modifiée.
- Recueillir le mot de passe dès la première étape de création, mais le garder uniquement en mémoire pendant le parcours ; ne jamais le stocker dans le navigateur.
- Après validation de l’OTP, utiliser la session temporaire existante et `setUserPassword` pour finaliser le mot de passe, puis rediriger vers l’accueil.
- La connexion ordinaire reste numéro + mot de passe. Une étape OTP ne s’affichera que si le système existant la demande ; elle ne sera pas inventée côté interface.
- Le mot de passe oublié réutilisera le parcours serveur actuel : OTP vérifié, session Supabase temporaire, puis remplacement sécurisé du mot de passe.
- Conserver les protections serveur actuelles : OTP 5 minutes, 3 essais, 5 demandes sur 15 minutes, invalidation de l’ancien code, hash et protection contre les usages concurrents.
- Le code OTP démo restera affiché avec une mention explicite **MODE DÉMO** en aperçu et en production jusqu’au branchement du fournisseur SMS, conformément au choix validé. Aucun autre élément fictif ne sera ajouté.
- Les erreurs techniques seront traduites en messages simples ; aucune information Supabase sensible ne sera affichée.

## Interface

- Remplacer l’écran unique mélangé par des vues distinctes et légères, tout en restant sur la route `/auth`.
- Conserver l’identité Coup Sûr : Space Grotesk, Manrope, émeraude profond et bouton orange.
- Utiliser les composants de boutons existants, des champs suffisamment grands, des boutons afficher/masquer accessibles et six cases OTP faciles à saisir.
- Afficher les erreurs directement sous chaque champ, un indicateur de validité du mot de passe, les états chargement/succès/erreur et le compte à rebours de renvoi.
- Utiliser des liens de navigation accessibles pour passer entre connexion, création et récupération, sans page fictive ni duplication du système Auth.

## Modifications ciblées

- Recomposer `src/routes/auth.tsx` en petites vues et composants de formulaire locaux.
- Adapter uniquement si nécessaire les types d’erreur dans `src/lib/auth.tsx`, sans changer les garanties serveur.
- Réutiliser `PremiumPhoneCard`, le design system et les composants d’interface existants ; ajuster seulement leur présentation si le rendu mobile l’exige.
- Retirer de l’écran Auth le code mort et les anciennes entrées qui mélangeaient création et récupération.

## Vérification

- Vérifier automatiquement les validations : numéro invalide, mot de passe invalide, confirmation différente et conditions non acceptées.
- Tester le parcours OTP : correct, incorrect, expiré, trois erreurs, renvoi temporisé et limite de demandes.
- Tester connexion incorrecte/correcte, création, récupération, déconnexion, rafraîchissement de session et accès protégé sans session.
- Tester le rendu mobile réel, les changements de vue, le clavier, les messages et l’absence d’écran vide.
- Exécuter lint, typage et build, puis corriger toute erreur liée à cette refonte.
- Ne modifier aucune autre fonctionnalité, aucune donnée Supabase et ne pas publier.

## Limites de validation

Les scénarios exigeant un compte réel ou l’épuisement de limites serveur seront exécutés seulement avec des comptes de test sûrs et sans altérer des données métier. Tout scénario impossible sans identifiant de test sera signalé précisément, sans simuler sa réussite.
