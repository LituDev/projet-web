import express from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { requireRole } from '../../middlewares/auth.js';
import { HttpError } from '../../middlewares/error.js';

const router = express.Router();

router.get('/', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT f.produit_id,
              p.nom,
              p.description,
              p.nature,
              p.bio,
              p.prix_cents,
              p.stock,
              p.shippable,
              p.entreprise_id,
              p.entreprise_nom,
              p.producteur_nom,
              p.est_saisonnier,
              f.created_at
       FROM favori f
       JOIN v_produits_disponibles p ON p.id = f.produit_id
       WHERE f.client_id = $1
       ORDER BY f.created_at DESC`,
      [req.session.user.id],
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

const toggleSchema = z.object({ produit_id: z.uuid() });

router.post('/', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    const { produit_id } = toggleSchema.parse(req.body);
    await query(
      `INSERT INTO favori (client_id, produit_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.session.user.id, produit_id],
    );
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:produit_id', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    const r = await query(
      'DELETE FROM favori WHERE client_id = $1 AND produit_id = $2',
      [req.session.user.id, req.params.produit_id],
    );
    if (r.rowCount === 0) throw new HttpError(404, 'not_found', "Ce favori n'existe pas.");
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
