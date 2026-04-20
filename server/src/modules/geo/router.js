import express from 'express';
import { query } from '../../db/pool.js';
import { proximiteQuerySchema, itineraireSchema } from './schemas.js';
import { optimiserItineraire } from './service.js';

const router = express.Router();

// Lieux de vente — version filtrée par l'horaire actuel (vue SQL pré-calculée)
router.get('/lieux', async (req, res, next) => {
  try {
    const ouverts = req.query.ouverts === '1';
    if (ouverts) {
      const { rows } = await query(`SELECT * FROM v_lieux_ouverts_maintenant`);
      return res.json({ data: rows });
    }
    const { rows } = await query(
      `SELECT l.id, l.nom, l.adresse, l.lat, l.lon, l.actif,
              e.id AS entreprise_id, e.nom AS entreprise_nom
       FROM lieu_de_vente l JOIN entreprise e ON e.id = l.entreprise_id
       WHERE l.actif = TRUE
       ORDER BY l.nom`,
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

router.get('/points-relais', async (req, res, next) => {
  try {
    if (req.query.lat && req.query.lon) {
      const { lat, lon, rayon_m, limite } = proximiteQuerySchema.parse(req.query);
      const { rows } = await query(
        `SELECT id, nom, adresse, distance_m
         FROM f_points_relais_proches(
           ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
           $3, $4
         )`,
        [lat, lon, rayon_m, limite],
      );
      return res.json({ data: rows });
    }
    const { rows } = await query(
      `SELECT id, nom, adresse, lat, lon
       FROM point_relais WHERE actif = TRUE ORDER BY nom`,
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// Optimisation de trajet — nearest-neighbor + 2-opt côté serveur
router.post('/itineraire', (req, res, next) => {
  try {
    const body = itineraireSchema.parse(req.body);
    const result = optimiserItineraire(body);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
