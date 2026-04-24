import express from 'express';
import { query } from '../../db/pool.js';
import { proximiteQuerySchema, itineraireSchema, routeQuerySchema, geocodeQuerySchema } from './schemas.js';
import { optimiserItineraire } from './service.js';
import { HttpError } from '../../middlewares/error.js';

const OSRM_URL = process.env.OSRM_URL ?? 'https://router.project-osrm.org';
const routeCache = new Map(); // clé -> { expires, data }
const ROUTE_TTL_MS = 10 * 60 * 1000;

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
         FROM f_points_relais_proches($1, $2, $3, $4)
         ORDER BY distance_m ASC, id ASC`,
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

// Itinéraire réel (routes) via OSRM — renvoie la polyline GeoJSON + distance/durée
router.get('/route', async (req, res, next) => {
  try {
    const { from_lat, from_lon, to_lat, to_lon } = routeQuerySchema.parse(req.query);
    const key = [from_lat, from_lon, to_lat, to_lon].map((v) => v.toFixed(5)).join(',');
    const hit = routeCache.get(key);
    if (hit && hit.expires > Date.now()) return res.json(hit.data);

    const url = `${OSRM_URL}/route/v1/driving/${from_lon},${from_lat};${to_lon},${to_lat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let osrm;
    try {
      const r = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'gumes-marketplace/1.0' } });
      if (!r.ok) throw new HttpError(502, 'osrm_error', `OSRM a répondu ${r.status}.`);
      osrm = await r.json();
    } finally {
      clearTimeout(timeout);
    }
    if (osrm.code !== 'Ok' || !osrm.routes?.[0]) {
      throw new HttpError(502, 'osrm_no_route', 'Aucun itinéraire trouvé.');
    }
    const route = osrm.routes[0];
    const data = {
      coordinates: route.geometry.coordinates, // [[lon, lat], ...]
      distance_m: route.distance,
      duration_s: route.duration,
    };
    routeCache.set(key, { expires: Date.now() + ROUTE_TTL_MS, data });
    res.json(data);
  } catch (err) {
    if (err.name === 'AbortError') return next(new HttpError(504, 'osrm_timeout', 'OSRM injoignable.'));
    next(err);
  }
});

// Géocodage via Nominatim (proxy pour éviter les restrictions CORS + User-Agent)
router.get('/geocode', async (req, res, next) => {
  try {
    const { q, ville, code_postal, limit } = geocodeQuerySchema.parse(req.query);
    const recherche = q ?? [code_postal, ville].filter(Boolean).join(' ').trim();
    if (!recherche) {
      throw new HttpError(400, 'missing_location', 'Ville ou code postal requis.');
    }
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(recherche)}&format=json&limit=${limit}&accept-language=fr&countrycodes=fr&addressdetails=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'gumes-marketplace/1.0' } });
    if (!r.ok) throw new HttpError(502, 'geocode_error', `Nominatim a répondu ${r.status}.`);
    const data = await r.json();
    if (!data.length) return res.json({ result: null, ambiguous: false, count: 0 });
    if (data.length !== 1) {
      return res.json({
        result: null,
        ambiguous: true,
        count: data.length,
        suggestions: data.slice(0, 5).map((d) => d.display_name),
      });
    }
    const { lat, lon, display_name } = data[0];
    res.json({ result: { lat: Number(lat), lon: Number(lon), display_name }, ambiguous: false, count: 1 });
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
