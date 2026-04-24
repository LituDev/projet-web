import express from 'express';
import { query, withTransaction } from '../../db/pool.js';
import { HttpError } from '../../middlewares/error.js';
import { requireRole } from '../../middlewares/auth.js';
import { lieuCreateSchema, lieuUpdateSchema } from './schemas.js';

const router = express.Router();

async function assertLieuOwner(lieuId, session) {
  const { rows } = await query(
    `SELECT e.owner_id FROM lieu_de_vente l
     JOIN entreprise e ON e.id = l.entreprise_id
     WHERE l.id = $1`,
    [lieuId],
  );
  if (rows.length === 0) throw new HttpError(404, 'not_found', 'Lieu introuvable.');
  if (session.user.role !== 'admin' && rows[0].owner_id !== session.user.id) {
    throw new HttpError(403, 'forbidden', 'Vous ne pouvez pas modifier ce lieu.');
  }
}

async function assertEntrepriseOwner(entrepriseId, session) {
  const { rows } = await query('SELECT owner_id FROM entreprise WHERE id = $1', [entrepriseId]);
  if (rows.length === 0) throw new HttpError(404, 'not_found', 'Entreprise introuvable.');
  if (session.user.role !== 'admin' && rows[0].owner_id !== session.user.id) {
    throw new HttpError(403, 'forbidden', "Cette entreprise n'est pas à vous.");
  }
}

router.get('/', async (req, res, next) => {
  try {
    const entId = req.query.entreprise_id;
    const { rows } = entId
      ? await query(
        `SELECT id, entreprise_id, nom, adresse, lat, lon, actif
           FROM lieu_de_vente WHERE entreprise_id = $1 ORDER BY nom`, [entId])
      : await query(
        `SELECT id, entreprise_id, nom, adresse, lat, lon, actif
           FROM lieu_de_vente ORDER BY nom`);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, entreprise_id, nom, adresse, lat, lon, actif
         FROM lieu_de_vente WHERE id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) throw new HttpError(404, 'not_found', 'Lieu introuvable.');
    const horaires = await query(
      'SELECT jour_semaine, heure_debut, heure_fin FROM horaire WHERE lieu_id = $1 ORDER BY jour_semaine',
      [req.params.id],
    );
    res.json({ lieu: { ...rows[0], horaires: horaires.rows } });
  } catch (err) { next(err); }
});

router.post('/', requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const body = lieuCreateSchema.parse(req.body);
    await assertEntrepriseOwner(body.entreprise_id, req.session);
    const lieu = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO lieu_de_vente (entreprise_id, nom, adresse, lat, lon, actif)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, entreprise_id, nom, adresse, lat, lon, actif`,
        [body.entreprise_id, body.nom, body.adresse, body.lat, body.lon, body.actif],
      );
      for (const h of body.horaires) {
        await client.query(
          'INSERT INTO horaire (lieu_id, jour_semaine, heure_debut, heure_fin) VALUES ($1, $2, $3, $4)',
          [rows[0].id, h.jour_semaine, h.heure_debut, h.heure_fin],
        );
      }
      return rows[0];
    });
    res.status(201).json({ lieu });
  } catch (err) { next(err); }
});

router.patch('/:id', requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    await assertLieuOwner(req.params.id, req.session);
    const body = lieuUpdateSchema.parse(req.body);
    const { horaires, ...scalar } = body;

    await withTransaction(async (client) => {
      const fields = Object.entries(scalar);
      if (fields.length > 0) {
        const set = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
        await client.query(
          `UPDATE lieu_de_vente SET ${set} WHERE id = $1`,
          [req.params.id, ...fields.map(([, v]) => v)],
        );
      }
      if (horaires) {
        await client.query('DELETE FROM horaire WHERE lieu_id = $1', [req.params.id]);
        for (const h of horaires) {
          await client.query(
            'INSERT INTO horaire (lieu_id, jour_semaine, heure_debut, heure_fin) VALUES ($1, $2, $3, $4)',
            [req.params.id, h.jour_semaine, h.heure_debut, h.heure_fin],
          );
        }
      }
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    await assertLieuOwner(req.params.id, req.session);
    await query('DELETE FROM lieu_de_vente WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
