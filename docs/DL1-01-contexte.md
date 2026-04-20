# DL1 — §1 Contexte & description de l'application

## 1.1 Commanditaire et besoin

Le commanditaire — incarné par notre encadrant — souhaite mettre à la disposition du grand public une **plateforme web de vente à grande échelle de produits locaux**. L'idée centrale est de raccourcir le circuit entre les petits producteurs (maraîchers, fromagers, apiculteurs, vignerons, éleveurs…) et les consommateurs finaux, en leur offrant une interface de vente en ligne simple, une visibilité sur une carte et la possibilité de choisir parmi plusieurs modes de récupération des produits.

Le périmètre défini par le cahier des charges se situe à la croisée de trois domaines :
1. **E-commerce** (catalogue, panier, commande, paiement, livraison),
2. **Gestion cartographique** (carte des lieux de vente, optimisation de parcours),
3. **Communauté** (favoris vendeurs, alertes de dysfonctionnement, notation).

## 1.2 Reformulation du cahier des charges

L'application doit permettre :

- À **chaque producteur**, de gérer une ou plusieurs entreprises, chacune pouvant exploiter plusieurs **lieux de vente physiques** avec leurs adresses et horaires d'ouverture. Les producteurs déclarent leur catalogue (nom, nature, prix, stock, saisonnalité, caractère bio, possibilité d'expédition) et traitent les commandes qui leur sont adressées.
- À **chaque client**, de parcourir le catalogue, de visualiser les lieux d'achat sur une carte, de constituer une liste de courses, d'optimiser son parcours pour récupérer ses produits, de passer commande en choisissant le mode de récupération (retrait en lieu de vente, point relais, livraison à domicile), et de consulter l'historique de ses transactions. Un système de favoris lui permet de conserver ses vendeurs préférés.
- À **un super-administrateur** de superviser la plateforme : gestion des utilisateurs, modération de contenu, traitement des alertes de dysfonctionnement, consultation du journal d'audit.

Le sujet impose par ailleurs :
- la présence d'un **système d'alertes** pour signaler les dysfonctionnements ;
- une **représentation cartographique** des données ;
- un **traitement serveur** des données géographiques (et non uniquement client) ;
- une gestion de la **visibilité** des produits par les producteurs (produit saisonnier, hors stock, masqué) ;
- **au moins trois fonctionnalités supplémentaires** pour espérer les points bonus.

## 1.3 Positionnement et ambition

### Ce que l'application est
- Une **marketplace locale** à deux côtés (producteurs + clients) avec tiers-administrateur.
- Une **SPA** Vue.js adossée à une API REST Node/Express et à une base PostgreSQL+PostGIS.
- Un outil résolument **français** (locale FR, RGPD, adresses françaises, ~points relais typiques France).

### Ce que l'application n'est pas
- Un vrai système de paiement : le paiement est **simulé** (pas d'intégration Stripe/Adyen), avec un formulaire carte factice à seuls fins de démonstration du flux.
- Un site grand public en production : pas d'intégration SMS/email transactionnel réel, pas de HTTPS auto-signé côté DL2 (déploiement PlanetHoster gère le TLS).
- Une place de marché multi-marchands agrégée (type Amazon) : pas de panier multi-vendeurs éclaté en sous-commandes avec split paiement ; toutefois les règles de livraison croisées entre lieux de vente sont prises en compte (§4c du TODO).

## 1.4 Publics visés

| Persona | Âge / profil | Attente principale | Contrainte |
|---|---|---|---|
| **Claire, 35 ans, parent actif** (client) | urbaine, engagée, soucieuse de l'origine | Trouver rapidement des produits locaux et planifier un tour avec les enfants. | Peu de temps, veut une interface mobile simple. |
| **Marc, 58 ans, maraîcher bio** (producteur) | exploitation familiale, peu familier de l'outil numérique | Saisir ses produits sans effort, recevoir/accepter des commandes. | Interface tolérante aux fautes, grandes polices. |
| **Thomas, administration** (admin) | gestionnaire de plateforme | Superviser, modérer, auditer. | Vue globale rapide, actions en 2 clics. |
| **Léa, 22 ans, visiteuse** | curieuse, découvre | Voir la carte et le catalogue sans créer de compte. | Aucune friction tant qu'elle n'achète pas. |

## 1.5 Contraintes non fonctionnelles

- **Éco-conception** : ≤ 1 Mo transféré pour la page d'accueil, lazy-loading images, polices système, pas de tracker, cache agressif via Service Worker.
- **Accessibilité** : contraste AA, navigation clavier complète, lecteur d'écran compatible, `lang="fr"`.
- **Performance** : score Lighthouse ≥ 90 sur chacune des 4 catégories (perf, a11y, PWA, SEO).
- **RGPD** : minimisation des données, droit à l'export (`GET /api/users/me/export`), anonymisation à la désinscription.
- **Sécurité** : OWASP Top 10 couvert par helmet, CSRF, rate-limit, argon2, requêtes paramétrées, validation zod.

## 1.6 Équipe et méthode

5 membres, méthode agile, sprints quotidiens, daily de 15 min à 9h30, board Kanban. La conception (§ 2 à 8 de ce rapport) est produite **collectivement** le lundi 20 avril, l'implémentation est répartie par spécialité (voir §10).

---

*Équipe les gumes — 2026-04-20.*
