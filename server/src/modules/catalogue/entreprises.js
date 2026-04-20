import express from 'express';
import { query, withTransaction } from '../../db/pool.js';
import { HttpError } from '../../middlewares/error.js';
import { requireRole } from '../../middlewares/auth.js';
import { entrepriseCreateSchema, entrepriseUpdateSchema } from './schemas.js';

const router = express.Router();

async function assertOwner(entrepriseId, session) {
  const { rows } = await query('SELECT owner_id FROM entreprise WHERE id = $1', [entrepriseId]);
  if (rows.length === 0) throw new HttpError(404, 'not_found', 'Entreprise introuvable.');
  if (session.user.role !== 'admin' && rows[0].owner_id !== session.user.id) {
    throw new HttpError(403, 'forbidden', 'Vous ne pouvez pas modifier cette entreprise.');
  }
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.id, e.nom, e.siret, e.description, e.owner_id, e.created_at,
              (pp.nom || ' ' || pp.prenom) AS producteur_nom
       FROM entreprise e
       JOIN profil_producteur pp ON pp.user_id = e.owner_id
       ORDER BY e.nom`,
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.id, e.nom, e.siret, e.description, e.owner_id, e.created_at,
              (pp.nom || ' ' || pp.prenom) AS producteur_nom, pp.tel AS producteur_tel
       FROM entreprise e
       JOIN profil_producteur pp ON pp.user_id = e.owner_id
       WHERE e.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) throw new HttpError(404, 'not_found', 'Entreprise introuvable.');
    res.json({ entreprise: rows[0] });
  } catch (err) { next(err); }
});

router.post('/', requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const body = entrepriseCreateSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO entreprise (owner_id, nom, siret, description)
       VALUES ($1, $2, $3, $4) RETURNING id, nom, siret, description, created_at`,
      [req.session.user.id, body.nom, body.siret, body.description],
    );
    res.status(201).json({ entreprise: rows[0] });
  } catch (err) { next(err); }
});

router.patch('/:id', requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    await assertOwner(req.params.id, req.session);
    const body = entrepriseUpdateSchema.parse(req.body);
    const fields = Object.entries(body);
    if (fields.length === 0) return res.status(400).json({ error: { code: 'no_fields', message: 'Aucun champ à modifier.' } });
    const set = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = fields.map(([, v]) => v);
    const { rows } = await query(
      `UPDATE entreprise SET ${set} WHERE id = $1 RETURNING id, nom, siret, description`,
      [req.params.id, ...values],
    );
    res.json({ entreprise: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    await assertOwner(req.params.id, req.session);
    await withTransaction(async (client) => {
      await client.query('DELETE FROM entreprise WHERE id = $1', [req.params.id]);
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
