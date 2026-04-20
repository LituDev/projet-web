# DL1 — §8 Architecture applicative

## 8.1 Vue SOA — découpage en modules

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            CLIENT (navigateur)                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Vue 3 + PrimeVue SPA                                             │    │
│  │  ├─ Pinia stores : session, panier, favoris, liste-courses       │    │
│  │  ├─ vue-router : /, /catalogue, /carte, /app/*, /seller/*, /admin│    │
│  │  ├─ Service API fetch (cookies httpOnly, CSRF header double)     │    │
│  │  ├─ Web Worker : optimisation de parcours (nearest-neighbor+2opt)│    │
│  │  ├─ Service Worker (PWA) : cache catalogue, fallback offline     │    │
│  │  └─ IndexedDB : liste de courses offline + sync                  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                                  │  HTTPS  (JSON/REST + session cookie)
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        SERVEUR Node.js / Express                         │
│                                                                          │
│  Cross-cutting : helmet │ cors │ csurf │ rate-limit │ pino-http │ zod    │
│                                                                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐  │
│  │   auth     │ │ catalogue  │ │  commandes │ │  paiement  │ │  geo   │  │
│  │ register   │ │ produits   │ │ panier→CMD │ │ simulation │ │ lieux  │  │
│  │ login      │ │ recherche  │ │ quote      │ │ idempotence│ │ trajet │  │
│  │ sessions   │ │ visibilité │ │ statuts    │ │ remboursem.│ │ geocod.│  │
│  │ requireAuth│ │ CRUD seller│ │ accept/ref.│ │            │ │ PostGIS│  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────┘  │
│                                                                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │ utilisateur│ │   alertes  │ │   admin    │ │   audit    │             │
│  │ profils    │ │ dysfonct.  │ │ modération │ │ log writes │             │
│  │ RGPD export│ │ statuts    │ │ promote    │ │ view       │             │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘             │
│                                                                          │
│  db/pool.js  ←  pg (pool de connexions, requêtes paramétrées $1,$2…)    │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│              PostgreSQL 16 + PostGIS   (docker compose)                  │
│  tables métier  │  vues SQL  │  fonctions PostGIS  │  session            │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                      ┌───────────────────────┐
                      │  Nominatim (OSM)      │   géocodage externe
                      │  rate-limit 1 req/s   │   (résultats cachés)
                      └───────────────────────┘
```

## 8.2 Arborescence du projet

```
gumes-marketplace/
├── README.md
├── TODO.md                              # ce fichier de suivi
├── docker-compose.yml                   # postgres+postgis+adminer
├── .env.example                         # variables documentées, sans secret
├── .env                                 # .gitignore
├── .gitignore
├── package.json                         # workspaces npm (server + client)
│
├── docs/                                # rapport DL1 + OpenAPI
│   ├── DL1-00-couverture.md
│   ├── DL1-01-contexte.md
│   ├── DL1-02-cas-utilisation.md        ✅
│   ├── DL1-04-choix-technologiques.md   ✅
│   ├── DL1-05-06-mcd-schema-logique.md  ✅
│   ├── DL1-07-vues-sql.md               ✅
│   ├── DL1-08-architecture.md           ← ce fichier
│   ├── DL1-09-gantt.md
│   ├── DL1-10-repartition.md
│   ├── DL1-11-risques.md
│   ├── charte-code.md
│   └── openapi.yaml
│
├── db/
│   ├── migrations/                      # node-pg-migrate
│   │   ├── 1713600000001_init.sql
│   │   ├── 1713600000002_seed_referentiels.sql
│   │   └── 1713600000003_views.sql
│   ├── seeds/
│   │   ├── 01-users.js                  # faker-js locale fr
│   │   ├── 02-entreprises.js
│   │   ├── 03-produits.js
│   │   ├── 04-points-relais.js
│   │   └── 05-commandes.js
│   └── dump.sql                         # généré pour DL2
│
├── server/
│   ├── index.js                         # bootstrap Express
│   ├── app.js                           # création app + middlewares
│   ├── config.js                        # lecture .env via dotenv
│   ├── db/
│   │   ├── pool.js                      # pg.Pool singleton
│   │   └── queries/                     # 1 fichier par domaine
│   │       ├── users.js
│   │       ├── produits.js
│   │       ├── commandes.js
│   │       └── ...
│   ├── modules/
│   │   ├── auth/        (register, login, logout, requireAuth, requireRole)
│   │   ├── catalogue/   (produits, recherche, visibilité)
│   │   ├── commandes/   (panier, quote, création, statuts)
│   │   ├── paiement/    (simulation, idempotence)
│   │   ├── geo/         (lieux, trajet, proximité)
│   │   ├── alertes/
│   │   ├── admin/
│   │   └── audit/       (writer + lecture)
│   ├── routes/
│   │   ├── api.js                       # monte toutes les routes /api/*
│   │   └── views.js                     # routes EJS minimalistes (404, legal)
│   ├── views/                           # EJS
│   │   ├── layout.ejs
│   │   ├── 404.ejs
│   │   ├── mentions-legales.ejs
│   │   └── politique-confidentialite.ejs
│   ├── middlewares/
│   │   ├── security.js                  # helmet + CSP + CSRF
│   │   ├── rate-limit.js
│   │   ├── validate.js                  # wrapper zod
│   │   ├── error.js                     # handler central
│   │   └── audit.js                     # log auto des actions admin
│   └── utils/
│       ├── prix.js                      # format cents → EUR fr-FR
│       ├── geocode.js                   # wrapper Nominatim + cache
│       └── paiement-sim.js              # règles 0000/0001
│
├── client/                              # Vue 3 + Vite
│   ├── vite.config.js                   # proxy /api → server
│   ├── index.html
│   ├── public/
│   │   ├── manifest.webmanifest         # PWA
│   │   └── icons/
│   └── src/
│       ├── main.js                      # PrimeVue plugin, thème, locale fr
│       ├── App.vue
│       ├── router/index.js              # guards par rôle
│       ├── stores/
│       │   ├── session.js               # Pinia : user, role, helpers isAdmin…
│       │   ├── panier.js
│       │   ├── favoris.js
│       │   └── liste-courses.js         # sync IndexedDB
│       ├── services/
│       │   ├── api.js                   # fetch wrapper + CSRF + erreurs
│       │   └── worker/
│       │       └── trajet.worker.js     # nearest-neighbor + 2-opt
│       ├── views/
│       │   ├── public/ (Accueil, Catalogue, Carte, Produit, Login, Register)
│       │   ├── app/    (Panier, Checkout, Commandes, Historique, Liste, Compte)
│       │   ├── seller/ (Dashboard, Entreprises, Produits, Commandes, Lieux)
│       │   └── admin/  (Dashboard, Users, Moderation, Alertes, Audit)
│       ├── components/
│       │   ├── ProduitCard.vue
│       │   ├── LieuMap.vue              # Leaflet
│       │   ├── FormField.vue
│       │   ├── FakeCardForm.vue
│       │   ├── ConfirmDeleteBtn.vue     # PrimeVue ConfirmDialog + pi-trash
│       │   └── Can.vue                  # <Can action="produit.edit">
│       └── composables/
│           ├── useAuth.js
│           ├── useToast.js              # wrapper PrimeVue
│           └── useOffline.js            # détecte online/offline
│
└── tests/
    ├── e2e/                             # Selenium WebDriver
    │   ├── register-login.test.js
    │   ├── commande-nominale.test.js
    │   ├── role-access-403.test.js
    │   └── trajet-optimise.test.js
    └── unit/                            # Vitest (server + client)
        └── ...
```

## 8.3 Flux d'une requête typique — `POST /api/commandes`

1. Navigateur envoie `POST /api/commandes` avec cookie de session et header `X-CSRF-Token`.
2. `helmet` ajoute les headers de sécurité, `express.json({limit:'200kb'})` parse le body.
3. `csurf` vérifie le token — sinon 403.
4. `pino-http` attribue un `requestId` UUID, log la requête.
5. Route `router.post('/commandes', requireAuth, requireRole('user','admin'), validate(commandeSchema), commandesController.create)`.
6. `requireAuth` consulte `req.session.user` (lu depuis PG via connect-pg-simple).
7. `requireRole` filtre.
8. `validate` applique le schéma zod — en cas d'erreur, `400` avec détails champ par champ.
9. Le contrôleur `commandesController.create` :
   - ouvre une transaction PG,
   - vérifie les stocks (SELECT … FOR UPDATE),
   - applique les règles de livraison (RG-05, RG-06),
   - calcule frais de port via `shipping_rate`,
   - insère `commande`, `ligne_commande`, sous-table de livraison,
   - décrémente les stocks,
   - insère un `paiement` en `pending` avec `Idempotency-Key`,
   - commit.
10. Middleware `audit` écrit dans `audit_log`.
11. Réponse `201 Created` avec `Location: /api/commandes/:id`.
12. Côté front, Pinia met à jour le store `panier`, PrimeVue affiche un `Toast` de confirmation.

## 8.4 Gestion des erreurs

- Toutes les erreurs remontent vers `middlewares/error.js` via `next(err)`.
- Format de réponse uniforme : `{ error: { code, message, details? } }`.
- Codes HTTP :
  - `400` validation, `401` non authentifié, `403` non autorisé, `404` inexistant,
  - `409` conflit (email déjà pris, commande déjà remboursée, rupture de stock),
  - `422` règle métier violée (livraison impossible),
  - `429` rate-limit, `500` inattendu.
- Jamais de stack trace en prod, toujours en dev. `requestId` renvoyé pour corrélation logs.

## 8.5 Conformité §5 du PDF (« architecture modulaire »)

| Module du PDF | Implémentation | Fichier |
|---|---|---|
| accès à la base de données | `server/db/pool.js` + `queries/*` | Mutualisé, 1 pool |
| gestion des sessions | `express-session` + `connect-pg-simple` | `app.js` |
| gestion des droits | `requireAuth`, `requireRole` | `modules/auth/middleware.js` |
| affichage / représentation | EJS (pages minimales) + Vue (SPA) | `server/views/`, `client/src/views/` |

---

*Équipe les gumes — 2026-04-20.*
