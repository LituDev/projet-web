import express from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { requireRole } from '../../middlewares/auth.js';
import { HttpError } from '../../middlewares/error.js';

const router = express.Router();

async function assertListeOwner(listeId, userId) {
  const { rows } = await query('SELECT client_id FROM liste_courses WHERE id = $1', [listeId]);
  if (rows.length === 0) throw new HttpError(404, 'not_found', 'Liste introuvable.');
  if (rows[0].client_id !== userId) throw new HttpError(403, 'forbidden', 'Liste non accessible.');
}

router.get('/', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, nom, created_at FROM liste_courses WHERE client_id = $1 ORDER BY created_at DESC',
      [req.session.user.id],
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

router.get('/:id', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    await assertListeOwner(req.params.id, req.session.user.id);
    const items = await query(
      `SELECT ic.produit_id, ic.quantite,
              p.nom, p.prix_cents, p.entreprise_id,
              (SELECT l.id FROM produit_lieu_vente plv JOIN lieu_de_vente l ON l.id = plv.lieu_id
               WHERE plv.produit_id = p.id LIMIT 1) AS lieu_id,
              (SELECT l.nom FROM produit_lieu_vente plv JOIN lieu_de_vente l ON l.id = plv.lieu_id
               WHERE plv.produit_id = p.id LIMIT 1) AS lieu_nom,
              (SELECT l.lat FROM produit_lieu_vente plv JOIN lieu_de_vente l ON l.id = plv.lieu_id
               WHERE plv.produit_id = p.id LIMIT 1) AS lieu_lat,
              (SELECT l.lon FROM produit_lieu_vente plv JOIN lieu_de_vente l ON l.id = plv.lieu_id
               WHERE plv.produit_id = p.id LIMIT 1) AS lieu_lon
       FROM item_liste_courses ic JOIN produit p ON p.id = ic.produit_id
       WHERE ic.liste_id = $1
       ORDER BY p.nom`,
      [req.params.id],
    );
    res.json({ items: items.rows });
  } catch (err) { next(err); }
});

const createSchema = z.object({ nom: z.string().min(1).max(120).default('Ma liste') });
router.post('/', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const { rows } = await query(
      'INSERT INTO liste_courses (client_id, nom) VALUES ($1, $2) RETURNING id, nom, created_at',
      [req.session.user.id, body.nom],
    );
    res.status(201).json({ liste: rows[0] });
  } catch (err) { next(err); }
});

const itemSchema = z.object({
  produit_id: z.uuid(),
  quantite: z.number().int().min(1).max(99).default(1),
});

router.post('/:id/items', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    await assertListeOwner(req.params.id, req.session.user.id);
    const body = itemSchema.parse(req.body);
    await query(
      `INSERT INTO item_liste_courses (liste_id, produit_id, quantite)
       VALUES ($1, $2, $3)
       ON CONFLICT (liste_id, produit_id) DO UPDATE SET quantite = item_liste_courses.quantite + EXCLUDED.quantite`,
      [req.params.id, body.produit_id, body.quantite],
    );
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id/items/:produit_id', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    await assertListeOwner(req.params.id, req.session.user.id);
    await query(
      'DELETE FROM item_liste_courses WHERE liste_id = $1 AND produit_id = $2',
      [req.params.id, req.params.produit_id],
    );
    res.status(204).end();
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    await assertListeOwner(req.params.id, req.session.user.id);
    await withTransaction(async (client) => {
      await client.query('DELETE FROM liste_courses WHERE id = $1', [req.params.id]);
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
