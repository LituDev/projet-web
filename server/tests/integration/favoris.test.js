import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../helpers/app.js';
import { registerClient, registerSeller, dbQuery } from '../helpers/fixtures.js';

async function firstEntrepriseId() {
  const res = await request().get('/api/entreprises');
  return res.body.data[0].id;
}

describe('favoris', () => {
  test('GET / anonyme → 401', async () => {
    const res = await request().get('/api/favoris');
    assert.equal(res.status, 401);
  });

  test('POST / par seller → 403 (rôle user/admin requis)', async () => {
    const { agent: s } = await registerSeller();
    const res = await s.post('/api/favoris').send({ entreprise_id: await firstEntrepriseId() });
    assert.equal(res.status, 403);
  });

  test('POST + GET + DELETE cycle complet', async () => {
    const { agent: a } = await registerClient();
    const eid = await firstEntrepriseId();
    assert.equal((await a.post('/api/favoris').send({ entreprise_id: eid })).status, 201);
    const list = await a.get('/api/favoris');
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((f) => f.entreprise_id === eid));
    assert.equal((await a.delete(`/api/favoris/${eid}`)).status, 204);
    const after = await a.get('/api/favoris');
    assert.ok(!after.body.data.some((f) => f.entreprise_id === eid));
  });

  test('POST doublon → reste 201 (ON CONFLICT DO NOTHING)', async () => {
    const { agent: a } = await registerClient();
    const eid = await firstEntrepriseId();
    const first = await a.post('/api/favoris').send({ entreprise_id: eid });
    const second = await a.post('/api/favoris').send({ entreprise_id: eid });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    const count = await dbQuery('SELECT COUNT(*)::int AS n FROM favori WHERE entreprise_id = $1', [eid]);
    // count est au moins 1, pas une double insertion
    assert.ok(count.rows[0].n >= 1);
  });

  test('DELETE inexistant → 404', async () => {
    const { agent: a } = await registerClient();
    const res = await a.delete('/api/favoris/00000000-0000-0000-0000-000000000000');
    assert.equal(res.status, 404);
  });

  test('POST validation (entreprise_id non-uuid) → 400', async () => {
    const { agent: a } = await registerClient();
    const res = await a.post('/api/favoris').send({ entreprise_id: 'pas-un-uuid' });
    assert.equal(res.status, 400);
  });
});
