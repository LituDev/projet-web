import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../helpers/app.js';
import { registerClient, registerSeller } from '../helpers/fixtures.js';

async function firstProduitId() {
  const res = await request().get('/api/produits?limit=1');
  return res.body.data[0].id;
}

describe('avis', () => {
  test('GET /produits/:id public', async () => {
    const pid = await firstProduitId();
    const res = await request().get(`/api/avis/produits/${pid}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(typeof res.body.stats.nb_avis, 'number');
  });

  test('POST anonyme -> 401', async () => {
    const pid = await firstProduitId();
    const res = await request().post(`/api/avis/produits/${pid}`).send({ note: 5, commentaire: 'Excellent produit' });
    assert.equal(res.status, 401);
  });

  test('POST seller -> 403', async () => {
    const pid = await firstProduitId();
    const { agent: s } = await registerSeller();
    const res = await s.post(`/api/avis/produits/${pid}`).send({ note: 4, commentaire: 'Bien' });
    assert.equal(res.status, 403);
  });

  test('POST user create or update + GET reflects review', async () => {
    const pid = await firstProduitId();
    const { agent: c } = await registerClient();

    const first = await c.post(`/api/avis/produits/${pid}`).send({ note: 5, commentaire: 'Super bon produit' });
    assert.equal(first.status, 201);

    const second = await c.post(`/api/avis/produits/${pid}`).send({ note: 3, commentaire: 'Finalement moyen' });
    assert.equal(second.status, 201);

    const get = await c.get(`/api/avis/produits/${pid}`);
    assert.equal(get.status, 200);
    assert.ok(get.body.data.some((a) => a.commentaire.includes('Finalement moyen')));
    assert.ok(get.body.mon_avis);
  });
});
