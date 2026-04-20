import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../helpers/app.js';
import {
  registerClient, registerSeller, loginAdmin, loginAs, dbQuery,
} from '../helpers/fixtures.js';

function siret() { return String(Math.floor(Math.random() * 1e14)).padStart(14, '0'); }

async function newSellerWithProductAndLieu({ shippable = true, stock = 10, prix = 500 } = {}) {
  const { agent: sellerAgent, user: seller } = await registerSeller();
  const e = await sellerAgent.post('/api/entreprises').send({ nom: 'Ferme', siret: siret() });
  const entrepriseId = e.body.entreprise.id;
  const l = await sellerAgent.post('/api/lieux-de-vente').send({
    entreprise_id: entrepriseId, nom: 'Boutique', adresse: '1 rue X, 69001 Lyon',
    lat: 45.76, lon: 4.84,
  });
  const lieuId = l.body.lieu.id;
  const p = await sellerAgent.post('/api/produits').send({
    entreprise_id: entrepriseId, nom: 'Carotte', nature: 'legume',
    bio: true, prix_cents: prix, stock, shippable, lieu_ids: [lieuId],
  });
  return { sellerAgent, seller, entrepriseId, lieuId, produitId: p.body.produit.id };
}

async function firstRelaisId() {
  const { rows } = await dbQuery('SELECT id FROM point_relais LIMIT 1');
  return rows[0].id;
}

