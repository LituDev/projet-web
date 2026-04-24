#!/usr/bin/env bash
# Wrapper historique : délègue à la version Node (cross-platform).
set -euo pipefail
cd "$(dirname "$0")"
exec node download.js "$@"
