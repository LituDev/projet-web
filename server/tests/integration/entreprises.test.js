import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../helpers/app.js';
import { registerSeller, loginAdmin, loginAs, dbQuery } from '../helpers/fixtures.js';

function siret() {
  return String(Math.floor(Math.random() * 1e14)).padStart(14, '0');
}

describe('entreprises', () => {
  test('GET / public → liste non vide (seed)', async () => {
    const res = await request().get('/api/entreprises');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 10, 'seed contient au moins 10 entreprises');
    const e = res.body.data[0];
    assert.ok(e.id && e.nom && e.siret && e.producteur_nom);
  });

  test('GET /:id public → détail avec producteur_tel', async () => {
    const list = await request().get('/api/entreprises');
    const one = list.body.data[0];
    const res = await request().get(`/api/entreprises/${one.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.entreprise.id, one.id);
    assert.ok(res.body.entreprise.producteur_tel);
  });

  test('GET /:id inconnu → 404', async () => {
    const res = await request().get('/api/entreprises/00000000-0000-0000-0000-000000000000');
    assert.equal(res.status, 404);
  });

  test('POST / anonyme → 401', async () => {
    const res = await request().post('/api/entreprises').send({ nom: 'X', siret: siret() });
    assert.equal(res.status, 401);
  });

  test('POST / par client (user) → 403 forbidden', async () => {
    const { agent: a } = await loginAs('client1@gumes.local');
    const res = await a.post('/api/entreprises').send({ nom: 'X', siret: siret() });
    assert.equal(res.status, 403);
  });

  test('POST / SIRET invalide → 400 validation', async () => {
    const { agent: a } = await registerSeller();
    const res = await a.post('/api/entreprises').send({ nom: 'X', siret: '123' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'validation_error');
  });

  test('POST / seller → 201', async () => {
    const { agent: a } = await registerSeller();
    const res = await a.post('/api/entreprises').send({
      nom: 'Ferme Test', siret: siret(), description: 'Ferme de test',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.entreprise.nom, 'Ferme Test');
  });

  test('PATCH propre entreprise → 200, PATCH entreprise d\'un autre → 403', async () => {
    const { agent: a1 } = await registerSeller();
    const created = await a1.post('/api/entreprises').send({ nom: 'A', siret: siret() });
    const eid = created.body.entreprise.id;
    const okPatch = await a1.patch(`/api/entreprises/${eid}`).send({ nom: 'A2' });
    assert.equal(okPatch.status, 200);
    assert.equal(okPatch.body.entreprise.nom, 'A2');

    const { agent: a2 } = await registerSeller();
    const forbidden = await a2.patch(`/api/entreprises/${eid}`).send({ nom: 'HACK' });
    assert.equal(forbidden.status, 403);
  });

  test('DELETE propre entreprise → 204 et plus dans la liste', async () => {
    const { agent: a } = await registerSeller();
    const created = await a.post('/api/entreprises').send({ nom: 'C', siret: siret() });
    const eid = created.body.entreprise.id;
    const res = await a.delete(`/api/entreprises/${eid}`);
    assert.equal(res.status, 204);
    const { rows } = await dbQuery('SELECT id FROM entreprise WHERE id = $1', [eid]);
    assert.equal(rows.length, 0);
  });

  test('admin peut patcher n\'importe quelle entreprise', async () => {
    const { agent: admin } = await loginAdmin();
    const list = await request().get('/api/entreprises');
    const target = list.body.data[0];
    const res = await admin.patch(`/api/entreprises/${target.id}`).send({ description: 'edit admin' });
    assert.equal(res.status, 200);
  });
});
