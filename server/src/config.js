import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

// Charge le .env situé à la racine du monorepo (deux niveaux au-dessus de src/).
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '../../.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_URL: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET doit faire au moins 32 caractères'),
  SESSION_COOKIE_NAME: z.string().default('gumes.sid'),
  SESSION_MAX_AGE_MS: z.coerce.number().int().positive().default(604_800_000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  NOMINATIM_USER_AGENT: z.string().default('gumes-marketplace/1.0'),
  NOMINATIM_BASE_URL: z.url().default('https://nominatim.openstreetmap.org'),
  RATELIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
  RATELIMIT_LOGIN_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  PAIEMENT_DELAY_SUCCESS_MS: z.coerce.number().int().nonnegative().default(1500),
  PAIEMENT_DELAY_ERROR_MS: z.coerce.number().int().nonnegative().default(5000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuration invalide :', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isDev: parsed.data.NODE_ENV === 'development',
};
