import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../helpers/app.js';
import {
  registerClient, registerSeller, dbQuery, getAnyVisibleProduct,
} from '../helpers/fixtures.js';

describe('liste-courses', () => {
  test('GET / anonyme → 401', async () => {
    const res = await request().get('/api/liste-courses');
    assert.equal(res.status, 401);
  });

  test('GET / par seller → 403', async () => {
    const { agent: s } = await registerSeller();
    const res = await s.get('/api/liste-courses');
    assert.equal(res.status, 403);
  });

  test('POST / crée une liste (défaut "Ma liste")', async () => {
    const { agent: a } = await registerClient();
    const res = await a.post('/api/liste-courses').send({});
    assert.equal(res.status, 201);
    assert.equal(res.body.liste.nom, 'Ma liste');
    assert.ok(res.body.liste.id);
  });

  test('POST /:id/items ajoute un item + doublon somme les quantités', async () => {
    const { agent: a } = await registerClient();
    const liste = await a.post('/api/liste-courses').send({ nom: 'Courses' });
    const prod = await getAnyVisibleProduct();
    const first = await a.post(`/api/liste-courses/${liste.body.liste.id}/items`).send({
      produit_id: prod.id, quantite: 2,
    });
    assert.equal(first.status, 201);
    const second = await a.post(`/api/liste-courses/${liste.body.liste.id}/items`).send({
      produit_id: prod.id, quantite: 3,
    });
    assert.equal(second.status, 201);
    const detail = await a.get(`/api/liste-courses/${liste.body.liste.id}`);
    const item = detail.body.items.find((i) => i.produit_id === prod.id);
    assert.equal(item.quantite, 5);
    assert.ok(item.lieu_id !== undefined); // join avec produit_lieu_vente
  });

  test('GET /:id liste d\'un autre client → 403', async () => {
    const { agent: a } = await registerClient();
    const liste = await a.post('/api/liste-courses').send({});
    const { agent: b } = await registerClient();
    const res = await b.get(`/api/liste-courses/${liste.body.liste.id}`);
    assert.equal(res.status, 403);
  });

  test('DELETE /:id/items/:produit_id retire l\'item', async () => {
    const { agent: a } = await registerClient();
    const liste = await a.post('/api/liste-courses').send({});
    const prod = await getAnyVisibleProduct();
    await a.post(`/api/liste-courses/${liste.body.liste.id}/items`).send({
      produit_id: prod.id, quantite: 1,
    });
    const res = await a.delete(`/api/liste-courses/${liste.body.liste.id}/items/${prod.id}`);
    assert.equal(res.status, 204);
    const detail = await a.get(`/api/liste-courses/${liste.body.liste.id}`);
    assert.equal(detail.body.items.length, 0);
  });

  test('DELETE /:id supprime la liste en cascade', async () => {
    const { agent: a } = await registerClient();
    const liste = await a.post('/api/liste-courses').send({});
    const prod = await getAnyVisibleProduct();
    await a.post(`/api/liste-courses/${liste.body.liste.id}/items`).send({
      produit_id: prod.id, quantite: 1,
    });
    const res = await a.delete(`/api/liste-courses/${liste.body.liste.id}`);
    assert.equal(res.status, 204);
    const { rows } = await dbQuery(
      'SELECT id FROM item_liste_courses WHERE liste_id = $1', [liste.body.liste.id],
    );
    assert.equal(rows.length, 0);
  });

  test('DELETE /:id liste inconnue → 404', async () => {
    const { agent: a } = await registerClient();
    const res = await a.delete('/api/liste-courses/00000000-0000-0000-0000-000000000000');
    assert.equal(res.status, 404);
  });
});
