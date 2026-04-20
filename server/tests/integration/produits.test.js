import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../helpers/app.js';
import {
  registerSeller, loginAs, loginAdmin, dbQuery,
  getSeedEntrepriseForSeller,
} from '../helpers/fixtures.js';

function siret() { return String(Math.floor(Math.random() * 1e14)).padStart(14, '0'); }

async function makeSellerWithEntreprise() {
  const { agent: a } = await registerSeller();
  const e = await a.post('/api/entreprises').send({ nom: 'Ferme Z', siret: siret() });
  return { agent: a, entrepriseId: e.body.entreprise.id };
}

describe('produits', () => {
  test('GET / liste paginée avec total/limit/offset', async () => {
    const res = await request().get('/api/produits?limit=5&offset=0');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length <= 5);
    assert.equal(res.body.limit, 5);
    assert.equal(res.body.offset, 0);
    assert.equal(typeof res.body.total, 'number');
  });

  test('GET / filtre bio=true', async () => {
    const res = await request().get('/api/produits?bio=true&limit=50');
    assert.equal(res.status, 200);
    for (const p of res.body.data) assert.equal(p.bio, true);
  });

  test('GET / filtre nature=fruit', async () => {
    const res = await request().get('/api/produits?nature=fruit&limit=50');
    assert.equal(res.status, 200);
    for (const p of res.body.data) assert.equal(p.nature, 'fruit');
  });

  test('GET / q substring sur nom', async () => {
    const list = await request().get('/api/produits?limit=1');
    const needle = list.body.data[0]?.nom.split(' ')[0];
    if (!needle) return;
    const res = await request().get(`/api/produits?q=${encodeURIComponent(needle)}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.data.some((p) => p.nom.toLowerCase().includes(needle.toLowerCase())));
  });

  test('GET / limit hors bornes → 400', async () => {
    const res = await request().get('/api/produits?limit=999');
    assert.equal(res.status, 400);
  });

  test('GET /:id inconnu → 404', async () => {
    const res = await request().get('/api/produits/00000000-0000-0000-0000-000000000000');
    assert.equal(res.status, 404);
  });

  test('GET /:id renvoie lieux[]', async () => {
    const list = await request().get('/api/produits?limit=1');
    const res = await request().get(`/api/produits/${list.body.data[0].id}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.produit.lieux));
  });

  test('POST seller sans saison (perma) → 201', async () => {
    const { agent: a, entrepriseId } = await makeSellerWithEntreprise();
    const res = await a.post('/api/produits').send({
      entreprise_id: entrepriseId, nom: 'Miel test', nature: 'epicerie',
      bio: true, prix_cents: 500, stock: 10, shippable: true, est_saisonnier: false,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.produit.nom, 'Miel test');
  });

  test('POST saisonnier sans mois → 400 validation_error', async () => {
    const { agent: a, entrepriseId } = await makeSellerWithEntreprise();
    const res = await a.post('/api/produits').send({
      entreprise_id: entrepriseId, nom: 'Fraises', nature: 'fruit',
      bio: true, prix_cents: 500, stock: 10, est_saisonnier: true,
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'validation_error');
  });

  test('POST entreprise pas à moi → 403', async () => {
    const { entrepriseId } = await makeSellerWithEntreprise();
    const { agent: b } = await registerSeller();
    const res = await b.post('/api/produits').send({
      entreprise_id: entrepriseId, nom: 'Hack', nature: 'legume',
      bio: false, prix_cents: 100, stock: 1,
    });
    assert.equal(res.status, 403);
  });

  test('PATCH produit propre → 200, PATCH produit d\'un autre → 403', async () => {
    const { agent: a, entrepriseId } = await makeSellerWithEntreprise();
    const created = await a.post('/api/produits').send({
      entreprise_id: entrepriseId, nom: 'Oeufs', nature: 'epicerie',
      bio: false, prix_cents: 300, stock: 12,
    });
    const pid = created.body.produit.id;
    const ok = await a.patch(`/api/produits/${pid}`).send({ prix_cents: 350 });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.produit.prix_cents, 350);

    const { agent: b } = await registerSeller();
    const ko = await b.patch(`/api/produits/${pid}`).send({ prix_cents: 1 });
    assert.equal(ko.status, 403);
  });

  test('DELETE propre → 204 et disparition en base', async () => {
    const { agent: a, entrepriseId } = await makeSellerWithEntreprise();
    const created = await a.post('/api/produits').send({
      entreprise_id: entrepriseId, nom: 'Tmp', nature: 'legume',
      bio: false, prix_cents: 100, stock: 1,
    });
    const pid = created.body.produit.id;
    const res = await a.delete(`/api/produits/${pid}`);
    assert.equal(res.status, 204);
    const { rows } = await dbQuery('SELECT id FROM produit WHERE id = $1', [pid]);
    assert.equal(rows.length, 0);
  });

  test('produit hidden n\'apparaît pas dans GET /', async () => {
    const { agent: a, entrepriseId } = await makeSellerWithEntreprise();
    const created = await a.post('/api/produits').send({
      entreprise_id: entrepriseId, nom: 'Secret', nature: 'legume',
      bio: false, prix_cents: 100, stock: 5, visibilite: 'hidden',
    });
    const list = await request().get('/api/produits?q=Secret&limit=50');
    assert.ok(!list.body.data.some((p) => p.id === created.body.produit.id));
  });

  test('produit avec stock 0 n\'apparaît pas dans GET /', async () => {
    const { agent: a, entrepriseId } = await makeSellerWithEntreprise();
    const created = await a.post('/api/produits').send({
      entreprise_id: entrepriseId, nom: 'Rupture', nature: 'legume',
      bio: false, prix_cents: 100, stock: 0,
    });
    const list = await request().get('/api/produits?q=Rupture&limit=50');
    assert.ok(!list.body.data.some((p) => p.id === created.body.produit.id));
  });

  test('admin peut patcher un produit de n\'importe quel seller', async () => {
    const { entrepriseId } = await makeSellerWithEntreprise();
    const ent = await dbQuery('SELECT id FROM produit WHERE entreprise_id = $1 LIMIT 1', [entrepriseId]);
    if (ent.rows.length === 0) return;
    const { agent: admin } = await loginAdmin();
    const res = await admin.patch(`/api/produits/${ent.rows[0].id}`).send({ visibilite: 'hidden' });
    assert.equal(res.status, 200);
  });
});
