// Reset du schéma public sur une base PostgreSQL native (sans Docker).
//
// Utilise DATABASE_URL depuis .env et le driver `pg` — aucun appel à psql,
// donc fonctionne identiquement sur Windows et Linux sans dépendre d'un
// client PostgreSQL installé sur la machine.
//
// Usage :
//   node scripts/reset-schema.js
//
// Exit codes :
//   0 : schéma public reset, prêt pour migrations
//   1 : DATABASE_URL manquant
//   2 : connexion impossible (base absente, credentials faux, service arrêté)

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Erreur : DATABASE_URL manquant dans .env.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

try {
  await client.connect();
} catch (err) {
  console.error('Impossible de se connecter à PostgreSQL via DATABASE_URL.');
  console.error('  Cause :', err.message);
  console.error('  Vérifie que :');
  console.error('    • le service PostgreSQL est démarré ;');
  console.error('    • la base et l\'utilisateur indiqués dans DATABASE_URL existent ;');
  console.error('    • le port et le mot de passe sont corrects.');
  process.exit(2);
}

try {
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO public');
  console.log('→ Schéma public reset.');
} finally {
  await client.end();
}