describe('commandes', () => {
  test('POST /quote → 3 modes', async () => {
    const { produitId } = await newSellerWithProductAndLieu();
    const { agent: a } = await registerClient();
    const res = await a.post('/api/commandes/quote').send({
      lignes: [{ produit_id: produitId, quantite: 2 }],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.modes.length, 3);
    assert.equal(res.body.total_produits_cents, 1000);
    const pickup = res.body.modes.find((m) => m.mode === 'pickup_store');
    assert.equal(pickup.disponible, true);
    assert.equal(pickup.total_ttc_cents, 1000);
    const relay = res.body.modes.find((m) => m.mode === 'pickup_relay');
    assert.equal(relay.frais_port_cents, 250);
    const home = res.body.modes.find((m) => m.mode === 'home_delivery');
    assert.equal(home.disponible, true);
  });

  test('POST /quote panier vide → 400', async () => {
    const { agent: a } = await registerClient();
    const res = await a.post('/api/commandes/quote').send({ lignes: [] });
    assert.equal(res.status, 400);
  });

  test('POST /quote produit inexistant → 404', async () => {
    const { agent: a } = await registerClient();
    const res = await a.post('/api/commandes/quote').send({
      lignes: [{ produit_id: '00000000-0000-0000-0000-000000000000', quantite: 1 }],
    });
    assert.equal(res.status, 404);
  });

  test('POST /quote stock insuffisant → 409', async () => {
    const { produitId } = await newSellerWithProductAndLieu({ stock: 2 });
    const { agent: a } = await registerClient();
    const res = await a.post('/api/commandes/quote').send({
      lignes: [{ produit_id: produitId, quantite: 5 }],
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'stock_insufficient');
  });

  test('POST /quote produits non-shippable → relay/home indisponibles', async () => {
    const { produitId } = await newSellerWithProductAndLieu({ shippable: false });
    const { agent: a } = await registerClient();
    const res = await a.post('/api/commandes/quote').send({
      lignes: [{ produit_id: produitId, quantite: 1 }],
    });
    const relay = res.body.modes.find((m) => m.mode === 'pickup_relay');
    const home = res.body.modes.find((m) => m.mode === 'home_delivery');
    assert.equal(relay.disponible, false);
    assert.equal(home.disponible, false);
  });

  test('POST / pickup_store — décrémente le stock + crée ligne + sous-ligne pickup', async () => {
    const { produitId, lieuId } = await newSellerWithProductAndLieu({ stock: 10 });
    const { agent: a, user } = await registerClient();
    const res = await a.post('/api/commandes').send({
      mode_livraison: 'pickup_store',
      lignes: [{ produit_id: produitId, quantite: 3 }],
      lieu_id: lieuId,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.commande.client_id ?? user.id, user.id);
    assert.equal(res.body.commande.statut, 'pending');
    assert.equal(res.body.commande.mode_livraison, 'pickup_store');

    const stock = await dbQuery('SELECT stock FROM produit WHERE id = $1', [produitId]);
    assert.equal(stock.rows[0].stock, 7);

    const sub = await dbQuery(
      'SELECT lieu_id FROM commande_pickup_store WHERE commande_id = $1',
      [res.body.commande.id],
    );
    assert.equal(sub.rows[0].lieu_id, lieuId);

    const lignes = await dbQuery(
      'SELECT produit_id, quantite FROM ligne_commande WHERE commande_id = $1',
      [res.body.commande.id],
    );
    assert.equal(lignes.rows.length, 1);
    assert.equal(lignes.rows[0].quantite, 3);
  });

  test('POST / pickup_relay — shippable + 250c port', async () => {
    const { produitId } = await newSellerWithProductAndLieu({ shippable: true });
    const relaisId = await firstRelaisId();
    const { agent: a } = await registerClient();
    const res = await a.post('/api/commandes').send({
      mode_livraison: 'pickup_relay',
      lignes: [{ produit_id: produitId, quantite: 1 }],
      relais_id: relaisId,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.commande.frais_port_cents, 250);
  });

  test('POST / home_delivery — requiert adresse+coords', async () => {
    const { produitId } = await newSellerWithProductAndLieu({ shippable: true });
    const { agent: a } = await registerClient();
    const res = await a.post('/api/commandes').send({
      mode_livraison: 'home_delivery',
      lignes: [{ produit_id: produitId, quantite: 1 }],
      adresse: '10 rue Y, 69002 Lyon', lat: 45.76, lon: 4.84,
    });
    assert.equal(res.status, 201);
    const sub = await dbQuery(
      'SELECT adresse FROM commande_home_delivery WHERE commande_id = $1',
      [res.body.commande.id],
    );
    assert.equal(sub.rows.length, 1);
  });

  test('POST / home_delivery avec produit non-shippable → 409 mode_invalid', async () => {
    const { produitId } = await newSellerWithProductAndLieu({ shippable: false });
    const { agent: a } = await registerClient();
    const res = await a.post('/api/commandes').send({
      mode_livraison: 'home_delivery',
      lignes: [{ produit_id: produitId, quantite: 1 }],
      adresse: '10 rue Y, 69002 Lyon', lat: 45.76, lon: 4.84,
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'mode_invalid');
  });

  test('POST / pickup_store avec lieu d\'un autre producteur → 409 lieu_invalid', async () => {
    const a1 = await newSellerWithProductAndLieu();
    const a2 = await newSellerWithProductAndLieu();
    const { agent: clt } = await registerClient();
    const res = await clt.post('/api/commandes').send({
      mode_livraison: 'pickup_store',
      lignes: [{ produit_id: a1.produitId, quantite: 1 }],
      lieu_id: a2.lieuId, // lieu d'un autre producteur
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'lieu_invalid');
  });

  test('POST / par seller → 403 (rôle user/admin requis)', async () => {
    const { sellerAgent, produitId, lieuId } = await newSellerWithProductAndLieu();
    const res = await sellerAgent.post('/api/commandes').send({
      mode_livraison: 'pickup_store',
      lignes: [{ produit_id: produitId, quantite: 1 }],
      lieu_id: lieuId,
    });
    assert.equal(res.status, 403);
  });

  test('GET / — client ne voit que ses commandes', async () => {
    const { produitId, lieuId } = await newSellerWithProductAndLieu();
    const { agent: a, user } = await registerClient();
    await a.post('/api/commandes').send({
      mode_livraison: 'pickup_store',
      lignes: [{ produit_id: produitId, quantite: 1 }],
      lieu_id: lieuId,
    });
    const res = await a.get('/api/commandes');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
    for (const c of res.body.data) assert.equal(c.client_id, user.id);
  });

  test('GET / seller voit les commandes qui contiennent ses produits', async () => {
    const { sellerAgent, produitId, lieuId } = await newSellerWithProductAndLieu();
    const { agent: clt } = await registerClient();
    const created = await clt.post('/api/commandes').send({
      mode_livraison: 'pickup_store',
      lignes: [{ produit_id: produitId, quantite: 1 }],
      lieu_id: lieuId,
    });
    const res = await sellerAgent.get('/api/commandes');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.some((c) => c.id === created.body.commande.id));
  });

  test('GET / admin → voit tout', async () => {
    const { agent: admin } = await loginAdmin();
    const res = await admin.get('/api/commandes');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
  });

  test('GET /:id — client voit, autre client → 403', async () => {
    const { produitId, lieuId } = await newSellerWithProductAndLieu();
    const { agent: a } = await registerClient();
    const created = await a.post('/api/commandes').send({
      mode_livraison: 'pickup_store',
      lignes: [{ produit_id: produitId, quantite: 1 }],
      lieu_id: lieuId,
    });
    const ok = await a.get(`/api/commandes/${created.body.commande.id}`);
    assert.equal(ok.status, 200);
    assert.ok(Array.isArray(ok.body.commande.lignes));

    const { agent: b } = await registerClient();
    const ko = await b.get(`/api/commandes/${created.body.commande.id}`);
    assert.equal(ko.status, 403);
  });

  test('PATCH /:id par seller propriétaire → 200', async () => {
    const { sellerAgent, produitId, lieuId } = await newSellerWithProductAndLieu();
    const { agent: clt } = await registerClient();
    const created = await clt.post('/api/commandes').send({
      mode_livraison: 'pickup_store',
      lignes: [{ produit_id: produitId, quantite: 1 }],
      lieu_id: lieuId,
    });
    const res = await sellerAgent.patch(`/api/commandes/${created.body.commande.id}`).send({
      statut: 'preparing',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.commande.statut, 'preparing');
  });

  test('PATCH /:id par un autre seller → 403', async () => {
    const { produitId, lieuId } = await newSellerWithProductAndLieu();
    const { agent: clt } = await registerClient();
    const created = await clt.post('/api/commandes').send({
      mode_livraison: 'pickup_store',
      lignes: [{ produit_id: produitId, quantite: 1 }],
      lieu_id: lieuId,
    });
    const { agent: other } = await registerSeller();
    const res = await other.patch(`/api/commandes/${created.body.commande.id}`).send({
      statut: 'preparing',
    });
    assert.equal(res.status, 403);
  });

  test('PATCH /:id par client → 403 (rôle seller/admin requis)', async () => {
    const { produitId, lieuId } = await newSellerWithProductAndLieu();
    const { agent: clt } = await registerClient();
    const created = await clt.post('/api/commandes').send({
      mode_livraison: 'pickup_store',
      lignes: [{ produit_id: produitId, quantite: 1 }],
      lieu_id: lieuId,
    });
    const res = await clt.patch(`/api/commandes/${created.body.commande.id}`).send({
      statut: 'preparing',
    });
    assert.equal(res.status, 403);
  });
});
