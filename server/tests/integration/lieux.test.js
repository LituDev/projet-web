import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../helpers/app.js';
import { registerSeller, loginAs } from '../helpers/fixtures.js';

function siret() { return String(Math.floor(Math.random() * 1e14)).padStart(14, '0'); }

async function makeSellerWithEntreprise() {
  const { agent: a } = await registerSeller();
  const e = await a.post('/api/entreprises').send({ nom: 'Ferme Z', siret: siret() });
  return { agent: a, entrepriseId: e.body.entreprise.id };
}

describe('lieux-de-vente', () => {
  test('GET / public → tableau', async () => {
    const res = await request().get('/api/lieux-de-vente');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
  });

  test('GET /?entreprise_id=... filtre', async () => {
    const list = await request().get('/api/lieux-de-vente');
    const eid = list.body.data[0].entreprise_id;
    const res = await request().get(`/api/lieux-de-vente?entreprise_id=${eid}`);
    assert.equal(res.status, 200);
    for (const l of res.body.data) assert.equal(l.entreprise_id, eid);
  });

  test('GET /:id renvoie horaires', async () => {
    const list = await request().get('/api/lieux-de-vente');
    const res = await request().get(`/api/lieux-de-vente/${list.body.data[0].id}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.lieu.horaires));
  });

  test('POST par seller propriétaire → 201 + horaires créés', async () => {
    const { agent: a, entrepriseId } = await makeSellerWithEntreprise();
    const res = await a.post('/api/lieux-de-vente').send({
      entreprise_id: entrepriseId, nom: 'Atelier', adresse: '1 rue X, 69001 Lyon',
      lat: 45.76, lon: 4.84,
      horaires: [{ jour_semaine: 1, heure_debut: '09:00', heure_fin: '18:00' }],
    });
    assert.equal(res.status, 201);
    const detail = await request().get(`/api/lieux-de-vente/${res.body.lieu.id}`);
    assert.equal(detail.body.lieu.horaires.length, 1);
  });

  test('POST entreprise pas à moi → 403', async () => {
    const { entrepriseId } = await makeSellerWithEntreprise();
    const { agent: b } = await registerSeller();
    const res = await b.post('/api/lieux-de-vente').send({
      entreprise_id: entrepriseId, nom: 'Hack', adresse: '2 rue X, 69001 Lyon',
      lat: 45.76, lon: 4.84,
    });
    assert.equal(res.status, 403);
  });

  test('PATCH remplace les horaires', async () => {
    const { agent: a, entrepriseId } = await makeSellerWithEntreprise();
    const created = await a.post('/api/lieux-de-vente').send({
      entreprise_id: entrepriseId, nom: 'L', adresse: '3 rue X, 69001 Lyon',
      lat: 45.76, lon: 4.84,
      horaires: [{ jour_semaine: 1, heure_debut: '09:00', heure_fin: '18:00' }],
    });
    const lid = created.body.lieu.id;
    const patch = await a.patch(`/api/lieux-de-vente/${lid}`).send({
      horaires: [
        { jour_semaine: 2, heure_debut: '10:00', heure_fin: '17:00' },
        { jour_semaine: 3, heure_debut: '10:00', heure_fin: '17:00' },
      ],
    });
    assert.equal(patch.status, 204);
    const detail = await request().get(`/api/lieux-de-vente/${lid}`);
    assert.equal(detail.body.lieu.horaires.length, 2);
  });

  test('PATCH lieu d\'un autre seller → 403', async () => {
    const { agent: a, entrepriseId } = await makeSellerWithEntreprise();
    const created = await a.post('/api/lieux-de-vente').send({
      entreprise_id: entrepriseId, nom: 'L', adresse: '4 rue X, 69001 Lyon',
      lat: 45.76, lon: 4.84,
    });
    const { agent: b } = await registerSeller();
    const res = await b.patch(`/api/lieux-de-vente/${created.body.lieu.id}`).send({ nom: 'hack' });
    assert.equal(res.status, 403);
  });

  test('DELETE propre → 204', async () => {
    const { agent: a, entrepriseId } = await makeSellerWithEntreprise();
    const created = await a.post('/api/lieux-de-vente').send({
      entreprise_id: entrepriseId, nom: 'L', adresse: '5 rue X, 69001 Lyon',
      lat: 45.76, lon: 4.84,
    });
    const res = await a.delete(`/api/lieux-de-vente/${created.body.lieu.id}`);
    assert.equal(res.status, 204);
  });

  test('POST par user (client) → 403', async () => {
    const { agent: a } = await loginAs('client1@gumes.local');
    const res = await a.post('/api/lieux-de-vente').send({
      entreprise_id: '00000000-0000-0000-0000-000000000000',
      nom: 'X', adresse: '1 rue X, 69001 Lyon', lat: 45.76, lon: 4.84,
    });
    assert.equal(res.status, 403);
  });
});
