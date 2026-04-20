import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request } from '../helpers/app.js';
import {
  registerClient, registerSeller, loginAdmin, dbQuery,
} from '../helpers/fixtures.js';

function siret() { return String(Math.floor(Math.random() * 1e14)).padStart(14, '0'); }
function uniqKey() { return `idem-${randomUUID()}`; }

async function setupScenario({ shippable = true } = {}) {
  const { agent: sa } = await registerSeller();
  const e = await sa.post('/api/entreprises').send({ nom: 'F', siret: siret() });
  const l = await sa.post('/api/lieux-de-vente').send({
    entreprise_id: e.body.entreprise.id, nom: 'B', adresse: '1 rue X, 69001 Lyon',
    lat: 45.76, lon: 4.84,
  });
  const p = await sa.post('/api/produits').send({
    entreprise_id: e.body.entreprise.id, nom: 'Tomate', nature: 'legume',
    bio: true, prix_cents: 200, stock: 10, shippable,
  });
  return { lieuId: l.body.lieu.id, produitId: p.body.produit.id };
}

async function placePickupOrder(agent, produitId, lieuId, qte = 1) {
  const res = await agent.post('/api/commandes').send({
    mode_livraison: 'pickup_store',
    lignes: [{ produit_id: produitId, quantite: qte }],
    lieu_id: lieuId,
  });
  return res.body.commande;
}

async function placeHomeOrder(agent, produitId) {
  const res = await agent.post('/api/commandes').send({
    mode_livraison: 'home_delivery',
    lignes: [{ produit_id: produitId, quantite: 1 }],
    adresse: '1 rue X, 69001 Lyon', lat: 45.76, lon: 4.84,
  });
  return res.body.commande;
}

