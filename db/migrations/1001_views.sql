-- ─────────────────────────────────────────────────────────────────────────────
-- gumes marketplace — migration : vues SQL & fonctions
-- Voir docs/DL1-07-vues-sql.md pour les intentions fonctionnelles.
-- ─────────────────────────────────────────────────────────────────────────────

-- Up Migration

-- ══════════════════════════════════════════════════════════════════════════
-- 7.1 v_produits_disponibles
-- ══════════════════════════════════════════════════════════════════════════
CREATE VIEW v_produits_disponibles AS
SELECT
  p.id, p.nom, p.description, p.nature, p.bio,
  p.prix_cents, p.stock, p.shippable,
  e.id                       AS entreprise_id,
  e.nom                      AS entreprise_nom,
  (pp.nom || ' ' || pp.prenom) AS producteur_nom,
  p.est_saisonnier
FROM produit p
JOIN entreprise e          ON e.id = p.entreprise_id
JOIN profil_producteur pp  ON pp.user_id = e.owner_id
JOIN utilisateur u         ON u.id = e.owner_id
WHERE p.visibilite = 'visible'
  AND p.stock > 0
  AND u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM produit_saison ps
    WHERE ps.produit_id = p.id
      AND NOT (
        CASE
          WHEN ps.mois_debut <= ps.mois_fin
            THEN EXTRACT(MONTH FROM NOW())::INT BETWEEN ps.mois_debut AND ps.mois_fin
          ELSE EXTRACT(MONTH FROM NOW())::INT >= ps.mois_debut
            OR EXTRACT(MONTH FROM NOW())::INT <= ps.mois_fin
        END
      )
  );

-- ══════════════════════════════════════════════════════════════════════════
-- 7.2 v_commandes_detaillees
-- ══════════════════════════════════════════════════════════════════════════
CREATE VIEW v_commandes_detaillees AS
SELECT
  c.id, c.client_id, c.statut, c.mode_livraison,
  c.total_produits_cents, c.frais_port_cents, c.total_ttc_cents,
  c.date_commande,
  (SELECT COUNT(*)::INT    FROM ligne_commande lc WHERE lc.commande_id = c.id) AS nb_articles,
  (SELECT COALESCE(SUM(lc.quantite),0)::INT FROM ligne_commande lc WHERE lc.commande_id = c.id) AS qte_totale,
  pay.statut  AS paiement_statut,
  pay.methode AS paiement_methode,
  COALESCE(lv.adresse, pr.adresse, hd.adresse) AS livraison_adresse,
  COALESCE(lv.geom, pr.geom, hd.geom)          AS livraison_geom
FROM commande c
LEFT JOIN paiement               pay ON pay.commande_id = c.id
LEFT JOIN commande_pickup_store  cps ON cps.commande_id = c.id
LEFT JOIN lieu_de_vente           lv ON lv.id = cps.lieu_id
LEFT JOIN commande_pickup_relay  cpr ON cpr.commande_id = c.id
LEFT JOIN point_relais             pr ON pr.id = cpr.relais_id
LEFT JOIN commande_home_delivery  hd ON hd.commande_id = c.id;

-- ══════════════════════════════════════════════════════════════════════════
-- 7.3 v_historique_client
-- ══════════════════════════════════════════════════════════════════════════
CREATE VIEW v_historique_client AS
SELECT
  c.client_id,
  c.id           AS commande_id,
  c.date_commande,
  c.statut,
  c.mode_livraison,
  c.total_ttc_cents,
  STRING_AGG(p.nom, ', ' ORDER BY p.nom) AS produits_apercu
FROM commande c
JOIN ligne_commande lc ON lc.commande_id = c.id
JOIN produit p         ON p.id = lc.produit_id
GROUP BY c.id;

