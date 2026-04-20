import express from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { HttpError } from '../../middlewares/error.js';

const router = express.Router();

const createSchema = z.object({
  type: z.enum(['produit', 'commande', 'lieu_de_vente', 'autre']),
  cible_id: z.uuid().optional(),
  description: z.string().min(5).max(2000),
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO alerte (emetteur_id, type, cible_id, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, type, cible_id, description, statut, created_at`,
      [req.session.user.id, body.type, body.cible_id ?? null, body.description],
    );
    res.status(201).json({ alerte: rows[0] });
  } catch (err) { next(err); }
});

// Admin : liste toutes les alertes
router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT a.id, a.type, a.cible_id, a.description, a.statut, a.created_at, a.resolved_at,
              u.email AS emetteur_email
       FROM alerte a LEFT JOIN utilisateur u ON u.id = a.emetteur_id
       ORDER BY a.created_at DESC LIMIT 500`,
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// Utilisateur voit ses propres alertes
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, type, description, statut, created_at, resolved_at
       FROM alerte WHERE emetteur_id = $1 ORDER BY created_at DESC`,
      [req.session.user.id],
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

const patchSchema = z.object({
  statut: z.enum(['open', 'in_progress', 'closed']),
});

router.patch('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const body = patchSchema.parse(req.body);
    const closing = body.statut === 'closed';
    const { rows } = await query(
      `UPDATE alerte
       SET statut = $2,
           resolved_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
           resolved_by = CASE WHEN $3 THEN $4::uuid ELSE NULL END
       WHERE id = $1
       RETURNING id, statut, resolved_at`,
      [req.params.id, body.statut, closing, req.session.user.id],
    );
    if (rows.length === 0) throw new HttpError(404, 'not_found', 'Alerte introuvable.');
    res.json({ alerte: rows[0] });
  } catch (err) { next(err); }
});

export default router;