describe('paiement', () => {
  test('POST / sans Idempotency-Key → 400', async () => {
    const { agent: a } = await registerClient();
    const { lieuId, produitId } = await setupScenario();
    const cmd = await placePickupOrder(a, produitId, lieuId);
    const res = await a.post('/api/paiements').send({
      methode: 'card_fake', commande_id: cmd.id, numero_carte: '4111111111111234',
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'missing_idempotency_key');
  });

  test('card success → 201 + commande passe en accepted + last4 stocké', async () => {
    const { agent: a } = await registerClient();
    const { lieuId, produitId } = await setupScenario();
    const cmd = await placePickupOrder(a, produitId, lieuId);
    const res = await a.post('/api/paiements')
      .set('Idempotency-Key', uniqKey())
      .send({ methode: 'card_fake', commande_id: cmd.id, numero_carte: '4111111111111234' });
    assert.equal(res.status, 201);
    assert.equal(res.body.paiement.statut, 'success');

    const updated = await dbQuery('SELECT statut FROM commande WHERE id = $1', [cmd.id]);
    assert.equal(updated.rows[0].statut, 'accepted');
    const last = await dbQuery(
      'SELECT last4 FROM paiement_carte WHERE paiement_id = $1', [res.body.paiement.id],
    );
    assert.equal(last.rows[0].last4, '1234');
  });

  test('card se terminant par 0000 → declined + commande reste pending', async () => {
    const { agent: a } = await registerClient();
    const { lieuId, produitId } = await setupScenario();
    const cmd = await placePickupOrder(a, produitId, lieuId);
    const res = await a.post('/api/paiements')
      .set('Idempotency-Key', uniqKey())
      .send({ methode: 'card_fake', commande_id: cmd.id, numero_carte: '4111111111110000' });
    assert.equal(res.status, 201);
    assert.equal(res.body.paiement.statut, 'declined');
    const c = await dbQuery('SELECT statut FROM commande WHERE id = $1', [cmd.id]);
    assert.equal(c.rows[0].statut, 'pending');
  });

  test('card se terminant par 0001 → error', async () => {
    const { agent: a } = await registerClient();
    const { lieuId, produitId } = await setupScenario();
    const cmd = await placePickupOrder(a, produitId, lieuId);
    const res = await a.post('/api/paiements')
      .set('Idempotency-Key', uniqKey())
      .send({ methode: 'card_fake', commande_id: cmd.id, numero_carte: '4111111111110001' });
    assert.equal(res.status, 201);
    assert.equal(res.body.paiement.statut, 'error');
  });

  test('même Idempotency-Key rejoué → 200 + même paiement', async () => {
    const { agent: a } = await registerClient();
    const { lieuId, produitId } = await setupScenario();
    const cmd = await placePickupOrder(a, produitId, lieuId);
    const key = uniqKey();
    const first = await a.post('/api/paiements').set('Idempotency-Key', key).send({
      methode: 'card_fake', commande_id: cmd.id, numero_carte: '4111111111111234',
    });
    const second = await a.post('/api/paiements').set('Idempotency-Key', key).send({
      methode: 'card_fake', commande_id: cmd.id, numero_carte: '4111111111111234',
    });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.paiement.id, first.body.paiement.id);
  });

  test('on_pickup sur commande pickup_store → pending', async () => {
    const { agent: a } = await registerClient();
    const { lieuId, produitId } = await setupScenario();
    const cmd = await placePickupOrder(a, produitId, lieuId);
    const res = await a.post('/api/paiements').set('Idempotency-Key', uniqKey()).send({
      methode: 'on_pickup', commande_id: cmd.id,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.paiement.statut, 'pending');
  });

  test('on_pickup sur commande home_delivery → 409 methode_invalid', async () => {
    const { agent: a } = await registerClient();
    const { produitId } = await setupScenario({ shippable: true });
    const cmd = await placeHomeOrder(a, produitId);
    const res = await a.post('/api/paiements').set('Idempotency-Key', uniqKey()).send({
      methode: 'on_pickup', commande_id: cmd.id,
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'methode_invalid');
  });

  test('on_delivery sur commande pickup_store → 409 methode_invalid', async () => {
    const { agent: a } = await registerClient();
    const { lieuId, produitId } = await setupScenario();
    const cmd = await placePickupOrder(a, produitId, lieuId);
    const res = await a.post('/api/paiements').set('Idempotency-Key', uniqKey()).send({
      methode: 'on_delivery', commande_id: cmd.id,
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'methode_invalid');
  });

  test('second paiement sur la même commande → 409 already_paid', async () => {
    const { agent: a } = await registerClient();
    const { lieuId, produitId } = await setupScenario();
    const cmd = await placePickupOrder(a, produitId, lieuId);
    await a.post('/api/paiements').set('Idempotency-Key', uniqKey()).send({
      methode: 'card_fake', commande_id: cmd.id, numero_carte: '4111111111111234',
    });
    const res = await a.post('/api/paiements').set('Idempotency-Key', uniqKey()).send({
      methode: 'card_fake', commande_id: cmd.id, numero_carte: '4111111111111234',
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'already_paid');
  });

  test('paiement d\'une commande qui n\'est pas à moi → 403', async () => {
    const { agent: a } = await registerClient();
    const { lieuId, produitId } = await setupScenario();
    const cmd = await placePickupOrder(a, produitId, lieuId);
    const { agent: b } = await registerClient();
    const res = await b.post('/api/paiements').set('Idempotency-Key', uniqKey()).send({
      methode: 'card_fake', commande_id: cmd.id, numero_carte: '4111111111111234',
    });
    assert.equal(res.status, 403);
  });

  test('GET /:id — propriétaire voit, autre client → 403', async () => {
    const { agent: a } = await registerClient();
    const { lieuId, produitId } = await setupScenario();
    const cmd = await placePickupOrder(a, produitId, lieuId);
    const paid = await a.post('/api/paiements').set('Idempotency-Key', uniqKey()).send({
      methode: 'card_fake', commande_id: cmd.id, numero_carte: '4111111111111234',
    });
    const ok = await a.get(`/api/paiements/${paid.body.paiement.id}`);
    assert.equal(ok.status, 200);

    const { agent: b } = await registerClient();
    const ko = await b.get(`/api/paiements/${paid.body.paiement.id}`);
    assert.equal(ko.status, 403);
  });

  test('GET /:id admin voit tout', async () => {
    const { agent: a } = await registerClient();
    const { lieuId, produitId } = await setupScenario();
    const cmd = await placePickupOrder(a, produitId, lieuId);
    const paid = await a.post('/api/paiements').set('Idempotency-Key', uniqKey()).send({
      methode: 'card_fake', commande_id: cmd.id, numero_carte: '4111111111111234',
    });
    const { agent: admin } = await loginAdmin();
    const res = await admin.get(`/api/paiements/${paid.body.paiement.id}`);
    assert.equal(res.status, 200);
  });
});
