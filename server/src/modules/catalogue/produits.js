import express from 'express';
import { query, withTransaction } from '../../db/pool.js';
import { HttpError } from '../../middlewares/error.js';
import { requireRole } from '../../middlewares/auth.js';
import { produitCreateSchema, produitListQuerySchema, produitUpdateSchema } from './schemas.js';

const router = express.Router();

async function assertProduitOwner(produitId, session) {
  const { rows } = await query(
    `SELECT e.owner_id, p.entreprise_id
     FROM produit p JOIN entreprise e ON e.id = p.entreprise_id
     WHERE p.id = $1`,
    [produitId],
  );
  if (rows.length === 0) throw new HttpError(404, 'not_found', 'Produit introuvable.');
  if (session.user.role !== 'admin' && rows[0].owner_id !== session.user.id) {
    throw new HttpError(403, 'forbidden', 'Vous ne pouvez pas modifier ce produit.');
  }
  return rows[0].entreprise_id;
}

async function assertEntrepriseOwner(entrepriseId, session) {
  const { rows } = await query('SELECT owner_id FROM entreprise WHERE id = $1', [entrepriseId]);
  if (rows.length === 0) throw new HttpError(404, 'not_found', 'Entreprise introuvable.');
  if (session.user.role !== 'admin' && rows[0].owner_id !== session.user.id) {
    throw new HttpError(403, 'forbidden', "Cette entreprise n'est pas à vous.");
  }
}

// Liste vendeur — tous les produits des entreprises du vendeur connecté, sans filtre de dispo
router.get('/mine', requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.id, p.nom, p.description, p.nature, p.bio, p.prix_cents, p.stock,
              p.shippable, p.visibilite, p.est_saisonnier, p.entreprise_id,
              e.nom AS entreprise_nom
       FROM produit p
       JOIN entreprise e ON e.id = p.entreprise_id
       WHERE e.owner_id = $1
       ORDER BY p.nom ASC`,
      [req.session.user.id],
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// Liste publique — via la vue v_produits_disponibles (filtre saison+visible+stock)
router.get('/', async (req, res, next) => {
  try {
    const { q, nature, bio, tri, limit, offset, favoris_only } = produitListQuerySchema.parse(req.query);
    const clauses = [];
    const params = [];
    const ORDER_BY = {
      nom_asc: 'nom ASC',
      prix_asc: 'prix_cents ASC, nom ASC',
      prix_desc: 'prix_cents DESC, nom ASC',
      stock_desc: 'stock DESC, nom ASC',
      bio_first: 'bio DESC, nom ASC',
      livraison_first: 'shippable DESC, nom ASC',
      retrait_first: 'shippable ASC, nom ASC',
    };
    const orderBy = ORDER_BY[tri] ?? ORDER_BY.nom_asc;

    if (q) { params.push(`%${q}%`); clauses.push(`(nom ILIKE $${params.length} OR description ILIKE $${params.length})`); }
    if (nature) { params.push(nature); clauses.push(`nature = $${params.length}`); }
    if (bio === 'true') clauses.push('bio = TRUE');
    if (bio === 'false') clauses.push('bio = FALSE');
    if (favoris_only === 'true' && req.session?.user?.id) {
      params.push(req.session.user.id);
      clauses.push(`id IN (SELECT produit_id FROM favori WHERE client_id = $${params.length})`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT id, nom, description, nature, bio, prix_cents, stock, shippable,
              entreprise_id, entreprise_nom, producteur_nom, est_saisonnier
       FROM v_produits_disponibles
       ${where}
        ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const countResult = await query(
      `SELECT COUNT(*)::INT AS total FROM v_produits_disponibles ${where}`,
      params.slice(0, -2),
    );
    res.json({ data: rows, total: countResult.rows[0].total, tri, limit, offset });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.id, p.nom, p.description, p.nature, p.bio, p.prix_cents, p.stock,
              p.shippable, p.visibilite, p.est_saisonnier,
              p.entreprise_id, e.nom AS entreprise_nom,
              ps.mois_debut, ps.mois_fin
       FROM produit p
       JOIN entreprise e ON e.id = p.entreprise_id
       LEFT JOIN produit_saison ps ON ps.produit_id = p.id
       WHERE p.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) throw new HttpError(404, 'not_found', 'Produit introuvable.');
    const lieux = await query(
      `SELECT l.id, l.nom, l.adresse
       FROM produit_lieu_vente plv JOIN lieu_de_vente l ON l.id = plv.lieu_id
       WHERE plv.produit_id = $1`,
      [req.params.id],
    );
    res.json({ produit: { ...rows[0], lieux: lieux.rows } });
  } catch (err) { next(err); }
});

router.post('/', requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const body = produitCreateSchema.parse(req.body);
    await assertEntrepriseOwner(body.entreprise_id, req.session);

    const produit = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO produit
           (entreprise_id, nom, description, nature, bio, prix_cents, stock, shippable, visibilite, est_saisonnier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, nom, prix_cents, stock, visibilite, est_saisonnier`,
        [body.entreprise_id, body.nom, body.description, body.nature, body.bio,
         body.prix_cents, body.stock, body.shippable, body.visibilite, body.est_saisonnier],
      );
      const produitId = rows[0].id;
      if (body.est_saisonnier) {
        await client.query(
          'INSERT INTO produit_saison (produit_id, mois_debut, mois_fin) VALUES ($1, $2, $3)',
          [produitId, body.mois_debut, body.mois_fin],
        );
      }
      for (const lieuId of body.lieu_ids) {
        await client.query(
          `INSERT INTO produit_lieu_vente (produit_id, entreprise_id, lieu_id) VALUES ($1, $2, $3)`,
          [produitId, body.entreprise_id, lieuId],
        );
      }
      return rows[0];
    });
    res.status(201).json({ produit });
  } catch (err) { next(err); }
});

router.patch('/:id', requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    await assertProduitOwner(req.params.id, req.session);
    const body = produitUpdateSchema.parse(req.body);
    const fields = Object.entries(body);
    if (fields.length === 0) {
      return res.status(400).json({ error: { code: 'no_fields', message: 'Aucun champ à modifier.' } });
    }
    const set = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await query(
      `UPDATE produit SET ${set} WHERE id = $1
       RETURNING id, nom, prix_cents, stock, visibilite`,
      [req.params.id, ...fields.map(([, v]) => v)],
    );
    res.json({ produit: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    await assertProduitOwner(req.params.id, req.session);
    await query('DELETE FROM produit WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
