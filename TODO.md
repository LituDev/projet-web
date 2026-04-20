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
- [ ] Requêtes SQL **uniquement paramétrées** (jamais de concat) — lint rule si possible
- [ ] EJS : pas de `<%- %>` sur données user (échappement par défaut `<%= %>`)
- [ ] Validation taille body (`express.json({ limit: '200kb' })`) + rejet types MIME inattendus
- [ ] Upload : `multer` + whitelist MIME (jpeg/png/webp) + taille max 2 Mo + renommage fichier (pas de nom client)
- [ ] Audit log : table `audit_log` (user_id, action, target, timestamp) pour toutes les actions admin

### 4c. Livraison / modes d'expédition

- [ ] Enum `delivery_mode` : `pickup_store` (lieu de vente) · `pickup_relay` (point relais) · `home_delivery` (livraison à domicile)
- [ ] Table `points_relais` (id, nom, adresse, lat/lon, horaires) — seed avec 5-10 points réalistes
- [ ] Colonne `produits.shippable` (bool) : un producteur marque si le produit peut être expédié (exigence PDF "si l'expédition est possible")
- [ ] Règle : `home_delivery` non disponible si **un seul** article du panier a `shippable = false`
- [ ] Règle : `pickup_store` disponible uniquement si tous les articles proviennent du **même** lieu de vente (sinon proposer split commande)
- [ ] Règle : `pickup_relay` disponible si tous les articles sont `shippable`
- [ ] Grille tarifaire simple (seed en base, table `shipping_rates`) :
  - `pickup_store` → 0 €
  - `pickup_relay` → 2,50 € forfait
  - `home_delivery` → 4,90 € si total < 50 €, sinon 0 € (franco de port)
- [ ] Endpoint `POST /api/commandes/quote` : reçoit panier + mode, renvoie modes disponibles, frais de port, total TTC
- [ ] Affichage côté client (checkout) : radio PrimeVue avec mode + prix + ETA indicatif ("sous 2-3 jours"), modes grisés si indisponibles avec raison
- [ ] Workflow statut commande : `pending` → `accepted` | `refused` → `preparing` → `ready_for_pickup` | `shipped` → `delivered` | `cancelled`
- [ ] Notification (toast + historique) à chaque changement de statut côté client

### 4d. Paiement (simulé — pas de vrai PSP)

- [ ] Table `paiements` (id, commande_id, montant, mode, status, created_at, fake_card_last4)
- [ ] Enum `payment_method` : `card_fake` · `on_pickup` (payer sur place en `pickup_store`) · `on_delivery` (COD en `home_delivery`)
- [ ] Écran checkout : composant `<FakeCardForm>` (PrimeVue `InputMask` pour `1234 5678 9012 3456`, `CVC`, `MM/YY`) — **purement UI**, aucune donnée carte réelle persistée, seulement les 4 derniers chiffres
- [ ] Règles de simulation :
  - Numéro se terminant par **`0000`** → paiement refusé (`declined`)
  - Numéro se terminant par **`0001`** → erreur réseau simulée (timeout 5s puis `error`)
  - Tout le reste → succès après 1,5s (spinner PrimeVue `ProgressSpinner`)
- [ ] Endpoint `POST /api/paiements` : valide montant vs quote, simule délai, retourne `status`
- [ ] Idempotence : header `Idempotency-Key` (UUID client) pour éviter double-paiement si retry
- [ ] Transaction PG : création commande + paiement + décrément stock dans un `BEGIN … COMMIT` (rollback si paiement échoue)
- [ ] Reçu : `GET /api/commandes/:id/recu.pdf` (génération via `pdfkit`) — bonus
- [ ] Badge visuel "Paiement simulé — aucun débit réel" sur le formulaire (transparence démo)
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
- [ ] `GET/POST/DELETE /api/favoris`
- [ ] `CRUD /api/liste-courses`
- [ ] `GET /api/historique`
- [x] `GET /api/geo/lieux` (via `v_lieux_ouverts_maintenant` si `?ouverts=1`) → `server/src/modules/geo/router.js`
- [x] `POST /api/geo/itineraire` (nearest-neighbor + 2-opt serveur) → `server/src/modules/geo/service.js`
- [ ] `POST /api/alertes` (dysfonctionnements)

## 6. Gestion des utilisateurs & permissions

- [ ] Table `utilisateurs` (id, login, email, password_hash, role, created_at)
- [ ] Enum `role` en base : `admin`, `seller`, `user` (+ `visitor` non persistant, pour les non-connectés)
- [ ] Seed d'un **super administrateur** par défaut (`admin@gumes.local`)
- [x] Middleware `requireAuth(req, res, next)` — vérifie session active → `server/src/middlewares/auth.js`
- [x] Middleware `requireRole(...roles)` — 403 si `req.session.user.role` n'est pas dans la liste → `server/src/middlewares/auth.js`
- [x] Helper Vue `useAuth()` (Pinia store `session`) : `isAdmin`, `isSeller`, `isUser` → `client/src/stores/session.js`
- [ ] Directive Vue `v-can="'produit.edit'"` ou composant `<Can action="...">` pour masquer les boutons non autorisés

### Modes / rôles

#### Admin mode (`admin`)
- [ ] Accès `/admin/*` protégé par `requireRole('admin')`
- [ ] Dashboard : stats globales (users, commandes, CA, alertes ouvertes)
- [ ] CRUD users (promouvoir/rétrograder `seller` ↔ `user`, désactiver un compte)
- [ ] Modération produits (forcer visibilité = hidden)
- [ ] Traiter / clôturer les alertes de dysfonctionnement
- [ ] Voir les logs d'audit (qui a fait quoi, quand)
- [ ] Thème interface : accent rouge/ambre (`--p-primary-color`)

