import { query, withTransaction } from '../../db/pool.js';
import { HttpError } from '../../middlewares/error.js';

const MODES = ['pickup_store', 'pickup_relay', 'home_delivery'];

async function loadProduits(client, produitIds) {
  const { rows } = await client.query(
    `SELECT p.id, p.nom, p.prix_cents, p.stock, p.shippable, p.visibilite, p.entreprise_id
     FROM produit p WHERE p.id = ANY($1::uuid[]) FOR UPDATE`,
    [produitIds],
  );
  return rows;
}

function fraisPort(mode, totalProduits) {
  if (mode === 'pickup_store') return 0;
  if (mode === 'pickup_relay') return 250;
  return totalProduits >= 5000 ? 0 : 490;
}

// Renvoie pour chaque mode : { mode, disponible, motif?, frais_port_cents, total_ttc_cents }
export async function computeQuote(lignes) {
  if (lignes.length === 0) {
    throw new HttpError(400, 'empty_cart', 'Panier vide.');
  }
  const rows = await loadProduitsWithoutLock(lignes.map((l) => l.produit_id));
  const byId = new Map(rows.map((r) => [r.id, r]));

  let totalProduits = 0;
  let allShippable = true;
  const entreprises = new Set();

  const detailLignes = lignes.map((l) => {
    const p = byId.get(l.produit_id);
    if (!p) throw new HttpError(404, 'product_not_found', `Produit ${l.produit_id} introuvable.`);
    if (p.visibilite !== 'visible') throw new HttpError(409, 'not_available', `${p.nom} n'est plus disponible.`);
    if (p.stock < l.quantite) throw new HttpError(409, 'stock_insufficient', `Stock insuffisant pour ${p.nom}.`);
    totalProduits += p.prix_cents * l.quantite;
    if (!p.shippable) allShippable = false;
    entreprises.add(p.entreprise_id);
    return { produit_id: p.id, nom: p.nom, prix_cents: p.prix_cents, quantite: l.quantite };
  });

  const memeEntreprise = entreprises.size === 1;

  const modes = MODES.map((mode) => {
    let disponible = true;
    let motif;
    if (mode === 'pickup_store' && !memeEntreprise) {
      disponible = false;
      motif = 'Pickup en lieu de vente limité à un seul producteur par commande.';
    }
    if ((mode === 'pickup_relay' || mode === 'home_delivery') && !allShippable) {
      disponible = false;
      motif = 'Certains produits ne peuvent pas être expédiés.';
    }
    const port = disponible ? fraisPort(mode, totalProduits) : 0;
    return {
      mode,
      disponible,
      motif,
      frais_port_cents: port,
      total_ttc_cents: totalProduits + port,
    };
  });

  return { lignes: detailLignes, total_produits_cents: totalProduits, modes };
}

async function loadProduitsWithoutLock(ids) {
  const { rows } = await query(
    `SELECT id, nom, prix_cents, stock, shippable, visibilite, entreprise_id
     FROM produit WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  return rows;
}

export async function createCommande(session, body) {
  return withTransaction(async (client) => {
    const produits = await loadProduits(client, body.lignes.map((l) => l.produit_id));
    const byId = new Map(produits.map((p) => [p.id, p]));

    let totalProduits = 0;
    let allShippable = true;
    const entreprises = new Set();
    const detail = [];

    for (const l of body.lignes) {
      const p = byId.get(l.produit_id);
      if (!p) throw new HttpError(404, 'product_not_found', `Produit ${l.produit_id} introuvable.`);
      if (p.visibilite !== 'visible') throw new HttpError(409, 'not_available', `${p.nom} indisponible.`);
      if (p.stock < l.quantite) throw new HttpError(409, 'stock_insufficient', `Stock insuffisant pour ${p.nom}.`);
      totalProduits += p.prix_cents * l.quantite;
      if (!p.shippable) allShippable = false;
      entreprises.add(p.entreprise_id);
      detail.push({ produit_id: p.id, prix_unitaire_cents: p.prix_cents, quantite: l.quantite });
    }

    // Vérification éligibilité du mode choisi
    if (body.mode_livraison === 'pickup_store' && entreprises.size > 1) {
      throw new HttpError(409, 'mode_invalid', 'Pickup en lieu de vente : un seul producteur par commande.');
    }
    if ((body.mode_livraison === 'pickup_relay' || body.mode_livraison === 'home_delivery') && !allShippable) {
      throw new HttpError(409, 'mode_invalid', 'Des produits ne sont pas expédiables.');
    }
    if (body.mode_livraison === 'pickup_store') {
      // Le lieu doit appartenir à l'entreprise du panier
      const entrepriseId = [...entreprises][0];
      const { rowCount } = await client.query(
        'SELECT 1 FROM lieu_de_vente WHERE id = $1 AND entreprise_id = $2',
        [body.lieu_id, entrepriseId],
      );
      if (rowCount === 0) {
        throw new HttpError(409, 'lieu_invalid', "Ce lieu n'appartient pas au producteur du panier.");
      }
    }

    const fp = fraisPort(body.mode_livraison, totalProduits);

    const cmd = await client.query(
      `INSERT INTO commande
         (client_id, statut, mode_livraison, total_produits_cents, frais_port_cents)
       VALUES ($1, 'pending', $2, $3, $4)
       RETURNING id, statut, mode_livraison, total_produits_cents, frais_port_cents, total_ttc_cents, date_commande`,
      [session.user.id, body.mode_livraison, totalProduits, fp],
    );
    const commandeId = cmd.rows[0].id;

    for (const d of detail) {
      await client.query(
        `INSERT INTO ligne_commande (commande_id, produit_id, quantite, prix_unitaire_cents)
         VALUES ($1, $2, $3, $4)`,
        [commandeId, d.produit_id, d.quantite, d.prix_unitaire_cents],
      );
      await client.query('UPDATE produit SET stock = stock - $1 WHERE id = $2', [d.quantite, d.produit_id]);
    }

    if (body.mode_livraison === 'pickup_store') {
      await client.query(
        `INSERT INTO commande_pickup_store (commande_id, lieu_id) VALUES ($1, $2)`,
        [commandeId, body.lieu_id],
      );
    } else if (body.mode_livraison === 'pickup_relay') {
      await client.query(
        `INSERT INTO commande_pickup_relay (commande_id, relais_id) VALUES ($1, $2)`,
        [commandeId, body.relais_id],
      );
    } else {
      await client.query(
        `INSERT INTO commande_home_delivery (commande_id, adresse, lat, lon)
         VALUES ($1, $2, $3, $4)`,
        [commandeId, body.adresse, body.lat, body.lon],
      );
    }

    return cmd.rows[0];
  });
}
