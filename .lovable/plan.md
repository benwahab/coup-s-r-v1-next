# Coup Sûr V1 — audit et préparation production

## Objectif

Rendre l’application stable et vérifiable dans l’aperçu réel, sécuriser les parcours existants et supprimer tout comportement simulé actif. Aucun faux paiement, faux SMS ou fausse donnée ne sera ajouté.

## Travaux prévus

1. **Démarrage et affichage**
   - Reproduire l’écran vide sur mobile, `/` et `/index`.
   - Corriger le premier rendu, les redirections et l’initialisation de session sans masquer les erreurs.
   - Vérifier chaque page demandée dans un navigateur réel.

2. **Connexion et compte**
   - Auditer la session Supabase, les contrôles de tentatives et la création de compte.
   - Retirer le code SMS simulé du parcours de production.
   - Conserver un état indisponible explicite tant que le fournisseur SMS réel n’est pas configuré.

3. **Jeux, paiement et tickets**
   - Vérifier PMU, Loto, Pari Foot, résultats, panier et reçus avec les données Supabase réelles.
   - Maintenir Airtel Money comme seul moyen de paiement.
   - Empêcher toute validation de ticket sans confirmation réelle du paiement.

4. **Administration et sécurité**
   - Vérifier les permissions côté serveur, les RPC, les règles RLS et les journaux financiers.
   - Corriger uniquement les failles concrètes sans altérer les données existantes.
   - Mettre à jour les dépendances vulnérables de production.

5. **Validation finale**
   - Vérifier les routes publiques et protégées sur mobile.
   - Exécuter les contrôles de code, la compilation et l’audit de sécurité.
   - Dresser la liste exacte des seuls blocages externes restants.

## Contraintes conservées

- Supabase canonique : `gisjxogimycghgkxedif` uniquement.
- Aucune modification ou suppression de donnée réelle.
- Aucune donnée fictive, aucun paiement ou SMS simulé.
- Aucun déploiement ni publication.
- Aucune intervention sur l’ancien projet ou sur une branche `main`.

## Point externe incontournable

Une plateforme réellement exploitable ne peut envoyer de SMS ni encaisser Airtel Money sans accès fournisseur valide. Le code sera sécurisé pour refuser proprement ces opérations tant que ces accès ne sont pas disponibles, sans prétendre qu’elles ont réussi.