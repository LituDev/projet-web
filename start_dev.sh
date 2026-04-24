#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# gumes marketplace — lancement dev local sans Docker (Linux / macOS)
#
# Variante « apporte ton propre PostgreSQL » : se connecte à une instance
# locale via DATABASE_URL, reset le schéma public, applique migrations + seed
# + images, puis lance serveur (:3000) + client (:5173).
#
# Prérequis :
#   • PostgreSQL >= 13 installé et démarré localement (aucune extension
#     particulière n'est requise : gen_random_uuid() est en core PG 13+).
#   • La base et l'utilisateur existent déjà (cf. DATABASE_URL dans .env).
#   • Node >= 20.
#
# Aucun `psql` n'est nécessaire : le reset du schéma passe par un script Node
# via le driver `pg` (cross-platform, identique à Windows).
#
# Pour un démarrage clef-en-main avec Docker, utiliser ./start.sh.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '→ %s\n' "$*"; }

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

# ── Dépendances ──────────────────────────────────────────────────────────────
if [ ! -d node_modules ] || [ ! -d server/node_modules ] || [ ! -d client/node_modules ]; then
  info "Installation des dépendances npm…"
  npm install
fi

# ── Reset schéma + migrations + seed + images ────────────────────────────────
info "Préparation de la base (reset + migrations + seed + images)…"
npm run db:prep

# ── Lancement serveur + client ───────────────────────────────────────────────
bold ""
bold "══════════════════════════════════════════════════════════════════════"
bold "  gumes marketplace est prêt (PostgreSQL natif, sans Docker)."
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
