// Build the Express app once and hand out supertest agents to test files.
import supertest from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

let appInstance;

export function getApp() {
  if (!appInstance) appInstance = createApp();
  return appInstance;
}

export function request() {
  return supertest(getApp());
}

export function agent() {
  return supertest.agent(getApp());
}

export async function closePool() {
  await pool.end();
}
