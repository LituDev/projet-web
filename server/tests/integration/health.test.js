import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../helpers/app.js';

describe('GET /api/health', () => {
  test('renvoie status ok + db up', async () => {
    const res = await request().get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.db, 'up');
    assert.equal(typeof res.body.uptime_s, 'number');
  });
});
