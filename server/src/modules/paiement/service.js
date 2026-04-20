import { withTransaction, query } from '../../db/pool.js';
import { HttpError } from '../../middlewares/error.js';
import { config } from '../../config.js';

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Règles de simulation
// - numéro se terminant par 0000 → declined
// - numéro se terminant par 0001 → timeout/error
// - sinon → success
function simulateCardOutcome(numero) {
  if (numero.endsWith('0000')) return 'declined';
  if (numero.endsWith('0001')) return 'error';
  return 'success';
}

export async function processPaiement({ session, body, idempotencyKey }) {
  // Déduplication via Idempotency-Key — on renvoie le paiement existant
  const existing = await query(
    'SELECT id, commande_id, montant_cents, methode, statut, created_at FROM paiement WHERE idempotency_key = $1',
    [idempotencyKey],
  );
  if (existing.rows.length > 0) {
    return { paiement: existing.rows[0], reused: true };
  }

  // Vérifier que la commande appartient au client et charger le montant
  const cmd = await query(
    'SELECT id, client_id, total_ttc_cents, mode_livraison FROM commande WHERE id = $1',
    [body.commande_id],
  );
  if (cmd.rows.length === 0) throw new HttpError(404, 'not_found', 'Commande introuvable.');
  const commande = cmd.rows[0];
  if (session.user.role !== 'admin' && commande.client_id !== session.user.id) {
    throw new HttpError(403, 'forbidden', "Cette commande n'est pas la vôtre.");
  }
  // Cohérence méthode ↔ mode livraison
  if (body.methode === 'on_pickup' && commande.mode_livraison !== 'pickup_store') {
    throw new HttpError(409, 'methode_invalid', 'Paiement sur place réservé au retrait en lieu de vente.');
  }
  if (body.methode === 'on_delivery' && commande.mode_livraison !== 'home_delivery') {
    throw new HttpError(409, 'methode_invalid', 'Paiement à la livraison réservé à la livraison à domicile.');
  }
  // Paiement déjà existant pour cette commande ?
  const dup = await query('SELECT id FROM paiement WHERE commande_id = $1', [body.commande_id]);
  if (dup.rows.length > 0) {
    throw new HttpError(409, 'already_paid', 'Un paiement existe déjà pour cette commande.');
  }

  // Simulation
  let statut;
  let last4;
  if (body.methode === 'card_fake') {
    const outcome = simulateCardOutcome(body.numero_carte);
    last4 = body.numero_carte.slice(-4);
    if (outcome === 'error') {
      await wait(config.PAIEMENT_DELAY_ERROR_MS);
      statut = 'error';
    } else {
      await wait(config.PAIEMENT_DELAY_SUCCESS_MS);
      statut = outcome === 'declined' ? 'declined' : 'success';
    }
  } else {
    // on_pickup / on_delivery : on marque pending, sera validé à l'encaissement
    statut = 'pending';
  }

  const paiement = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO paiement (commande_id, montant_cents, methode, statut, idempotency_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, commande_id, montant_cents, methode, statut, created_at`,
      [commande.id, commande.total_ttc_cents, body.methode, statut, idempotencyKey],
    );
    if (last4) {
      await client.query(
        'INSERT INTO paiement_carte (paiement_id, last4) VALUES ($1, $2)',
        [rows[0].id, last4],
      );
    }
    // Si le paiement réussit immédiatement, on fait passer la commande en 'accepted'
    if (statut === 'success') {
      await client.query('UPDATE commande SET statut = $2 WHERE id = $1', [commande.id, 'accepted']);
    }
    return rows[0];
  });

  return { paiement, reused: false };
}
