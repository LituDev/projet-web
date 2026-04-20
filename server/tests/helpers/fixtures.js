// Common test actions: register or log in users, query the DB directly.
import { randomUUID } from 'node:crypto';
import { agent as makeAgent } from './app.js';
import { pool } from '../../src/db/pool.js';

export const SEED_PASSWORD = 'GumesDev!2026';
export const SEED_ADMIN = 'admin@gumes.local';

export function uniqEmail(prefix = 'test') {
  return `${prefix}-${randomUUID().slice(0, 8)}@gumes.test`;
}

export async function registerClient(overrides = {}) {
  const a = makeAgent();
  const email = overrides.email ?? uniqEmail('client');
  const body = {
    role: 'user',
    email,
    password: 'TestPass!2026',
    nom: 'Nom',
    prenom: 'Prenom',
    tel: '+33 6 12 34 56 78',
    adresse: '1 rue de la Paix, 69001 Lyon',
    ...overrides,
  };
  const res = await a.post('/api/auth/register').send(body);
  if (res.status !== 201) {
    throw new Error(`registerClient failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent: a, user: res.body.user, password: body.password, email };
}

export async function registerSeller(overrides = {}) {
  const a = makeAgent();
  const email = overrides.email ?? uniqEmail('seller');
  const body = {
    role: 'seller',
    email,
    password: 'TestPass!2026',
    nom: 'Nom',
    prenom: 'Prenom',
    tel: '+33 6 98 76 54 32',
    ...overrides,
  };
  const res = await a.post('/api/auth/register').send(body);
  if (res.status !== 201) {
    throw new Error(`registerSeller failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent: a, user: res.body.user, password: body.password, email };
}

export async function loginAs(email, password = SEED_PASSWORD) {
  const a = makeAgent();
  const res = await a.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`loginAs(${email}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent: a, user: res.body.user };
}

export function loginAdmin() {
  return loginAs(SEED_ADMIN);
}

// Helpers for querying the DB directly from tests.
export async function dbQuery(text, params) {
  return pool.query(text, params);
}

export async function getSeedEntrepriseForSeller(email) {
  const { rows } = await pool.query(
    `SELECT e.id, e.nom, e.owner_id
     FROM entreprise e
     JOIN utilisateur u ON u.id = e.owner_id
     WHERE u.email = $1
     LIMIT 1`,
    [email],
  );
  return rows[0];
}

// Returns a product owned by the given seller email with stock > qte.
export async function getSeedProductForSeller(email, minStock = 3) {
  const { rows } = await pool.query(
    `SELECT p.id, p.nom, p.prix_cents, p.stock, p.shippable, p.entreprise_id, p.visibilite
     FROM produit p
     JOIN entreprise e ON e.id = p.entreprise_id
     JOIN utilisateur u ON u.id = e.owner_id
     WHERE u.email = $1 AND p.stock >= $2 AND p.visibilite = 'visible'
     ORDER BY p.stock DESC
     LIMIT 1`,
    [email, minStock],
  );
  return rows[0];
}

export async function getSeedLieuForSeller(email) {
  const { rows } = await pool.query(
    `SELECT l.id, l.entreprise_id, l.nom, l.adresse, l.lat, l.lon
     FROM lieu_de_vente l
     JOIN entreprise e ON e.id = l.entreprise_id
     JOIN utilisateur u ON u.id = e.owner_id
     WHERE u.email = $1
     LIMIT 1`,
    [email],
  );
  return rows[0];
}

export async function getAnyRelais() {
  const { rows } = await pool.query('SELECT id, nom, adresse, lat, lon FROM point_relais LIMIT 1');
  return rows[0];
}

// Remove products whose stock/visibility is toxic for broad catalogue queries.
export async function getAnyVisibleProduct() {
  const { rows } = await pool.query(
    `SELECT * FROM v_produits_disponibles LIMIT 1`,
  );
  return rows[0];
}
