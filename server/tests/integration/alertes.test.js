import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../helpers/app.js';
import { registerClient, registerSeller, loginAdmin } from '../helpers/fixtures.js';

describe('alertes', () => {
  test('POST / anonyme → 401', async () => {
    const res = await request().post('/api/alertes').send({
      type: 'autre', description: 'Un problème important.',
    });
    assert.equal(res.status, 401);
  });

  test('POST / par client → 201', async () => {
    const { agent: a } = await registerClient();
    const res = await a.post('/api/alertes').send({
      type: 'produit', description: 'Le produit est mal catégorisé.',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.alerte.statut, 'open');
  });

  test('POST / validation (description trop courte) → 400', async () => {
    const { agent: a } = await registerClient();
    const res = await a.post('/api/alertes').send({ type: 'autre', description: 'x' });
    assert.equal(res.status, 400);
  });

  test('POST / par seller → 201 (tout utilisateur authentifié)', async () => {
    const { agent: s } = await registerSeller();
    const res = await s.post('/api/alertes').send({
      type: 'autre', description: 'Signalement test.',
    });
    assert.equal(res.status, 201);
  });

  test('GET /mine renvoie uniquement les siennes', async () => {
    const { agent: a } = await registerClient();
    await a.post('/api/alertes').send({ type: 'autre', description: 'A moi numéro un.' });
    const { agent: b } = await registerClient();
    await b.post('/api/alertes').send({ type: 'autre', description: 'A quelqu\'un d\'autre.' });
    const mine = await a.get('/api/alertes/mine');
    assert.equal(mine.status, 200);
    assert.ok(mine.body.data.every((x) => x.description !== 'A quelqu\'un d\'autre.'));
  });

  test('GET / non-admin → 403', async () => {
    const { agent: a } = await registerClient();
    const res = await a.get('/api/alertes');
    assert.equal(res.status, 403);
  });

  test('GET / admin → tableau', async () => {
    const { agent: admin } = await loginAdmin();
    const res = await admin.get('/api/alertes');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  test('PATCH /:id admin ferme → resolved_at posé', async () => {
    const { agent: a } = await registerClient();
    const created = await a.post('/api/alertes').send({
      type: 'autre', description: 'Alerte à fermer.',
    });
    const { agent: admin } = await loginAdmin();
    const res = await admin.patch(`/api/alertes/${created.body.alerte.id}`).send({ statut: 'closed' });
    assert.equal(res.status, 200);
    assert.equal(res.body.alerte.statut, 'closed');
    assert.ok(res.body.alerte.resolved_at);
  });

  test('PATCH /:id non-admin → 403', async () => {
    const { agent: a } = await registerClient();
    const created = await a.post('/api/alertes').send({
      type: 'autre', description: 'Alerte privée.',
    });
    const res = await a.patch(`/api/alertes/${created.body.alerte.id}`).send({ statut: 'closed' });
    assert.equal(res.status, 403);
  });

  test('PATCH /:id inexistant → 404', async () => {
    const { agent: admin } = await loginAdmin();
    const res = await admin.patch('/api/alertes/00000000-0000-0000-0000-000000000000')
      .send({ statut: 'closed' });
    assert.equal(res.status, 404);
  });
});
