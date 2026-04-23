// Root test runner. Executing via `node --test tests/run.test.js` keeps every
// suite inside a single process so we only migrate+seed the test DB once and
// only bind the Nominatim mock to its port once.
//
// Each integration file registers its own `describe` block — we just need to
// import them so they get collected before node:test starts the run loop.

import { before, after } from 'node:test';
import { setupTestDb } from './helpers/setup.js';
import { startMock, stopMock } from './helpers/nominatim-mock.js';
import { closePool } from './helpers/app.js';

before(async () => {
  await startMock();
  await setupTestDb();
}, { timeout: 120_000 });

after(async () => {
  await closePool();
  await stopMock();
});

await import('./integration/health.test.js');
await import('./integration/auth.test.js');
await import('./integration/entreprises.test.js');
await import('./integration/lieux.test.js');
await import('./integration/produits.test.js');
await import('./integration/commandes.test.js');
await import('./integration/paiement.test.js');
await import('./integration/geo.test.js');
await import('./integration/avis.test.js');
await import('./integration/favoris.test.js');
await import('./integration/liste-courses.test.js');
await import('./integration/alertes.test.js');
await import('./integration/admin.test.js');