#### Seller mode (`seller` — producteur)
- [ ] Accès `/seller/*` protégé par `requireRole('seller', 'admin')`
- [ ] Gérer son compte (modifier / se désinscrire)
- [ ] CRUD entreprise(s) — **uniquement les siennes** (filtre `where owner_id = :me`)
- [ ] CRUD lieux de vente (+ horaires) — **uniquement les siens**
- [ ] CRUD produits — **uniquement les siens** ; visibilité (saison, stock, masqué)
- [ ] Voir ses commandes entrantes ; accepter / refuser
- [ ] NE PEUT PAS : voir les commandes d'autres producteurs, modifier un autre compte
- [ ] Thème interface : accent vert (`--p-primary-color`)

#### User mode (`user` — client)
- [ ] Accès `/app/*` protégé par `requireRole('user', 'admin')`
- [ ] Gérer son compte (modifier / se désinscrire)
- [ ] Parcourir catalogue, carte, fiches produits (lecture seule)
- [ ] Passer une commande (choix mode de livraison)
- [ ] Liste de courses + optimisation de parcours
- [ ] Favoris vendeurs
- [ ] Historique **de ses propres** commandes
- [ ] Émettre une alerte de dysfonctionnement
- [ ] NE PEUT PAS : voir les commandes d'autres clients, accéder à `/admin` ou `/seller`
- [ ] Thème interface : accent bleu (`--p-primary-color`)

#### Visitor (non authentifié)
- [ ] Pages publiques : accueil, catalogue en lecture, carte, fiche produit, inscription, connexion
- [ ] Toute action transactionnelle (commande, favori, liste) redirige vers `/login`

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
- [ ] Écran admin : gestion globale (users, produits, alertes)

## 7. Fonctionnalités Producteur

- [ ] Créer / modifier / supprimer un compte producteur
- [ ] CRUD entreprise(s)
- [ ] CRUD lieux de vente + adresses + horaires
- [ ] CRUD produits (nom, bio, nature, prix, stock, saison, visibilité)
- [ ] Consulter fiche détaillée d'un produit
- [ ] Accepter / refuser une commande
- [ ] Désinscription

## 8. Fonctionnalités Client

- [ ] Créer / modifier un compte client
- [ ] Parcourir catalogue / lieux de vente
- [ ] Visualiser lieux d'achat sur une **carte** (Leaflet ou équivalent léger)
- [ ] Passer une commande (choix mode : lieu de vente / point relais / livraison domicile)
- [ ] Constituer une **liste de courses**
- [ ] **Optimisation de parcours** (trajet optimisé pour récupérer les produits)
- [ ] **Géocodage** des adresses via **Nominatim (OSM)** — respecter rate-limit 1 req/s, cacher le résultat en base (colonnes `lat`, `lon`)
- [ ] Système de **favoris** (vendeurs)
- [ ] Historique des transactions
- [ ] Désinscription

## 9. Fonctionnalités transverses

- [ ] Système d'**alertes** pour dysfonctionnements
- [ ] Représentation **cartographique** des données
- [ ] Traitement **serveur** des données géographiques
- [ ] Gestion **visibilité produit** (saisonnier / indisponible / hors stock)
- [ ] Messages de confirmation / erreur pour chaque action
- [ ] Signalement visuel du rôle utilisateur (thème / menu)

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
- [ ] Utiliser `Toast` pour toutes les confirmations/erreurs d'action (exigence §9)
- [ ] Utiliser `ConfirmDialog` pour les suppressions (icône PrimeIcons `pi pi-trash`)
- [ ] Pages EJS pour rendu serveur initial + hydratation Vue (si SSR léger voulu)
- [ ] Thème par rôle : surcharger les CSS variables PrimeVue (`--p-primary-color`) selon `super_admin` / `producteur` / `client`
- [ ] Mode sombre : toggle via classe `.p-dark` sur `<html>` (preset Aura supporte)
- [ ] Icônes d'action claires via **PrimeIcons** (ex. `pi pi-trash` pour supprimer)
- [ ] Limiter le nombre de pages, regrouper les fonctionnalités

### 11b. Accessibilité (a11y) & i18n

- [ ] Labels explicites sur tous les champs (`<label for>` ou `aria-label`)
- [ ] Contraste AA (≥ 4.5:1) — vérifier avec DevTools
- [ ] Navigation clavier complète (focus visible, ordre logique, skip-link)
- [ ] `lang="fr"` sur `<html>`, attributs `aria-*` sur composants custom
- [ ] PrimeVue locale FR (`primevue.locale.fr`), `Intl.DateTimeFormat('fr-FR')`, `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`
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

- [ ] Appliquer les **100 bonnes pratiques** d'éco-conception web
- [ ] Minifier JS/CSS, compresser images (WebP), lazy-loading
- [ ] Imports PrimeVue à la carte (tree-shaking) — ne pas importer le package entier
- [ ] Un seul thème PrimeVue chargé, pas de CSS de thème concurrent
- [ ] Limiter requêtes réseau, cache agressif (Service Worker)
- [ ] Police système, pas de polices externes superflues
- [ ] Pas de tracker, analytics minimal
- [ ] Dark mode / mode sobre (réduction énergie écran)
- [ ] Mesurer l'empreinte (EcoIndex / GreenIT)

## 14. Déploiement (DL2)

- [ ] Dump SQL de la base (`db/dump.sql`)
- [ ] `README.md` : pré-requis, procédure d'installation, comptes de test
- [ ] Script de seed reproductible
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
