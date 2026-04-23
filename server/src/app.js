import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { logger } from './logger.js';
import { pool } from './db/pool.js';
import { errorHandler, notFound } from './middlewares/error.js';
import authRouter from './modules/auth/router.js';
import entreprisesRouter from './modules/catalogue/entreprises.js';
import lieuxRouter from './modules/catalogue/lieux.js';
import produitsRouter from './modules/catalogue/produits.js';
import imagesRouter from './modules/catalogue/images.js';
import commandesRouter from './modules/commandes/router.js';
import paiementRouter from './modules/paiement/router.js';
import geoRouter from './modules/geo/router.js';
import favorisRouter from './modules/favoris/router.js';
import listeCoursesRouter from './modules/liste-courses/router.js';
import alertesRouter from './modules/alertes/router.js';
import adminRouter from './modules/admin/router.js';

const PgStore = connectPgSimple(session);

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: false, limit: '200kb' }));

  app.use(
    session({
      store: new PgStore({ pool, tableName: 'session', createTableIfMissing: false }),
      name: config.SESSION_COOKIE_NAME,
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProd,
        maxAge: config.SESSION_MAX_AGE_MS,
      },
    }),
  );

  app.get('/api/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', db: 'up', uptime_s: Math.round(process.uptime()) });
    } catch (err) {
      req.log.error({ err }, 'Healthcheck DB failed');
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/entreprises', entreprisesRouter);
  app.use('/api/lieux-de-vente', lieuxRouter);
  app.use('/api/produits', produitsRouter);
  app.use('/api/images', imagesRouter);
  app.use('/api/commandes', commandesRouter);
  app.use('/api/paiements', paiementRouter);
  app.use('/api/geo', geoRouter);
  app.use('/api/favoris', favorisRouter);
  app.use('/api/liste-courses', listeCoursesRouter);
  app.use('/api/alertes', alertesRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
