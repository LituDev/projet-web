import express from 'express';
import { query } from '../../db/pool.js';
import { requireRole } from '../../middlewares/auth.js';
import { HttpError } from '../../middlewares/error.js';
import { avisCreateSchema, avisListQuerySchema } from './schemas.js';

const router = express.Router();

router.get('/produits/:produitId', async (req, res, next) => {
  try {
    const { limit, offset } = avisListQuerySchema.parse(req.query);
    const produitId = req.params.produitId;

    const exists = await query('SELECT id FROM produit WHERE id = $1', [produitId]);
    if (exists.rows.length === 0) throw new HttpError(404, 'not_found', 'Produit introuvable.');

    const stats = await query(
      `SELECT COALESCE(ROUND(AVG(note)::numeric, 2), 0)::float8 AS moyenne,
              COUNT(*)::int AS nb_avis
       FROM avis_produit
       WHERE produit_id = $1`,
      [produitId],
    );

    const rows = await query(
      `SELECT a.id, a.produit_id, a.client_id, a.note, a.commentaire, a.created_at, a.updated_at,
              (pc.prenom || ' ' || pc.nom) AS auteur
       FROM avis_produit a
       JOIN profil_client pc ON pc.user_id = a.client_id
       WHERE a.produit_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [produitId, limit, offset],
    );

    let monAvis = null;
    if (req.session?.user?.role === 'user' || req.session?.user?.role === 'admin') {
      const mine = await query(
        `SELECT id, produit_id, client_id, note, commentaire, created_at, updated_at
         FROM avis_produit
         WHERE produit_id = $1 AND client_id = $2`,
        [produitId, req.session.user.id],
      );
      monAvis = mine.rows[0] ?? null;
    }

    res.json({
      data: rows.rows,
      stats: stats.rows[0],
      mon_avis: monAvis,
      limit,
      offset,
    });
  } catch (err) { next(err); }
});

router.post('/produits/:produitId', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    const produitId = req.params.produitId;
    const body = avisCreateSchema.parse(req.body);

    const exists = await query('SELECT id FROM produit WHERE id = $1', [produitId]);
    if (exists.rows.length === 0) throw new HttpError(404, 'not_found', 'Produit introuvable.');

    const inserted = await query(
      `INSERT INTO avis_produit (produit_id, client_id, note, commentaire)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (produit_id, client_id)
       DO UPDATE SET note = EXCLUDED.note,
                     commentaire = EXCLUDED.commentaire,
                     updated_at = NOW()
       RETURNING id, produit_id, client_id, note, commentaire, created_at, updated_at`,
      [produitId, req.session.user.id, body.note, body.commentaire],
    );

    res.status(201).json({ avis: inserted.rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:avisId', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    const deleted = await query(
      `DELETE FROM avis_produit
       WHERE id = $1 AND client_id = $2
       RETURNING id`,
      [req.params.avisId, req.session.user.id],
    );
    if (deleted.rows.length === 0) throw new HttpError(404, 'not_found', 'Avis introuvable.');
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
