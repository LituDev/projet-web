import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../helpers/app.js';
import { dbQuery } from '../helpers/fixtures.js';

describe('geo', () => {
  test('GET /lieux → tableau non vide', async () => {
    const res = await request().get('/api/geo/lieux');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
    const l = res.body.data[0];
    assert.ok(l.id && l.nom && typeof l.lat === 'number');
  });

  test('GET /lieux?ouverts=1 → via v_lieux_ouverts_maintenant', async () => {
    const res = await request().get('/api/geo/lieux?ouverts=1');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  test('GET /points-relais sans coords → tableau (actifs)', async () => {
    const res = await request().get('/api/geo/points-relais');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
  });

  test('GET /points-relais avec lat/lon → trié par distance croissante', async () => {
    const { rows } = await dbQuery(
      `SELECT lat, lon FROM point_relais WHERE actif = TRUE ORDER BY id LIMIT 1`,
    );
    assert.ok(rows.length >= 1);

    const lat = Number(rows[0].lat);
    const lon = Number(rows[0].lon);
    const res = await request().get(`/api/geo/points-relais?lat=${lat}&lon=${lon}&rayon_m=200000`);
    assert.equal(res.status, 200);
    const { data } = res.body;
    assert.ok(data.length >= 1);
    for (let i = 1; i < data.length; i++) {
      assert.ok(data[i].distance_m >= data[i - 1].distance_m);
    }
  });

  test('GET /points-relais rayon_m hors bornes → 400', async () => {
    const res = await request().get('/api/geo/points-relais?lat=45&lon=4&rayon_m=999999999');
    assert.equal(res.status, 400);
  });

  test('POST /itineraire → ordre = depart + etapes', async () => {
    const res = await request().post('/api/geo/itineraire').send({
      depart: { id: 'D', lat: 45.764, lon: 4.8357 },
      etapes: [
        { id: 'A', lat: 45.77, lon: 4.84 },
        { id: 'B', lat: 45.75, lon: 4.82 },
        { id: 'C', lat: 45.78, lon: 4.85 },
      ],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ordre.length, 4);
    assert.equal(res.body.ordre[0].id, 'D');
    assert.ok(typeof res.body.distance_m === 'number');
    assert.ok(typeof res.body.algo === 'string');
  });

  test('POST /itineraire trop d\'étapes → 400', async () => {
    const etapes = Array.from({ length: 20 }, (_, i) => ({
      id: `E${i}`, lat: 45.76 + i * 0.001, lon: 4.83 + i * 0.001,
    }));
    const res = await request().post('/api/geo/itineraire').send({
      depart: { id: 'D', lat: 45.764, lon: 4.8357 },
      etapes,
    });
    assert.equal(res.status, 400);
  });
});