-- ══════════════════════════════════════════════════════════════════════════
-- 7.4 v_stats_producteur
-- ══════════════════════════════════════════════════════════════════════════
CREATE VIEW v_stats_producteur AS
SELECT
  e.owner_id                              AS producteur_id,
  e.id                                    AS entreprise_id,
  e.nom                                   AS entreprise_nom,
  COUNT(DISTINCT p.id)                    AS nb_produits,
  COUNT(DISTINCT p.id) FILTER (WHERE p.stock < 5) AS nb_stock_critique,
  COUNT(DISTINCT c.id) FILTER (WHERE c.statut = 'pending')   AS nb_commandes_a_traiter,
  COUNT(DISTINCT c.id) FILTER (WHERE c.statut = 'preparing') AS nb_commandes_en_prep,
  COALESCE(SUM(lc.quantite * lc.prix_unitaire_cents)
           FILTER (WHERE DATE_TRUNC('month', c.date_commande) = DATE_TRUNC('month', NOW())
                   AND c.statut NOT IN ('refused','cancelled')), 0) AS ca_mois_cents
FROM entreprise e
LEFT JOIN produit p         ON p.entreprise_id = e.id
LEFT JOIN ligne_commande lc ON lc.produit_id   = p.id
LEFT JOIN commande c        ON c.id = lc.commande_id
GROUP BY e.id, e.owner_id, e.nom;

-- ══════════════════════════════════════════════════════════════════════════
-- 7.5 v_lieux_ouverts_maintenant
-- ══════════════════════════════════════════════════════════════════════════
CREATE VIEW v_lieux_ouverts_maintenant AS
SELECT DISTINCT
  lv.id, lv.nom, lv.adresse, lv.lat, lv.lon, lv.geom,
  e.id  AS entreprise_id,
  e.nom AS entreprise_nom
FROM lieu_de_vente lv
JOIN entreprise e  ON e.id = lv.entreprise_id
JOIN horaire h     ON h.lieu_id = lv.id
WHERE lv.actif = TRUE
  AND h.jour_semaine = (EXTRACT(ISODOW FROM NOW())::INT - 1)
  AND LOCALTIME BETWEEN h.heure_debut AND h.heure_fin;

-- ══════════════════════════════════════════════════════════════════════════
-- 7.6 v_audit_recent
-- ══════════════════════════════════════════════════════════════════════════
CREATE VIEW v_audit_recent AS
SELECT
  al.id, al.created_at, al.action,
  al.target_type, al.target_id,
  COALESCE(u.email::TEXT, '(compte supprimé)') AS actor_email,
  al.ip, al.payload
FROM audit_log al
LEFT JOIN utilisateur u ON u.id = al.actor_id
ORDER BY al.id DESC
LIMIT 1000;

-- ══════════════════════════════════════════════════════════════════════════
-- 7.7 f_points_relais_proches(geog, rayon, limite) — fonction KNN
-- ══════════════════════════════════════════════════════════════════════════
CREATE FUNCTION f_points_relais_proches(
  client_geom geography,
  rayon_m     INTEGER DEFAULT 20000,
  limite      INTEGER DEFAULT 10
) RETURNS TABLE (
  id          UUID,
  nom         TEXT,
  adresse     TEXT,
  distance_m  DOUBLE PRECISION
) LANGUAGE SQL STABLE AS $$
  SELECT pr.id, pr.nom, pr.adresse,
         ST_Distance(pr.geom, client_geom) AS distance_m
  FROM point_relais pr
  WHERE pr.actif = TRUE
    AND ST_DWithin(pr.geom, client_geom, rayon_m)
  ORDER BY pr.geom <-> client_geom
  LIMIT limite;
$$;


-- Down Migration

DROP FUNCTION IF EXISTS f_points_relais_proches(geography, INTEGER, INTEGER);
DROP VIEW IF EXISTS v_audit_recent;
DROP VIEW IF EXISTS v_lieux_ouverts_maintenant;
DROP VIEW IF EXISTS v_stats_producteur;
DROP VIEW IF EXISTS v_historique_client;
DROP VIEW IF EXISTS v_commandes_detaillees;
DROP VIEW IF EXISTS v_produits_disponibles;
