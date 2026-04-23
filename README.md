# Gumes Marketplace

Plateforme de vente de produits locaux (projet IAI1, Technologies Web).
Monorepo : `server/` (Express + PostgreSQL), `client/` (Vue 3 + Vite + PrimeVue), `db/` (migrations & seed).

La base ne requiert **aucune extension PostgreSQL** (pas de PostGIS, pas de citext, pas de pgcrypto). Tout le calcul de proximité est fait en SQL pur (Haversine) et les emails sont case-insensitive via une contrainte CHECK + normalisation applicative.

## Lancement

### Option 1 : Docker (recommandé pour les étudiants, clef en main)

Prérequis : Docker et Node.js >= 20.

```bash
./start.sh        # Linux / macOS
start.bat         # Windows
```

Le script :

1. Crée un `.env` depuis `.env.example` si besoin (génère `SESSION_SECRET`).
2. Réinitialise la base (`docker compose down -v` puis `up`).
3. Attend le healthcheck PostgreSQL, applique les migrations, insère les données de démo, télécharge et importe les images.
4. Lance le serveur Express et le client Vite en parallèle (Ctrl-C pour arrêter).

Services exposés :

| Service  | URL                       |
|----------|---------------------------|
| Client   | http://localhost:5173     |
| API      | http://localhost:3000/api |
| Adminer  | http://localhost:8080     |

Dans Adminer : `System: PostgreSQL`, `Server: db`, `User: gumes`, `Database: gumes_marketplace`, mot de passe : valeur de `POSTGRES_PASSWORD` dans `.env`.

### Option 2 : PostgreSQL natif, sans Docker (Linux, macOS, Windows)

Si PostgreSQL >= 13 tourne déjà sur la machine :

```bash
./start_dev.sh    # Linux / macOS
start_dev.bat     # Windows
```

Prérequis côté base (une seule fois) :

```sql
CREATE USER gumes WITH PASSWORD 'change-me-in-local' SUPERUSER;
CREATE DATABASE gumes_marketplace OWNER gumes;
```

Aucune extension à activer. Aucun `psql` n'est requis par le script : le reset du schéma passe par Node + le driver `pg`, donc le fonctionnement est identique sur Windows et Linux.

Si `DATABASE_URL` dans `.env` ne correspond pas à votre instance locale (port, mot de passe), ajustez-le avant de lancer le script.

## Comptes de démo

Seedés automatiquement à chaque démarrage. Mot de passe commun : **`GumesDev!2026`**.

| Rôle        | Emails                                          | Accès                                     |
|-------------|-------------------------------------------------|-------------------------------------------|
| Admin       | `admin@gumes.local`                             | Tout (dashboard `/admin/dashboard`)       |
| Producteur  | `producteur1@gumes.local` … `producteur10@gumes.local` | Espace producteur (`/seller/commandes`)   |
| Client      | `client1@gumes.local` … `client30@gumes.local`  | Catalogue, panier, commandes, favoris     |

Les données générées : 10 entreprises avec lieux de vente + horaires, 10 points relais, ~60 produits (dont saisonniers), 50 commandes réparties sur les 3 modes de livraison (retrait magasin, point relais, livraison à domicile).

Les lieux sont répartis sur la Bretagne (Rennes, Brest, Quimper, Vannes, Saint-Brieuc, Lorient, Saint-Malo, Morlaix).

## Scripts utiles

```bash
npm run db:migrate         # applique les migrations en attente
npm run db:migrate:down    # annule la dernière migration
npm run db:seed            # relance le seed (truncate + insert)
npm run db:reset:schema    # drop + recreate schema public (via Node, sans psql)
npm run db:prep            # reset schema + migrate + seed + images (cross-platform)
npm run db:reset           # alias de db:prep
npm run images:download    # télécharge les images de démo (Wikimedia Commons)
npm run images:import      # importe les images vers server/uploads/produits
npm run test               # tests d'intégration côté serveur
```

## Structure

```
client/     Vue 3 + Vite + PrimeVue (front SPA)
server/     Express 5 + pg + node-pg-migrate (API REST, sessions)
db/         init/ (noop), migrations/ (schéma), seeds/ (jeu de test), seed-images/ (assets démo)
scripts/    reset-schema.js (reset cross-platform sans psql)
docs/       livrables IAI1 (DL1-xx)
```

## Environnement

Tout est dans `.env` (racine). `.env.example` liste les variables : `DATABASE_URL`, `SESSION_SECRET`, `CORS_ORIGIN`, `VITE_API_BASE_URL`, `NOMINATIM_*`, rate-limit, etc.
