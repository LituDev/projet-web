# TODO — Projet : Gestion de la distribution des produits locaux

Application web de vente de produits locaux (module Technologies Web — IAI1).
Deadlines : DL1 mer. 22 avril 12h · DL2 ven. 24 avril 13h · DL3 démo ven. 24 avril.

---

## 0. Stack technique retenue

**Front-end :** HTML5, CSS, JavaScript (ES6 : classes, promesses, modules), DOM, Fetch API, JSON, **Vue.js** + **PrimeVue** (composants UI) + **PrimeIcons** + **@primevue/themes** (preset Aura/Lara).
**Back-end :** **Node.js** + **npm**, **Express**, **EJS** (templates), **PHP** (module annexe si besoin), **lowDB** (persistance légère / cache), **dotenv** (variables d'environnement).
**Base de données principale :** **PostgreSQL** via **docker compose** (décidé).
**Architecture :** SOA / micro-services, **Web Services REST**, **OpenAPI / Swagger**, HTTP.
**Concepts modernes :** **SPA**, **PWA**, **Service Workers / Web Workers**, **IndexedDB** (cache offline côté client), inspiration **TiddlyWiki**.
**Outils :** VS Code / Sublime Text, **Selenium WebDriver** (tests e2e), DevTools Firefox, **LightHouse** (audit perf), Git + GitHub/GitLab Pages, FTP / **PlanetHoster (World Lite)** pour déploiement.
**Transverse :** **éco-conception web** (réf. 100 bonnes pratiques), approche **Low-Tech**.

---

## 1. Organisation & cadrage (à faire en premier)

- [x] Constituer l'équipe (5 personnes) et lui donner un nom → **les gumes**
- [x] Choisir le nom de l'application → **gumes marketplace**
- [ ] Mettre en place un board **Kanban / Trello** (colonnes : Backlog / Sprint / Doing / Review / Done)
- [ ] Définir les sprints courts (1 journée) et planifier daily meetings
- [ ] Créer le dépôt Git (GitHub ou GitLab) + README + `.gitignore` Node *(différé)*
- [ ] Rédiger une charte de code (nommage, commentaires, commits conventionnels)

## 2. Conception (DL1)

- [x] Identifier les **cas d'utilisation** (super-admin, producteur, client, visiteur) → `docs/DL1-02-cas-utilisation.md`
- [x] Rédiger plusieurs **scénarios** associés (nominaux + erreurs) → `docs/DL1-02-cas-utilisation.md` §3
- [x] Choisir SGBD → **PostgreSQL** (via docker compose)
- [x] Écrire `docker-compose.yml` : service **`postgis/postgis:16-3.4`**, volume persistant, healthcheck, Adminer → `docker-compose.yml`
- [x] Activer extension `CREATE EXTENSION IF NOT EXISTS postgis;` → `db/init/01-extensions.sql` (+ pgcrypto, citext)
- [x] Colonnes géographiques `geography(Point, 4326)` pour adresses → `db/migrations/1000_init.sql`
- [x] Index **GIST** sur colonnes géographiques → idem
- [x] **Migrations** node-pg-migrate : fichiers `db/migrations/1000_init.sql` + `1001_views.sql`
- [x] `.env.example` → fichier créé avec toutes les variables documentées
- [ ] **Dockerfile dev** pour le Node — *différé (non critique pour DL1)*
- [x] Modèle conceptuel de données (MCD) → `docs/DL1-05-06-mcd-schema-logique.md` §5 (diagramme Mermaid ER + 13 règles de gestion)
- [x] Schéma logique (minimiser les NULL) → `docs/DL1-05-06-mcd-schema-logique.md` §6 (sous-tables par mode livraison, `produit_saison` séparée, `adresse_geocodee` séparée, `paiement_carte` séparée)
- [x] Script SQL de création (tables, contraintes, index) → `db/migrations/1000_init.sql` (+ triggers RG-02, RG-04, RG-10)
- [x] **Vues SQL** (7) → `docs/DL1-07-vues-sql.md` + `db/migrations/1001_views.sql` (v_produits_disponibles, v_commandes_detaillees, v_historique_client, v_stats_producteur, v_lieux_ouverts_maintenant, v_audit_recent + fonction `f_points_relais_proches`)
- [x] Jeu de données de test (@faker-js/faker locale fr) → `db/seeds/index.js` (1 admin, 10 producteurs, 30 clients, 10 points relais, ~60 produits, 50 commandes)
- [x] **Diagramme de Gantt** → `docs/DL1-09-gantt.md`
- [x] Tableau de répartition des tâches → `docs/DL1-10-repartition.md` (tableau + RACI)
- [ ] Livrable `DL1_gumes-marketplace_les-gumes.pdf` → compilation pandoc prévue mercredi matin

### 2b. Structure du rapport DL1 (le rapport compte fortement dans la note)

- [x] Page de couverture (app, équipe, membres, encadrant, date) → `docs/DL1-00-couverture.md`
- [x] Sommaire → `docs/DL1-00-couverture.md`
- [x] §1 Contexte & description de l'application → `docs/DL1-01-contexte.md`
- [x] §2 Cas d'utilisation (diagramme UML + liste textuelle par acteur) → `docs/DL1-02-cas-utilisation.md`
- [x] §3 Scénarios nominaux + scénarios d'erreur (≥ 2 par rôle) → `docs/DL1-02-cas-utilisation.md` §3
- [x] §4 Choix technologiques → `docs/DL1-04-choix-technologiques.md`
- [x] §5 MCD (diagramme entité-association) → `docs/DL1-05-06-mcd-schema-logique.md` §5
- [x] §6 Schéma logique → `docs/DL1-05-06-mcd-schema-logique.md` §6
- [x] §7 Vues SQL prévues → `docs/DL1-07-vues-sql.md`
- [x] §8 Architecture applicative → `docs/DL1-08-architecture.md`
- [x] §9 Diagramme de Gantt → `docs/DL1-09-gantt.md`
- [x] §10 Répartition des tâches → `docs/DL1-10-repartition.md`
- [x] §11 Risques identifiés + plan de mitigation → `docs/DL1-11-risques.md`
- [ ] Annexes : glossaire, références *(optionnel, à faire si temps)*

## 3. Architecture applicative

- [ ] Définir l'architecture **SOA / micro-services** (services : auth, catalogue, commandes, géo, alertes)
- [ ] Spécifier l'API REST via **OpenAPI / Swagger** (`openapi.yaml`)
- [ ] Structure de projet modulaire :
  - `server/` (Node.js + Express)
  - `server/modules/` (db, sessions, droits, affichage)
  - `server/routes/` (REST)
  - `server/views/` (EJS)
  - `client/` (Vue.js SPA)
  - `docs/` (OpenAPI, rapport)
  - `db/` (migrations, seeds, dump)
- [x] `.env` + `dotenv` (DB_URL, PORT, SESSION_SECRET, MAP_API_KEY…) → `server/src/config.js` (validation zod)
- [x] `package.json` avec scripts `dev`, `start`, `test`, `lint` → racine + `server/` + `client/` (workspaces npm)

## 4. Back-end — Node.js / Express

- [x] Initialiser projet (`npm init`, Express, EJS, dotenv) → `server/package.json` + `server/src/index.js`
- [x] Connexion PostgreSQL (pool `pg`) → `server/src/db/pool.js` (+ helper `withTransaction`)
- [ ] Module `lowDB` pour cache / données non critiques (favoris temporaires, drafts)
- [x] Middleware sessions (`express-session` + store PG) + cookies `httpOnly` + `sameSite=lax` + `secure` en prod → `server/src/app.js`
- [x] Middleware gestion des droits (`requireAuth`, `requireRole`) → `server/src/middlewares/auth.js`
- [x] Hachage des mots de passe (**argon2** préféré, sinon bcrypt coût ≥ 12) → `server/src/modules/auth/service.js`
- [x] Validation des entrées (formulaires + API) via **zod** ou **joi** → `zod` (config + auth)
- [x] Gestion centralisée des erreurs + logs **structurés** (`pino` + `pino-http`, request-id) → `server/src/middlewares/error.js` + `logger.js`
- [x] Route `/api/health` + documentation Swagger UI → `/api/health` OK · Swagger à venir

### 4b. Sécurité (critique)

- [x] **Helmet** (CSP, HSTS, X-Frame-Options…) → `server/src/app.js`
- [ ] **CSRF tokens** sur toutes les mutations (`csurf` ou double-submit cookie) — dépendance archivée, à remplacer par double-submit custom
- [x] **Rate-limit** sur `/api/auth/login` et `/api/auth/register` (`express-rate-limit`, 5/min/IP) → `auth/router.js`
- [x] **CORS** restreint à l'origine du front → `server/src/app.js` (origine `VITE_API_BASE_URL`)
- [x] Requêtes SQL **uniquement paramétrées** (jamais de concat) → toutes les requêtes `server/src/modules/**` utilisent `$1, $2…`
- [ ] EJS : pas de `<%- %>` sur données user (échappement par défaut `<%= %>`) — *non applicable, SPA sans EJS*
- [x] Validation taille body (`express.json({ limit: '200kb' })`) → `server/src/app.js` (MIME whitelist upload à faire avec multer si besoin)
- [ ] Upload : `multer` + whitelist MIME (jpeg/png/webp) + taille max 2 Mo + renommage fichier (pas de nom client)
- [x] Audit log : table `audit_log` + écritures sur actions admin → `db/migrations/1000_init.sql` (table) + `server/src/modules/admin/router.js` + `v_audit_recent` + `AdminAuditView.vue`

### 4c. Livraison / modes d'expédition

- [x] Enum `delivery_mode` : `pickup_store` · `pickup_relay` · `home_delivery` → `commande.mode_livraison` (`db/migrations/1000_init.sql`)
- [x] Table `point_relais` (+ `horaire_point_relais`) seedée avec 10 points en Bretagne → `db/migrations/1000_init.sql` + `db/seeds/index.js`
- [x] Colonne `produit.shippable` (bool) → `db/migrations/1000_init.sql`
- [x] Règle : `home_delivery` refusée si un article non shippable → `server/src/modules/commandes/service.js`
- [x] Règle : `pickup_store` refusée si articles de lieux différents → `server/src/modules/commandes/service.js`
- [x] Règle : `pickup_relay` nécessite tous les articles shippable → `server/src/modules/commandes/service.js`
- [x] Table `shipping_rate` avec tarifs seedés (pickup_store=0, pickup_relay=2,50€, home_delivery=4,90€ / franco ≥ 50€) → migrations + service
- [x] Endpoint `POST /api/commandes/quote` → `server/src/modules/commandes/router.js`
- [ ] Affichage côté client (checkout) : radio PrimeVue avec mode + prix + ETA indicatif ("sous 2-3 jours"), modes grisés si indisponibles avec raison — *radio + prix OK, ETA à ajouter*
- [x] Workflow statut commande : `pending` → `accepted` | `refused` → `preparing` → `ready_for_pickup` | `shipped` → `delivered` | `cancelled` → `db/migrations/1000_init.sql` + transitions dans `commandes/service.js`
- [ ] Notification (toast + historique) à chaque changement de statut côté client — *toasts ponctuels OK, auto-refresh statut à faire*

### 4d. Paiement (simulé — pas de vrai PSP)

- [x] Table `paiement` (+ `paiement_carte` séparée pour last4) → `db/migrations/1000_init.sql`
- [x] Enum `payment_method` : `card_fake` · `on_pickup` · `on_delivery` → colonne `paiement.methode`
- [x] Écran checkout : `<InputMask>` pour numéro + CVC + MM/YY → `client/src/views/CheckoutView.vue`
- [x] Règles de simulation (`0000` → declined, `0001` → error timeout, sinon success après délai) → `server/src/modules/paiement/service.js`
- [x] Endpoint `POST /api/paiements` → `server/src/modules/paiement/router.js`
- [x] Idempotence : header `Idempotency-Key` + dédup SQL → `server/src/modules/paiement/router.js`
- [x] Transaction PG : `withTransaction()` autour insert paiement + carte → `server/src/modules/paiement/service.js`
- [ ] Reçu : `GET /api/commandes/:id/recu.pdf` (génération via `pdfkit`) — bonus
- [x] Badge visuel "Paiement simulé — aucun débit réel" → `CheckoutView.vue`
- [ ] Remboursement admin : bouton `Rembourser` sur commande annulée (change `paiement.status = refunded`, écrit dans `audit_log`)

## 5. API REST (endpoints minimaux)

- [x] `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` (+ `GET /api/auth/me`) → `server/src/modules/auth/router.js`
- [ ] `GET/PUT /api/users/me` · `DELETE /api/users/me` (désinscription)
- [x] `CRUD /api/entreprises` (producteur) → `server/src/modules/catalogue/entreprises.js`
- [x] `CRUD /api/lieux-de-vente` (+ horaires d'ouverture) → `server/src/modules/catalogue/lieux.js`
- [x] `CRUD /api/produits` (+ visibilité / saisonnalité / stock) → `server/src/modules/catalogue/produits.js` (GET public via `v_produits_disponibles`)
- [x] `POST /api/commandes/quote` · `POST /api/commandes` · `GET /api/commandes` · `PATCH /api/commandes/:id` → `server/src/modules/commandes/`
- [x] `POST /api/paiements` (simulé, `Idempotency-Key`, règles carte 0000/0001) · `GET /api/paiements/:id` → `server/src/modules/paiement/`
- [x] `GET /api/geo/points-relais` (liste + proximité KNN via `f_points_relais_proches`) → `server/src/modules/geo/`
- [x] `GET/POST/DELETE /api/favoris` → `server/src/modules/favoris/router.js`
- [x] `CRUD /api/liste-courses` (+ items) → `server/src/modules/liste-courses/router.js`
- [x] `GET /api/historique` → exposé via `GET /api/commandes` filtré par rôle · vue `HistoriqueView.vue`
- [x] `GET /api/geo/lieux` (via `v_lieux_ouverts_maintenant` si `?ouverts=1`) → `server/src/modules/geo/router.js`
- [x] `POST /api/geo/itineraire` (nearest-neighbor + 2-opt serveur) → `server/src/modules/geo/service.js`
- [x] `POST /api/alertes` (+ GET admin · GET /mine · PATCH statut) → `server/src/modules/alertes/router.js`

## 6. Gestion des utilisateurs & permissions

- [x] Table `utilisateur` (id, email, password_hash, role, created_at, last_login_at) → `db/migrations/1000_init.sql`
- [x] Enum `role` CHECK : `admin` · `seller` · `user` (+ `visitor` non persistant) → idem
- [x] Seed `admin@gumes.local` par défaut → `db/seeds/index.js`
- [x] Middleware `requireAuth(req, res, next)` — vérifie session active → `server/src/middlewares/auth.js`
- [x] Middleware `requireRole(...roles)` — 403 si `req.session.user.role` n'est pas dans la liste → `server/src/middlewares/auth.js`
- [x] Helper Vue `useAuth()` (Pinia store `session`) : `isAdmin`, `isSeller`, `isUser` → `client/src/stores/session.js`
- [ ] Directive Vue `v-can="'produit.edit'"` ou composant `<Can action="...">` pour masquer les boutons non autorisés

### Modes / rôles

#### Admin mode (`admin`)
- [x] Accès `/admin/*` protégé → `client/src/router/index.js` + `requireRole('admin')` côté serveur
- [x] Dashboard : stats globales → `AdminDashboardView.vue` + `GET /api/admin/stats`
- [x] CRUD users (promouvoir/rétrograder, désactiver) → `server/src/modules/admin/router.js` + `AdminUsersView.vue`
- [ ] Modération produits (forcer visibilité = hidden) — *colonne existe, UI admin dédiée à ajouter*
- [x] Traiter / clôturer les alertes → `alertes/router.js` PATCH statut · vue admin
- [x] Voir les logs d'audit → `GET /api/admin/audit` + `AdminAuditView.vue`
- [x] Thème interface : accent rouge → classe CSS `role-admin` (`style.css` + `session.applyRoleTheme()`)

#### Seller mode (`seller` — producteur)
- [x] Accès `/seller/*` protégé → router + `requireRole('seller','admin')`
- [ ] Gérer son compte (modifier / se désinscrire) — *désinscription OK, `PUT /api/users/me` à ajouter*
- [x] CRUD entreprise(s) filtré par `owner_id` → `server/src/modules/catalogue/entreprises.js`
- [x] CRUD lieux de vente + horaires → `server/src/modules/catalogue/lieux.js`
- [x] CRUD produits (visibilité, saison, stock) → `server/src/modules/catalogue/produits.js`
- [x] Voir ses commandes entrantes ; accepter / refuser → `commandes/router.js` filtré
- [x] Isolation via `requireRole` + filtres owner_id → middleware `auth.js`
- [x] Thème interface : accent vert → classe CSS `role-seller`

#### User mode (`user` — client)
- [x] Accès `/app/*` protégé → router + `requireRole('user','admin')`
- [ ] Gérer son compte (modifier / se désinscrire) — *désinscription OK, `PUT /api/users/me` à ajouter*
- [x] Parcourir catalogue, carte, fiches → `CatalogueView.vue`, `CarteView.vue`, `ProduitDetailView.vue`
- [x] Passer une commande → `CheckoutView.vue`
- [x] Liste de courses + optimisation → `ListeCoursesView.vue` + worker + `POST /api/geo/itineraire`
- [x] Favoris vendeurs → `favoris/router.js` + vue
- [x] Historique de ses propres commandes → `HistoriqueView.vue`
- [x] Émettre une alerte → `alertes/router.js` + vue
- [x] Isolation via `requireRole` + filtres client_id
- [x] Thème interface : accent bleu → classe CSS `role-user`

#### Visitor (non authentifié)
- [x] Pages publiques : accueil, catalogue, carte, fiche produit, inscription, connexion → `router/index.js` sans `meta.roles`
- [x] Toute action transactionnelle redirige / bloque via guards (`session` store + `requireAuth` côté API)

### Matrice de permissions (à faire côté back ET front)

| Action                          | visitor | user | seller | admin |
|---------------------------------|:-:|:-:|:-:|:-:|
| Voir catalogue / carte          | ✅ | ✅ | ✅ | ✅ |
| Créer un compte                 | ✅ | — | — | — |
| Passer une commande             | ❌ | ✅ | ❌ | ✅ |
| CRUD ses produits               | ❌ | ❌ | ✅ | ✅ |
| Accepter/refuser une commande   | ❌ | ❌ | ✅ (les siennes) | ✅ |
| CRUD tous les users             | ❌ | ❌ | ❌ | ✅ |
| Traiter alertes                 | ❌ | ❌ | ❌ | ✅ |
| Changer son rôle                | ❌ | ❌ | ❌ | ❌ (admin only) |

- [ ] **Tests e2e** d'accès : chaque rôle doit recevoir 403 sur les routes interdites
- [x] Écran admin : gestion globale (users, produits, alertes) → `AdminDashboardView.vue` + `AdminUsersView.vue` + `AdminAuditView.vue`

## 7. Fonctionnalités Producteur

- [ ] Créer / modifier / supprimer un compte producteur — *création via register, suppression OK, modification à ajouter*
- [x] CRUD entreprise(s)
- [x] CRUD lieux de vente + adresses + horaires
- [x] CRUD produits (nom, bio, nature, prix, stock, saison, visibilité)
- [x] Consulter fiche détaillée d'un produit → `ProduitDetailView.vue`
- [x] Accepter / refuser une commande → `commandes/router.js` PATCH
- [x] Désinscription → `admin/router.js` (self-unregister)

## 8. Fonctionnalités Client

- [ ] Créer / modifier un compte client — *création OK, modification à ajouter*
- [x] Parcourir catalogue / lieux de vente → `CatalogueView.vue`
- [x] Visualiser lieux sur une **carte Leaflet** → `CarteView.vue`
- [x] Passer une commande (3 modes) → `CheckoutView.vue` + `commandes/service.js`
- [x] Constituer une **liste de courses** → `liste-courses/router.js` + `ListeCoursesView.vue`
- [x] **Optimisation de parcours** → worker client + `POST /api/geo/itineraire` (nearest-neighbor + 2-opt)
- [x] **Géocodage Nominatim** → `server/src/modules/geocode/service.js` + table `adresse_geocodee` (cache)
- [x] Système de **favoris** (vendeurs) → `favoris/router.js` + vue
- [x] Historique des transactions → `HistoriqueView.vue`
- [x] Désinscription → self-unregister

## 9. Fonctionnalités transverses

- [x] Système d'**alertes** pour dysfonctionnements → `alertes/router.js` + vues
- [x] Représentation **cartographique** des données → `CarteView.vue` (Leaflet)
- [x] Traitement **serveur** des données géographiques → PostGIS + `f_points_relais_proches` + `geo/service.js`
- [x] Gestion **visibilité produit** (saisonnier / indisponible / hors stock) → colonnes + `v_produits_disponibles`
- [x] Messages de confirmation / erreur pour chaque action → `Toast` PrimeVue
- [x] Signalement visuel du rôle utilisateur → thème + pill email/rôle dans `App.vue`

## 10. Fonctionnalités supplémentaires (≥ 3 pour points bonus)

- [x] **Web Worker** pour l'optimisation de trajet → `client/src/workers/trajet.worker.js`
- [x] **Algo trajet optimisé** — nearest-neighbor + 2-opt côté client (Web Worker) ET côté serveur (`POST /api/geo/itineraire`)
- [x] Recherche + filtres (bio, nature) → `CatalogueView.vue`
- [x] Audit log des actions admin → `v_audit_recent` + `AdminAuditView.vue`
- [ ] Notation / avis sur producteurs
- [ ] Reset password par email (ou token affiché en console dev pour la démo)

## 11. Front-end — Vue.js + PrimeVue (SPA)

- [x] Bootstrap projet Vue (Vite) dans `client/` → `client/vite.config.js` + `client/index.html`
- [x] Installer **PrimeVue** + **PrimeIcons** + **@primeuix/themes** (migré depuis `@primevue/themes` désormais déprécié)
- [x] Configurer le plugin PrimeVue dans `client/src/main.js` (preset Aura, `ripple: true`, locale FR)
- [x] Activer les services PrimeVue : `ToastService`, `ConfirmationService`, `DialogService`
- [x] Importer `primeicons/primeicons.css` + le thème Aura
- [x] Routing (vue-router) : accueil, catalogue, carte, `/app/compte` (reste panier/admin à câbler) → `client/src/router/index.js`
- [x] Store (Pinia) : `session` ; reste `panier`, `favoris`, `liste-courses` → `client/src/stores/session.js`
- [x] Service API (Fetch + JSON) avec gestion erreurs → `client/src/services/api.js`
- [ ] S'appuyer sur PrimeVue : `Menubar`, `DataTable`, `Card`, `Dialog`, `Toast`, `ConfirmDialog`, `FileUpload`, `AutoComplete`, `InputText`, `Password`, `Dropdown`, `Calendar`, `DataView`
- [ ] Composants métier (wrappers fins) : `ProduitCard` (autour de `Card`), `LieuMap` (Leaflet intégré), `FormField` (wrapper `InputText`/`Dropdown` avec label + erreur)
- [x] Utiliser `Toast` pour toutes les confirmations/erreurs d'action → partout dans les vues
- [ ] Utiliser `ConfirmDialog` pour les suppressions (icône PrimeIcons `pi pi-trash`) — *`ConfirmDialog` monté dans `App.vue` mais non câblé sur les suppressions*
- [ ] Pages EJS pour rendu serveur initial + hydratation Vue — *non retenu (SPA pure)*
- [x] Thème par rôle (CSS variables) → `style.css` + `session.applyRoleTheme()`
- [ ] Mode sombre : toggle via classe `.p-dark`
- [x] Icônes PrimeIcons pour les actions → `pi pi-*` partout
- [x] Limiter le nombre de pages / grouper les fonctionnalités → SPA ~15 vues regroupées par rôle (`/admin/*`, `/seller/*`, `/app/*`)

### 11b. Accessibilité (a11y) & i18n

- [ ] Labels explicites sur tous les champs (`<label for>` ou `aria-label`)
- [ ] Contraste AA (≥ 4.5:1) — vérifier avec DevTools
- [ ] Navigation clavier complète (focus visible, ordre logique, skip-link)
- [x] `lang="fr"` sur `<html>` → `client/index.html` (+ `aria-label` partiels)
- [x] PrimeVue locale FR + `Intl.NumberFormat('fr-FR', currency EUR)` → `main.js` + vues (CatalogueView, CheckoutView…)
- [ ] Messages d'erreur/succès lisibles lecteur d'écran (`aria-live="polite"` sur `Toast`)

### 11c. RGPD (minimal — ce qui est déjà fait)

- [x] Suppression de compte = anonymisation (soft delete + `email = 'deleted-<id>@anon'`) → `server/src/modules/admin/router.js`

## 12. Qualité, tests, audit

- [ ] Tests unitaires back (Jest/Vitest)
- [ ] Tests end-to-end avec **Selenium WebDriver** (scénarios clients + producteurs)
- [ ] Debug via outils Firefox
- [ ] Audit **Lighthouse** (perf / accessibilité / PWA / SEO) — score cible ≥ 90
- [ ] Linter (ESLint) + formatter (Prettier)
- [ ] Revue de code croisée avant merge

## 13. Éco-conception & Low-Tech

- [ ] Appliquer les **100 bonnes pratiques** d'éco-conception web — *audit global à faire*
- [ ] Minifier JS/CSS, compresser images (WebP) — *Vite minifie en build ; `loading="lazy"` ajouté sur images produit*
- [x] Imports PrimeVue à la carte (tree-shaking) → imports nommés (`primevue/button` etc.)
- [x] Un seul thème PrimeVue (preset Aura) → `main.js`
- [ ] Cache agressif (Service Worker / PWA)
- [ ] Police système, pas de polices externes superflues — *à vérifier*
- [x] Pas de tracker, analytics minimal → aucun tracker embarqué
- [ ] Dark mode / mode sobre
- [ ] Mesurer l'empreinte (EcoIndex / GreenIT)

## 14. Déploiement (DL2)

- [ ] Dump SQL de la base (`db/dump.sql`)
- [x] `README.md` : pré-requis, procédure d'installation, comptes de test → `README.md`
- [x] Script de seed reproductible → `db/seeds/index.js` (`faker.seed(42)`)
- [ ] Déploiement statique front sur **GitHub Pages** / **GitLab Pages**
- [ ] Déploiement Node sur **PlanetHoster (World Lite)** via **FTP**
- [ ] Vérifier HTTPS + variables d'environnement de prod
- [ ] Archive `DL2_NomApplication_NomEquipe.zip` (code + README + dump)

## 15. Démonstration (DL3 — 10 min)

- [ ] Scénario de démo couvrant : création compte, commande, carte, trajet optimisé, admin, alerte
- [ ] Répartir les prises de parole entre les 5 membres
- [ ] Slides de présentation (points forts + bonus)
- [ ] Environnement de démo stable + jeu de données réaliste
- [ ] Prévoir plan B (vidéo de secours)
