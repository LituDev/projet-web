import argon2 from 'argon2';
import { withTransaction, query } from '../../db/pool.js';
import { HttpError } from '../../middlewares/error.js';
import { geocodeAddress } from '../geocode/service.js';
import { logger } from '../../logger.js';

const ARGON2_OPTS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export async function registerUser(input) {
  const existing = await query(
    'SELECT id FROM utilisateur WHERE email = $1 AND deleted_at IS NULL',
    [input.email],
  );
  if (existing.rowCount > 0) {
    throw new HttpError(409, 'email_taken', 'Cet email est déjà utilisé.');
  }

  const passwordHash = await argon2.hash(input.password, ARGON2_OPTS);

  return withTransaction(async (client) => {
    const userResult = await client.query(
      `INSERT INTO utilisateur (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, role, created_at`,
      [input.email, passwordHash, input.role],
    );
    const user = userResult.rows[0];

    if (input.role === 'user') {
      await client.query(
        `INSERT INTO profil_client (user_id, nom, prenom, tel, adresse)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, input.nom, input.prenom, input.tel, input.adresse],
      );
      // Géocodage best-effort : on n'échoue pas l'inscription si Nominatim ne répond pas.
      try {
        const coords = await geocodeAddress(input.adresse);
        if (coords) {
          await client.query(
            `INSERT INTO adresse_geocodee (user_id, lat, lon, geom)
             VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography)`,
            [user.id, coords.lat, coords.lon],
          );
        } else {
          logger.info({ userId: user.id }, 'Géocodage indisponible pour cette adresse');
        }
      } catch (err) {
        logger.warn({ err: err.message, userId: user.id }, 'Géocodage : insertion échouée');
      }
    } else {
      await client.query(
        `INSERT INTO profil_producteur (user_id, nom, prenom, tel)
         VALUES ($1, $2, $3, $4)`,
        [user.id, input.nom, input.prenom, input.tel],
      );
    }

    return user;
  });
}

export async function authenticate(email, password) {
  const result = await query(
    `SELECT id, email, password_hash, role
     FROM utilisateur
     WHERE email = $1 AND deleted_at IS NULL`,
    [email],
  );
  if (result.rowCount === 0) {
    throw new HttpError(401, 'invalid_credentials', 'Email ou mot de passe incorrect.');
  }
  const row = result.rows[0];
  const ok = await argon2.verify(row.password_hash, password);
  if (!ok) {
    throw new HttpError(401, 'invalid_credentials', 'Email ou mot de passe incorrect.');
  }
  await query('UPDATE utilisateur SET last_login_at = NOW() WHERE id = $1', [row.id]);
  return { id: row.id, email: row.email, role: row.role };
}

export async function unregisterSelf(userId) {
  // Soft-delete : on garde les lignes liées (commandes, entreprises, audit),
  // mais on rend le compte inutilisable et on anonymise l'email.
  const { rows } = await query(
    `UPDATE utilisateur
     SET deleted_at = NOW(),
         email = ('deleted-' || id::text || '@anon')::citext
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [userId],
  );
  if (rows.length === 0) {
    throw new HttpError(404, 'not_found', 'Compte introuvable ou déjà supprimé.');
  }
  await query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id)
     VALUES ($1::uuid, 'user.self_unregister', 'utilisateur', $1::text)`,
    [userId],
  );
}

export async function getCurrentUser(userId) {
  const result = await query(
    `SELECT id, email, role, created_at, last_login_at
     FROM utilisateur
     WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  return result.rows[0] ?? null;
}
