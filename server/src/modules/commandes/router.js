import express from 'express';
import { query } from '../../db/pool.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { HttpError } from '../../middlewares/error.js';
import { quoteSchema, createCommandeSchema, patchStatutSchema } from './schemas.js';
import { computeQuote, createCommande } from './service.js';

const router = express.Router();

// Quote — calcul modes disponibles + frais de port
router.post('/quote', requireAuth, async (req, res, next) => {
  try {
    const { lignes } = quoteSchema.parse(req.body);
    const quote = await computeQuote(lignes);
    res.json(quote);
  } catch (err) { next(err); }
});

// Création de commande
router.post('/', requireRole('user', 'admin'), async (req, res, next) => {
  try {
    const body = createCommandeSchema.parse(req.body);
    const commande = await createCommande(req.session, body);
    res.status(201).json({ commande });
  } catch (err) { next(err); }
});

// Historique — client voit ses commandes, seller voit celles sur ses produits
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { role, id } = req.session.user;
    if (role === 'admin') {
      const { rows } = await query(
        `SELECT * FROM v_commandes_detaillees ORDER BY date_commande DESC LIMIT 200`,
      );
      return res.json({ data: rows });
    }
    if (role === 'seller') {
      const { rows } = await query(
        `SELECT DISTINCT vcd.*
         FROM v_commandes_detaillees vcd
         JOIN ligne_commande lc ON lc.commande_id = vcd.id
         JOIN produit p ON p.id = lc.produit_id
         JOIN entreprise e ON e.id = p.entreprise_id
         WHERE e.owner_id = $1
         ORDER BY vcd.date_commande DESC`,
        [id],
      );
      return res.json({ data: rows });
    }
    // client
    const { rows } = await query(
      `SELECT * FROM v_historique_client WHERE client_id = $1 ORDER BY date_commande DESC`,
      [id],
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.*, pay.statut AS paiement_statut, pay.methode AS paiement_methode
       FROM commande c LEFT JOIN paiement pay ON pay.commande_id = c.id
       WHERE c.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) throw new HttpError(404, 'not_found', 'Commande introuvable.');
    const c = rows[0];

    const user = req.session.user;
    if (user.role === 'user' && c.client_id !== user.id) {
      throw new HttpError(403, 'forbidden', "Cette commande n'est pas la vôtre.");
    }
    if (user.role === 'seller' && c.client_id !== user.id) {
      const { rowCount } = await query(
        `SELECT 1 FROM ligne_commande lc
         JOIN produit p ON p.id = lc.produit_id
         JOIN entreprise e ON e.id = p.entreprise_id
         WHERE lc.commande_id = $1 AND e.owner_id = $2 LIMIT 1`,
        [c.id, user.id],
      );
      if (rowCount === 0) throw new HttpError(403, 'forbidden', 'Commande non liée à vos produits.');
    }

    const lignes = await query(
      `SELECT lc.produit_id, p.nom, lc.quantite, lc.prix_unitaire_cents
       FROM ligne_commande lc JOIN produit p ON p.id = lc.produit_id
       WHERE lc.commande_id = $1`,
      [c.id],
    );
    res.json({ commande: { ...c, lignes: lignes.rows } });
  } catch (err) { next(err); }
});

// Annulation par le client propriétaire (ou admin) tant que non livrée
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, client_id, statut
       FROM commande
       WHERE id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) throw new HttpError(404, 'not_found', 'Commande introuvable.');

    const commande = rows[0];
    const user = req.session.user;
    if (user.role !== 'admin' && commande.client_id !== user.id) {
      throw new HttpError(403, 'forbidden', "Cette commande n'est pas la vôtre.");
    }
    if (commande.statut === 'delivered') {
      throw new HttpError(409, 'cannot_cancel_delivered', 'Une commande livrée ne peut plus être annulée.');
    }
    if (commande.statut === 'cancelled') {
      throw new HttpError(409, 'already_cancelled', 'Cette commande est déjà annulée.');
    }
    if (commande.statut === 'refused') {
      throw new HttpError(409, 'already_refused', 'Cette commande est déjà refusée.');
    }

    const updated = await query(
      `UPDATE commande
       SET statut = 'cancelled'
       WHERE id = $1
       RETURNING id, statut`,
      [req.params.id],
    );
    res.json({ commande: updated.rows[0] });
  } catch (err) { next(err); }
});

// Changement de statut (seller/admin sur une commande de leurs produits)
router.patch('/:id', requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const { statut } = patchStatutSchema.parse(req.body);
    if (req.session.user.role === 'seller') {
      const { rowCount } = await query(
        `SELECT 1 FROM ligne_commande lc
         JOIN produit p ON p.id = lc.produit_id
         JOIN entreprise e ON e.id = p.entreprise_id
         WHERE lc.commande_id = $1 AND e.owner_id = $2 LIMIT 1`,
        [req.params.id, req.session.user.id],
      );
      if (rowCount === 0) throw new HttpError(403, 'forbidden', 'Commande non liée à vos produits.');
    }
    const { rows } = await query(
      `UPDATE commande SET statut = $2 WHERE id = $1 RETURNING id, statut`,
      [req.params.id, statut],
    );
    if (rows.length === 0) throw new HttpError(404, 'not_found', 'Commande introuvable.');
    res.json({ commande: rows[0] });
  } catch (err) { next(err); }
});

export default router;
