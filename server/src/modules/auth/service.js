import argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { withTransaction, query } from '../../db/pool.js';
import { HttpError } from '../../middlewares/error.js';
import { geocodeAddress } from '../geocode/service.js';
import { logger } from '../../logger.js';
import { sendPasswordResetEmail } from './email.js';

const ARGON2_OPTS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

function buildClientAdresse(input) {
  const adresseLibre = input.adresse?.trim();
  const ville = input.ville?.trim();
  const codePostal = input.code_postal?.trim();
  const villeCp = [codePostal, ville].filter(Boolean).join(' ').trim();
  if (adresseLibre && villeCp) return `${adresseLibre}, ${villeCp}`;
  if (adresseLibre) return adresseLibre;
  return villeCp;
}

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
      const adresse = buildClientAdresse(input);
      await client.query(
        `INSERT INTO profil_client (user_id, nom, prenom, tel, adresse, ville, code_postal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [user.id, input.nom, input.prenom, input.tel, adresse, input.ville?.trim() || null, input.code_postal?.trim() || null],
      );
      // Géocodage best-effort : on n'échoue pas l'inscription si Nominatim ne répond pas.
      if (adresse) {
        try {
          const coords = await geocodeAddress(adresse);
          if (coords) {
            await client.query(
              `INSERT INTO adresse_geocodee (user_id, lat, lon)
               VALUES ($1, $2, $3)`,
              [user.id, coords.lat, coords.lon],
            );
          } else {
            logger.info({ userId: user.id }, 'Géocodage indisponible pour cette adresse');
          }
        } catch (err) {
          logger.warn({ err: err.message, userId: user.id }, 'Géocodage : insertion échouée');
        }
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
    `SELECT u.id, u.email, u.password_hash, u.role,
            COALESCE(pc.prenom, pp.prenom) AS prenom
     FROM utilisateur u
     LEFT JOIN profil_client     pc ON pc.user_id = u.id
     LEFT JOIN profil_producteur pp ON pp.user_id = u.id
     WHERE u.email = $1 AND u.deleted_at IS NULL`,
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
  return { id: row.id, email: row.email, role: row.role, prenom: row.prenom };
}

export async function unregisterSelf(userId) {
  // Soft-delete : on garde les lignes liées (commandes, entreprises, audit),
  // mais on rend le compte inutilisable et on anonymise l'email.
  const { rows } = await query(
    `UPDATE utilisateur
     SET deleted_at = NOW(),
         email = 'deleted-' || id::text || '@anon'
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
    `SELECT u.id, u.email, u.role, u.created_at, u.last_login_at,
            COALESCE(pc.prenom, pp.prenom) AS prenom,
            COALESCE(pc.nom,    pp.nom)    AS nom,
            COALESCE(pc.tel,    pp.tel)    AS tel,
                 pc.adresse,
                 pc.ville,
                 pc.code_postal
     FROM utilisateur u
     LEFT JOIN profil_client     pc ON pc.user_id = u.id
     LEFT JOIN profil_producteur pp ON pp.user_id = u.id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function updateProfile(userId, input, role) {
  if (role === 'seller') {
    await query(
      `UPDATE profil_producteur SET prenom = $2, nom = $3, tel = $4 WHERE user_id = $1`,
      [userId, input.prenom, input.nom, input.tel],
    );
  } else {
    await query(
      `UPDATE profil_client
       SET prenom = $2,
           nom = $3,
           tel = $4,
           adresse = COALESCE($5, adresse),
           ville = COALESCE($6, ville),
           code_postal = COALESCE($7, code_postal)
       WHERE user_id = $1`,
      [
        userId,
        input.prenom,
        input.nom,
        input.tel,
        input.adresse ?? null,
        input.ville ?? null,
        input.code_postal ?? null,
      ],
    );
  }
}

export async function requestPasswordReset(email) {
  const result = await query(
    'SELECT id FROM utilisateur WHERE email = $1 AND deleted_at IS NULL',
    [email],
  );
  if (result.rowCount === 0) return; // ne pas révéler si l'email existe

  const userId = result.rows[0].id;
  const token = randomBytes(32).toString('hex'); // 64 chars hex

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE password_reset_token SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
    await client.query(
      `INSERT INTO password_reset_token (user_id, token) VALUES ($1, $2)`,
      [userId, token],
    );
  });

  const base = process.env.CLIENT_URL ?? 'http://localhost:5173';
  await sendPasswordResetEmail(email, `${base}/reset-password?token=${token}`);
}

export async function confirmPasswordReset(token, newPassword) {
  const result = await query(
    `SELECT user_id FROM password_reset_token
     WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [token],
  );
  if (result.rowCount === 0) {
    throw new HttpError(400, 'invalid_token', 'Lien invalide ou expiré.');
  }
  const { user_id } = result.rows[0];
  const passwordHash = await argon2.hash(newPassword, ARGON2_OPTS);

  await withTransaction(async (client) => {
    await client.query(
      'UPDATE utilisateur SET password_hash = $1 WHERE id = $2',
      [passwordHash, user_id],
    );
    await client.query(
      'UPDATE password_reset_token SET used_at = NOW() WHERE token = $1',
      [token],
    );
  });
}
