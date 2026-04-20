import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../helpers/app.js';
import {
  registerClient, registerSeller, loginAdmin, loginAs, dbQuery,
} from '../helpers/fixtures.js';

describe('admin', () => {
  test('GET /users anonyme → 401', async () => {
    const res = await request().get('/api/admin/users');
    assert.equal(res.status, 401);
  });

  test('GET /users par client → 403', async () => {
    const { agent: a } = await registerClient();
    const res = await a.get('/api/admin/users');
    assert.equal(res.status, 403);
  });

  test('GET /users par seller → 403', async () => {
    const { agent: s } = await registerSeller();
    const res = await s.get('/api/admin/users');
    assert.equal(res.status, 403);
  });

  test('GET /users par admin → tableau', async () => {
    const { agent: admin } = await loginAdmin();
    const res = await admin.get('/api/admin/users');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 30); // seed: 1 admin + 10 sellers + 30 clients
  });

  test('PATCH /users/:id/role écrit un audit_log', async () => {
    const { user } = await registerClient();
    const { agent: admin } = await loginAdmin();
    const res = await admin.patch(`/api/admin/users/${user.id}/role`).send({ role: 'seller' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'seller');

    const { rows } = await dbQuery(
      `SELECT action, payload FROM audit_log
       WHERE target_id = $1 AND action = 'user.role_changed'
       ORDER BY created_at DESC LIMIT 1`,
      [user.id],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].payload.role, 'seller');
  });

  test('PATCH /users/:id/role inexistant → 404', async () => {
    const { agent: admin } = await loginAdmin();
    const res = await admin.patch('/api/admin/users/00000000-0000-0000-0000-000000000000/role')
      .send({ role: 'seller' });
    assert.equal(res.status, 404);
  });

  test('DELETE /users/:id → soft-delete + anonymise email + audit_log', async () => {
    const { user } = await registerClient();
    const { agent: admin } = await loginAdmin();
    const res = await admin.delete(`/api/admin/users/${user.id}`);
    assert.equal(res.status, 204);

    const { rows } = await dbQuery(
      'SELECT email, deleted_at FROM utilisateur WHERE id = $1', [user.id],
    );
    assert.ok(rows[0].deleted_at);
    assert.ok(rows[0].email.startsWith('deleted-'));

    const audit = await dbQuery(
      `SELECT id FROM audit_log WHERE target_id = $1 AND action = 'user.soft_deleted'`,
      [user.id],
    );
    assert.equal(audit.rows.length, 1);
  });

  test('DELETE /users/:id déjà supprimé → 404', async () => {
    const { user } = await registerClient();
    const { agent: admin } = await loginAdmin();
    await admin.delete(`/api/admin/users/${user.id}`);
    const res = await admin.delete(`/api/admin/users/${user.id}`);
    assert.equal(res.status, 404);
  });

  test('GET /stats → 4 sections', async () => {
    const { agent: admin } = await loginAdmin();
    const res = await admin.get('/api/admin/stats');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.users));
    assert.equal(typeof res.body.produits, 'number');
    assert.ok(Array.isArray(res.body.commandes));
    assert.ok(Array.isArray(res.body.alertes));
  });

  test('GET /audit → tableau via v_audit_recent', async () => {
    const { agent: admin } = await loginAdmin();
    const res = await admin.get('/api/admin/audit');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  test('GET /stats par seller → 403', async () => {
    const { agent: s } = await registerSeller();
    const res = await s.get('/api/admin/stats');
    assert.equal(res.status, 403);
  });
});
