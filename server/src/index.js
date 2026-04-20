import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { pool } from './db/pool.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info(`gumes-server prêt sur ${config.PUBLIC_URL} (env=${config.NODE_ENV})`);
});

function shutdown(signal) {
  logger.info(`Signal reçu ${signal}, arrêt en cours…`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
