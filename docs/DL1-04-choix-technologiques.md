# DL1 — §4 Choix technologiques et justifications

## 4.1 Vue d'ensemble

| Couche | Technologie retenue | Alternative écartée | Raison principale |
|---|---|---|---|
| SGBD | **PostgreSQL 16 + PostGIS** | MySQL 8 | Types géographiques natifs (`geography`), index GIST, extensions riches. La carte et l'optimisation de parcours exigent des requêtes spatiales (rayon, distance, tri par proximité) que MySQL couvre mal. |
| Conteneurisation | **Docker Compose** (image `postgis/postgis:16`) | Installation native | Reproductibilité, isolation, même configuration pour les 5 membres de l'équipe. |
| Migrations | **node-pg-migrate** | Dump/restore manuel | Versionnement du schéma, rollback possible, évite la divergence `dump.sql` ↔ code. |
| Back-end | **Node.js + Express + EJS** | PHP monolithique | Langage unique (JS) côté client et serveur, écosystème npm. Imposé par le sujet (« NodeJS »). |
| ORM / Accès DB | **`pg` (node-postgres) + requêtes SQL brutes paramétrées** | Prisma, Sequelize | Le sujet insiste sur les **vues SQL** et minimise les NULL — un ORM masquerait ces éléments. Avec `pg`, le SQL est visible, auditable, et les `$1, $2` garantissent l'absence d'injection. |
| Sessions | **`express-session` + `connect-pg-simple`** | JWT stateless | Sessions stateful plus simples à révoquer (désinscription, admin qui désactive un compte). Le sujet demande explicitement « sessions ». |
| Sécurité | **argon2**, **helmet**, **csurf**, **express-rate-limit** | bcrypt, middlewares maison | argon2 est le standard OWASP 2024. helmet applique 11 en-têtes en une ligne. |
| Validation | **zod** (partagé client/serveur) | joi, express-validator | Types TS inférés côté front ET back → un seul schéma, zéro divergence. |
| Front-end | **Vue 3 + Vite + PrimeVue + PrimeIcons + `@primevue/themes` (Aura)** | React, Svelte | Vue est léger, doc FR complète, PrimeVue couvre 80 des composants nécessaires (DataTable, Dialog, Toast, ConfirmDialog, Calendar, InputMask, FileUpload) — gain de temps énorme sur 4 jours. |
| Routing SPA | **vue-router 4** | — | Standard Vue. |
| État global | **Pinia** | Vuex (déprécié) | Recommandé par l'équipe Vue. |
| Cartographie | **Leaflet + OpenStreetMap** | Google Maps, Mapbox | Gratuit, sans clé API, léger (~40 kB), tuiles OSM libres. |
| Géocodage | **Nominatim (OSM)** | Google Geocoding | Gratuit, rate-limit 1 req/s respecté, résultats cachés en base pour éviter tout re-appel. |
| Optimisation de parcours | **Algorithme nearest-neighbor + 2-opt maison**, exécuté dans un **Web Worker** | OSRM / OpenRouteService | Indépendance (pas de service externe à déployer), suffisant pour ≤ 15 points. Le Web Worker évite de figer l'UI. |
| Cache client | **IndexedDB** (via `idb-keyval`) | localStorage | Permet de stocker la liste de courses hors ligne + catalogue offline. |
| PWA / offline | **Service Worker** (vite-plugin-pwa) | — | Exigence bonus du sujet. |
| Tests unitaires | **Vitest** | Jest | Intégration native Vite, plus rapide. |
| Tests e2e | **Selenium WebDriver** | Playwright, Cypress | Imposé par le sujet. |
| Audit perf | **Lighthouse** | — | Imposé par le sujet. |
| Logs | **pino + pino-http** | Winston, console.log | Logs structurés JSON → grep/filtre trivial, perf 5× supérieure à Winston. |
| API doc | **OpenAPI 3.1 + Swagger UI** (`swagger-ui-express`) | Documentation markdown | Imposé par le sujet (« Web Services REST, OpenAPI / Swagger »). |
| Déploiement front | **GitHub Pages** (SPA statique buildée) | Netlify, Vercel | Imposé par le sujet. |
| Déploiement back | **PlanetHoster World Lite via FTP** | Heroku, Render | Imposé par le sujet. |

## 4.2 Ce que nous n'utilisons PAS et pourquoi

- ❌ **Next.js / Nuxt / SvelteKit** : frameworks full-stack interdits par le sujet (« frameworks complets »). Vue 3 seul est un framework de **vue** côté client, conforme.
- ❌ **Prisma / TypeORM** : masqueraient les vues SQL que le sujet demande de privilégier (« Dès qu'une fonctionnalité peut être implémentée sous forme de vue SQL, privilégiez cette solution »).
- ❌ **JWT / Auth0 / Firebase Auth** : « gestion des sessions » est une compétence explicite demandée, donc nous l'implémentons.
- ❌ **Google Maps / Mapbox** : clé API payante, dépendance tierce non justifiée face à Leaflet+OSM.
- ❌ **TypeScript strict partout** : côté serveur on reste en JS + JSDoc pour respecter la contrainte « bonnes pratiques communes » sans alourdir la toolchain pour 4 jours. zod compense la validation à l'exécution.

## 4.3 Architecture en une phrase

> Front SPA **Vue 3 + PrimeVue** servie statiquement, parle en **REST/JSON** à un back **Node/Express** modulaire (auth, catalogue, commandes, paiement simulé, géo, alertes), lui-même connecté à **PostgreSQL+PostGIS** via `pg`, avec **sessions stateful** stockées en base, **vues SQL** pour les pré-calculs, et **Service Worker + IndexedDB** pour l'expérience offline.

## 4.4 Conformité au cahier des charges

| Exigence du PDF | Réponse |
|---|---|
| « formulaires » | HTML natif + composants PrimeVue (InputText, Dropdown, Calendar, FileUpload) |
| « sessions » | `express-session` + table `session` en PG |
| « accès aux bases de données » | `pg` (pool), requêtes paramétrées |
| « Frameworks complets interdits » | Pas de Next/Nuxt/Laravel — Express + Vue découplés |
| « CSS ou Bootstrap autorisés » | Styles PrimeVue (thème Aura) + CSS custom |
| « ≥ 3 fonctionnalités supplémentaires » | PWA, IndexedDB offline, Web Worker d'optimisation, recherche full-text, export CSV/PDF (5 bonus prévus) |
| « NodeJS » | Node 20 LTS |
| « MySQL ou PostgreSQL » | PostgreSQL (choix justifié supra) |
| « minimiser NULL » | Sous-tables par mode de livraison (cf. §6), table `produit_saison` séparée |
| « vues SQL » | Cf. §7 — 7 vues planifiées |
| « architecture modulaire » | `server/modules/{db,auth,droits,affichage,geo,paiement}` |
| « noms de variables explicites » | ESLint + convention documentée dans la charte de code |
| « messages de confirmation / erreur » | `Toast` PrimeVue sur toutes les mutations |
| « indiquer le rôle utilisateur » | Couleur d'accent du thème PrimeVue variable selon `role` |

---

*Équipe les gumes — 2026-04-20.*
