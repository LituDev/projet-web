import express from 'express';
import { query } from '../../db/pool.js';
import { requireAuth } from '../../middlewares/auth.js';
import { HttpError } from '../../middlewares/error.js';
import { paiementSchema } from './schemas.js';
import { processPaiement } from './service.js';

const router = express.Router();

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const idempotencyKey = req.get('Idempotency-Key');
    if (!idempotencyKey || idempotencyKey.length < 10) {
      throw new HttpError(400, 'missing_idempotency_key', 'Header Idempotency-Key requis.');
    }
    const body = paiementSchema.parse(req.body);
    const { paiement, reused } = await processPaiement({ session: req.session, body, idempotencyKey });
    res.status(reused ? 200 : 201).json({ paiement });
  } catch (err) { next(err); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.id, p.commande_id, p.montant_cents, p.methode, p.statut, p.created_at,
              c.client_id, pc.last4
       FROM paiement p
       JOIN commande c ON c.id = p.commande_id
       LEFT JOIN paiement_carte pc ON pc.paiement_id = p.id
       WHERE p.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) throw new HttpError(404, 'not_found', 'Paiement introuvable.');
    const p = rows[0];
    if (req.session.user.role !== 'admin' && p.client_id !== req.session.user.id) {
      throw new HttpError(403, 'forbidden', 'Paiement non visible.');
    }
    res.json({ paiement: p });
  } catch (err) { next(err); }
});

export default router;
