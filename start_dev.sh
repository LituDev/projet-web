#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# gumes marketplace — lancement dev local (sans Docker)
#
# Variante « apporte ton propre PostgreSQL » : se connecte à une instance
# locale via DATABASE_URL, reset le schéma public + extensions, applique
# migrations + seed, puis lance serveur (Express :3000) + client (Vite :5173).
#
# Prérequis :
#   • PostgreSQL + PostGIS installés et en cours d'exécution ;
#   • la base et l'utilisateur existent déjà (cf. .env / DATABASE_URL) ;
#   • le rôle a le droit de créer les extensions postgis / pgcrypto / citext
#     (en général : ALTER ROLE gumes SUPERUSER; en dev).
#
# Pour un démarrage clef-en-main avec Docker, utiliser plutôt ./start.sh.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '→ %s\n' "$*"; }

# ── Prérequis ────────────────────────────────────────────────────────────────
command -v psql >/dev/null || { echo "Erreur : psql introuvable (client PostgreSQL requis)."; exit 1; }
command -v node >/dev/null || { echo "Erreur : node introuvable (node >= 20 requis)."; exit 1; }

# ── .env ─────────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  info "Création du .env à partir de .env.example"
  cp .env.example .env
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if sed --version >/dev/null 2>&1; then
    sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$SECRET|" .env
  else
    sed -i '' "s|^SESSION_SECRET=.*|SESSION_SECRET=$SECRET|" .env
  fi
  bold "  → SESSION_SECRET généré."
  bold "  → Ajuste DATABASE_URL dans .env pour pointer sur ton PostgreSQL local."
fi

# Charge les variables du .env (DATABASE_URL notamment).
set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${DATABASE_URL:?DATABASE_URL manquant dans .env}"

# ── Vérif connexion ──────────────────────────────────────────────────────────
info "Vérification de la connexion à PostgreSQL…"
if ! psql "$DATABASE_URL" -c '\q' 2>/dev/null; then
  echo "Impossible de se connecter à \$DATABASE_URL."
  echo "Vérifie que PostgreSQL tourne et que la base/l'utilisateur existent, ex. :"
  echo "  sudo -u postgres psql -c \"CREATE USER ${POSTGRES_USER:-gumes} WITH PASSWORD '${POSTGRES_PASSWORD:-change-me-in-local}' SUPERUSER;\""
  echo "  sudo -u postgres psql -c \"CREATE DATABASE ${POSTGRES_DB:-gumes_marketplace} OWNER ${POSTGRES_USER:-gumes};\""
  exit 1
fi
bold "  → Base accessible."

# ── Reset schéma + extensions ────────────────────────────────────────────────
info "Reset du schéma public + extensions…"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DROP EXTENSION IF EXISTS postgis CASCADE;
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
DROP EXTENSION IF EXISTS citext CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
CREATE EXTENSION postgis;
CREATE EXTENSION pgcrypto;
CREATE EXTENSION citext;
SQL

# ── Dépendances ──────────────────────────────────────────────────────────────
if [ ! -d node_modules ] || [ ! -d server/node_modules ] || [ ! -d client/node_modules ]; then
  info "Installation des dépendances npm…"
  npm install
fi

# ── Migrations + seed ────────────────────────────────────────────────────────
info "Application des migrations…"
npm run db:migrate

info "Seed des données de test…"
npm run db:seed

info "Téléchargement des images de démo…"
./db/seed-images/download.sh

info "Import des images vers le storage…"
npm run images:import

# ── Lancement serveur + client ───────────────────────────────────────────────
bold ""
bold "══════════════════════════════════════════════════════════════════════"
bold "  gumes marketplace est prêt (dev local, sans Docker)."
bold "    ▸ API      http://localhost:3000"
bold "    ▸ Client   http://localhost:5173"
bold ""
bold "  Comptes de démo (mot de passe : GumesDev!2026)"
bold "    admin@gumes.local | producteur1@gumes.local … | client1@gumes.local …"
bold ""
bold "  Ctrl-C pour arrêter."
bold "══════════════════════════════════════════════════════════════════════"
bold ""

cleanup() {
  printf '\n→ Arrêt en cours…\n'
  kill 0 2>/dev/null || true
}
trap cleanup INT TERM

npm run dev:server &
npm run dev:client &
wait
