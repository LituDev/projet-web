# DL1 — §11 Risques identifiés et plan de mitigation

Les risques sont cotés sur deux axes : **P** probabilité (1 faible → 5 élevée) et **I** impact (1 mineur → 5 bloquant). **Score = P × I**.

## 11.1 Risques techniques

| # | Risque | P | I | Score | Mitigation |
|---|---|---|---|---|---|
| T-1 | Installation PostGIS échoue sur une machine (Windows / WSL) | 3 | 4 | 12 | Docker Compose sur `postgis/postgis:16` — isole de l'OS. Chaque membre fait un `docker compose up -d` dès lundi soir. |
| T-2 | Performance requête de proximité dégradée (~1000 lieux) | 2 | 3 | 6 | Index GIST obligatoire sur toute colonne `geom` (vérifié par test `EXPLAIN`). |
| T-3 | Rate-limit Nominatim dépassé pendant le seed | 4 | 4 | 16 | Géocodage **offline** : adresses fictives seedées avec `lat`/`lon` générés via faker-js (random dans une bounding-box de la France). Pas d'appel live Nominatim en DL2. |
| T-4 | Algorithme d'optimisation trajet trop lent (> 2 s) en Web Worker | 3 | 2 | 6 | Borner le nombre de points à 15 côté UI. Nearest-neighbor + 2-opt suffisant à cette échelle. |
| T-5 | Incompatibilité Vue 3 + PrimeVue + Leaflet (ref/reactive) | 3 | 3 | 9 | Utiliser `shallowRef` pour l'instance Leaflet (pratique documentée Vue 3). |
| T-6 | Fuite de mémoire sur `pg.Pool` en cas de `throw` dans une transaction | 3 | 4 | 12 | Pattern `try { … } finally { client.release(); }` systématique, linting custom. |
| T-7 | CSRF double-submit qui casse les requêtes Vue | 3 | 3 | 9 | Lire le cookie CSRF et l'envoyer en header via interceptor dans `services/api.js`. Tester en premier. |
| T-8 | `connect-pg-simple` mal configuré → sessions perdues à chaque restart | 2 | 4 | 8 | Configurer `createTableIfMissing: true` + `pruneSessionInterval`. Tester redémarrage du serveur. |

## 11.2 Risques projet / planning

| # | Risque | P | I | Score | Mitigation |
|---|---|---|---|---|---|
| P-1 | Pas de dépôt Git centralisé → conflits de merge / perte de code | **5** | **5** | **25** | **Action immédiate** : créer un dépôt GitHub même privé avant mardi matin. À défaut, partage par dossier réseau avec une personne responsable du *merge manuel*. |
| P-2 | Un membre absent (maladie) pendant 1 jour | 3 | 4 | 12 | Pair-programming préalable sur les modules sensibles. Charge estimée à 88 h pour 90 h budget → 2 h de marge seulement, toute absence devra être absorbée par les 4 autres. |
| P-3 | Dépassement du deadline DL1 12h mercredi | 2 | 5 | 10 | Compilation du rapport planifiée mercredi à 10h (2 h de marge). Dépôt à 11h45. |
| P-4 | Dépassement deadline DL2 13h vendredi | 3 | 5 | 15 | Geler les features à jeudi 18h, vendredi matin uniquement bugs + livrables. Zip à 12h50. |
| P-5 | Démo DL3 plantage en direct | 3 | 4 | 12 | Préparer une **vidéo de secours** (screencast 10 min, réalisé jeudi soir). Jeu de données réaliste pré-seedé, pas d'appel réseau externe. |
| P-6 | Interprétation du cahier des charges divergente dans l'équipe | 3 | 3 | 9 | Ce rapport DL1 sert de référence — aligné collectivement lundi. Toute divergence est tranchée par M1 (lead). |

## 11.3 Risques fonctionnels / métier

