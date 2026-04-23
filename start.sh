#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# gumes marketplace — lancement complet (dev)
#
# Chaque démarrage réinitialise la base : teardown + up + migrations + seed.
# Puis lance le serveur (Express :3000) et le client (Vite :5173) en parallèle.
# Ctrl-C arrête les deux proprement.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '→ %s\n' "$*"; }

# ── Prérequis ────────────────────────────────────────────────────────────────
command -v docker >/dev/null || { echo "Erreur : docker introuvable."; exit 1; }
command -v node   >/dev/null || { echo "Erreur : node introuvable (node ≥ 20 requis)."; exit 1; }

# ── .env ─────────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  info "Création du .env à partir de .env.example"
  cp .env.example .env
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  # macOS vs GNU sed
  if sed --version >/dev/null 2>&1; then
    sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$SECRET|" .env
  else
    sed -i '' "s|^SESSION_SECRET=.*|SESSION_SECRET=$SECRET|" .env
  fi
  bold "  → SESSION_SECRET généré."
fi

# ── Teardown complet (volume compris) ────────────────────────────────────────
info "Teardown de la base (docker compose down -v)…"
docker compose down -v --remove-orphans 2>/dev/null || true

# ── Démarrage de Postgres ────────────────────────────────────────────────────
info "Démarrage de PostgreSQL/PostGIS + Adminer…"
docker compose up -d

# ── Attente que la base soit prête ───────────────────────────────────────────
info "Attente du healthcheck…"
for i in {1..60}; do
  if docker compose exec -T db pg_isready -U gumes -d gumes_marketplace >/dev/null 2>&1; then
    bold "  → Base prête."
    break
  fi
  sleep 0.5
  [ "$i" = 60 ] && { echo "Timeout en attendant la base."; exit 1; }
done

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
bold "  gumes marketplace est prêt."
bold "    ▸ API      http://localhost:3000"
bold "    ▸ Client   http://localhost:5173"
bold "    ▸ Adminer  http://localhost:8080  (System: PostgreSQL, Server: postgres, Utilisateur: gumes, BDD: gumes_marketplace)"
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
