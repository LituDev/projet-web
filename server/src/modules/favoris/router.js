import express from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { HttpError } from '../../middlewares/error.js';

const router = express.Router();

router.get('/', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT f.entreprise_id, e.nom AS entreprise_nom, e.description, f.created_at
       FROM favori f JOIN entreprise e ON e.id = f.entreprise_id
       WHERE f.client_id = $1 ORDER BY f.created_at DESC`,
      [req.session.user.id],
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

const toggleSchema = z.object({ entreprise_id: z.uuid() });

router.post('/', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    const { entreprise_id } = toggleSchema.parse(req.body);
    await query(
      `INSERT INTO favori (client_id, entreprise_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.session.user.id, entreprise_id],
    );
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:entreprise_id', requireAuth, async (req, res, next) => {
  try {
    const r = await query(
      'DELETE FROM favori WHERE client_id = $1 AND entreprise_id = $2',
      [req.session.user.id, req.params.entreprise_id],
    );
    if (r.rowCount === 0) throw new HttpError(404, 'not_found', "Ce favori n'existe pas.");
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
