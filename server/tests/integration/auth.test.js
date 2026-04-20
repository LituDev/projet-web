import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { request, agent } from '../helpers/app.js';
import {
  registerClient, registerSeller, loginAs, loginAdmin,
  uniqEmail, dbQuery, SEED_ADMIN, SEED_PASSWORD,
} from '../helpers/fixtures.js';

describe('auth', () => {
  test('POST /register client — 201 + crée une adresse géocodée (via mock Nominatim)', async () => {
    const { user, email } = await registerClient();
    assert.equal(user.role, 'user');
    assert.equal(user.email, email);
    const { rows } = await dbQuery(
      'SELECT lat, lon FROM adresse_geocodee WHERE user_id = $1', [user.id],
    );
    assert.equal(rows.length, 1, 'géocodage best-effort a inséré une ligne');
    assert.ok(rows[0].lat > 40 && rows[0].lat < 50);
  });

  test('POST /register seller — 201 sans adresse', async () => {
    const { user } = await registerSeller();
    assert.equal(user.role, 'seller');
  });

  test('POST /register email dupliqué → 409 email_taken', async () => {
    const email = uniqEmail('dup');
    await registerClient({ email });
    const res = await request().post('/api/auth/register').send({
      role: 'user', email, password: 'TestPass!2026',
      nom: 'X', prenom: 'Y', tel: '+33 6 00 00 00 00',
      adresse: '1 rue Truc, 69000 Lyon',
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'email_taken');
  });

  test('POST /register validation invalide → 400', async () => {
    const res = await request().post('/api/auth/register').send({
      role: 'user', email: 'not-an-email', password: 'short',
      nom: '', prenom: '', tel: 'x', adresse: 'x',
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'validation_error');
  });

  test('POST /login ok puis GET /me', async () => {
    const { agent: a } = await loginAdmin();
    const me = await a.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, SEED_ADMIN);
    assert.equal(me.body.user.role, 'admin');
  });

  test('POST /login mauvais mdp → 401 invalid_credentials', async () => {
    const res = await request().post('/api/auth/login').send({
      email: SEED_ADMIN, password: 'wrong',
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'invalid_credentials');
  });

  test('POST /login email inconnu → 401', async () => {
    const res = await request().post('/api/auth/login').send({
      email: 'inconnu@gumes.local', password: SEED_PASSWORD,
    });
    assert.equal(res.status, 401);
  });

  test('GET /me anonyme → 401 unauthenticated', async () => {
    const res = await request().get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'unauthenticated');
  });

  test('POST /logout détruit la session', async () => {
    const { agent: a } = await loginAdmin();
    assert.equal((await a.get('/api/auth/me')).status, 200);
    assert.equal((await a.post('/api/auth/logout')).status, 204);
    assert.equal((await a.get('/api/auth/me')).status, 401);
  });

  test('DELETE /me — soft-delete + anonymise email + écrit audit_log', async () => {
    const { agent: a, user } = await registerClient();
    const res = await a.delete('/api/auth/me');
    assert.equal(res.status, 204);
    const { rows } = await dbQuery(
      'SELECT email, deleted_at FROM utilisateur WHERE id = $1', [user.id],
    );
    assert.ok(rows[0].deleted_at);
    assert.ok(rows[0].email.startsWith('deleted-'));
    assert.ok(rows[0].email.endsWith('@anon'));
    const audit = await dbQuery(
      `SELECT action FROM audit_log WHERE target_id = $1 AND action = 'user.self_unregister'`,
      [user.id],
    );
    assert.equal(audit.rows.length, 1);
  });

  test('DELETE /me détruit aussi la session', async () => {
    const { agent: a } = await registerClient();
    await a.delete('/api/auth/me');
    assert.equal((await a.get('/api/auth/me')).status, 401);
  });

  test('login avec utilisateur supprimé → 401', async () => {
    const { agent: a, email, password } = await registerClient();
    await a.delete('/api/auth/me');
    const res = await request().post('/api/auth/login').send({ email, password });
    assert.equal(res.status, 401);
  });

  test('DELETE /me anonyme → 401', async () => {
    const res = await agent().delete('/api/auth/me');
    assert.equal(res.status, 401);
  });
});