| # | Risque | P | I | Score | Mitigation |
|---|---|---|---|---|---|
| F-1 | Règle de livraison mixte mal interprétée (panier avec produits shippable=false ET true) | 4 | 3 | 12 | Endpoint `/api/commandes/quote` renvoie les modes autorisés + raison, UI grise ceux indisponibles avec info-bulle. Test e2e dédié. |
| F-2 | Panier multi-lieux en mode `pickup_store` → besoin de split commande | 3 | 4 | 12 | En DL2 on refuse le mode (cf. RG-05) ; un message propose au client de scinder manuellement. Le split automatique est hors scope DL2. |
| F-3 | Stock décrémenté mais paiement refusé → commande fantôme | 4 | 4 | 16 | Transaction PG unique : paiement échoue → `ROLLBACK` → stock restauré. Test automatisé. |
| F-4 | Double paiement (double-clic utilisateur) | 4 | 4 | 16 | Header `Idempotency-Key` obligatoire côté client (UUID généré avant `POST`). Contrainte `UNIQUE` en base. |
| F-5 | Client voit les commandes d'un autre client (fuite de données) | 2 | 5 | 10 | Middleware qui force `WHERE client_id = req.session.user.id` dans toutes les queries d'historique. Test e2e de tentative d'accès `403`. |
| F-6 | Producteur voit / modifie les produits d'un autre producteur | 3 | 5 | 15 | Même pattern : filtre `WHERE entreprise.owner_id = req.session.user.id`. Test e2e 403. |
| F-7 | Admin accidentellement supprime son propre compte ou son rôle | 2 | 5 | 10 | Impossible par design : `admin` ne peut pas modifier son propre rôle (RG-13). |

## 11.4 Risques de sécurité

| # | Risque | P | I | Score | Mitigation |
|---|---|---|---|---|---|
| S-1 | Injection SQL | 2 | 5 | 10 | 100 des queries paramétrées (`$1, $2`). Revue de code ciblée (grep de `${` dans `queries/`). |
| S-2 | XSS via description produit | 3 | 4 | 12 | EJS échappe par défaut (`<%= %>`), Vue échappe automatiquement ({{ }}). Jamais de `v-html` sur donnée utilisateur. |
| S-3 | Session hijacking | 2 | 5 | 10 | Cookies `httpOnly` + `sameSite=lax` + `secure` en prod. Regénération du `sid` au login (`req.session.regenerate`). |
| S-4 | Attaque par force brute sur login | 4 | 3 | 12 | `express-rate-limit` : 5 tentatives / 60 s / IP sur `/api/auth/login`. Temps constant sur les 404 utilisateur inexistant. |
| S-5 | Upload de fichier malveillant | 3 | 4 | 12 | `multer` avec whitelist MIME (jpeg/png/webp uniquement), taille max 2 Mo, renommage UUID, pas d'exécution côté serveur. |
| S-6 | CSRF | 3 | 4 | 12 | `csurf` (ou double-submit cookie) sur toutes les mutations. Token relu côté Vue. |
| S-7 | Divulgation d'informations par messages d'erreur (stack trace) | 2 | 3 | 6 | `NODE_ENV=production` → handler error masque la trace, renvoie un `requestId` pour corrélation. |

## 11.5 Risques RGPD / légal

| # | Risque | P | I | Score | Mitigation |
|---|---|---|---|---|---|
| R-1 | Données personnelles conservées après désinscription | 3 | 4 | 12 | `DELETE /api/users/me` = anonymisation (email remplacé, profil vidé, `deleted_at` posé). Les commandes restent pour des raisons comptables. |
| R-2 | Absence de mentions légales / politique confidentialité | 4 | 3 | 12 | Pages `/mentions-legales` et `/politique-confidentialite` rédigées en DL2 (template CNIL). |
| R-3 | Absence de bandeau cookies | 2 | 2 | 4 | Uniquement cookies techniques (session, CSRF) → pas de consentement exigé, mais bandeau d'information. |

## 11.6 Synthèse — top 5 des risques à surveiller

1. **P-1** (score 25) — Pas de Git → **action immédiate**.
2. **T-3** (16) — Rate-limit Nominatim → géocodage offline dès le seed.
3. **F-3** / **F-4** (16) — cohérence stock/paiement, idempotence → transaction unique + UNIQUE key.
4. **F-6** / **P-4** (15) — Cross-tenant + deadline DL2 → tests e2e 403 + gel features jeudi 18h.
5. **S-1…S-6** (cluster 10-12) — surface sécurité : un passage revue dédié vendredi matin.

---

*Équipe les gumes — 2026-04-20.*
