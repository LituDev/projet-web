import express from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { requireRole } from '../../middlewares/auth.js';
import { HttpError } from '../../middlewares/error.js';

const router = express.Router();

router.use(requireRole('admin'));

router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, email, role, created_at, last_login_at, deleted_at
       FROM utilisateur ORDER BY created_at DESC`,
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

const roleSchema = z.object({ role: z.enum(['user', 'seller', 'admin']) });
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = roleSchema.parse(req.body);
    const { rows } = await query(
      'UPDATE utilisateur SET role = $2 WHERE id = $1 RETURNING id, email, role',
      [req.params.id, role],
    );
    if (rows.length === 0) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');
    await query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, payload)
       VALUES ($1, 'user.role_changed', 'utilisateur', $2, jsonb_build_object('role', $3::text))`,
      [req.session.user.id, req.params.id, role],
    );
    res.json({ user: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    // Soft delete + anonymisation email (RGPD)
    const { rows } = await query(
      `UPDATE utilisateur
       SET deleted_at = NOW(), email = 'deleted-' || id::text || '@anon'
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id],
    );
    if (rows.length === 0) throw new HttpError(404, 'not_found', 'Utilisateur introuvable ou déjà supprimé.');
    await query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id)
       VALUES ($1, 'user.soft_deleted', 'utilisateur', $2)`,
      [req.session.user.id, req.params.id],
    );
    res.status(204).end();
  } catch (err) { next(err); }
});

// Stats globales pour le dashboard admin
router.get('/stats', async (req, res, next) => {
  try {
    const users = await query(`SELECT role, COUNT(*)::INT AS n FROM utilisateur WHERE deleted_at IS NULL GROUP BY role`);
    const produits = await query(`SELECT COUNT(*)::INT AS n FROM produit`);
    const commandes = await query(`SELECT statut, COUNT(*)::INT AS n FROM commande GROUP BY statut`);
    const alertes = await query(`SELECT statut, COUNT(*)::INT AS n FROM alerte GROUP BY statut`);
    res.json({
      users: users.rows,
      produits: produits.rows[0].n,
      commandes: commandes.rows,
      alertes: alertes.rows,
    });
  } catch (err) { next(err); }
});

router.get('/audit', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM v_audit_recent`);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

export default router;
