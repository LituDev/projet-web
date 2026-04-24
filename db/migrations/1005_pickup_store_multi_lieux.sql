-- Permettre plusieurs lieux de retrait par commande (pickup multi-producteur)
ALTER TABLE commande_pickup_store
  DROP CONSTRAINT commande_pickup_store_pkey;

ALTER TABLE commande_pickup_store
  ADD PRIMARY KEY (commande_id, lieu_id);

-- Trigger mis à jour : plusieurs lignes pickup_store autorisées par commande
CREATE OR REPLACE FUNCTION verifier_livraison_unique() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_nb  INT;
  v_mode TEXT;
BEGIN
  SELECT mode_livraison INTO v_mode FROM commande WHERE id = NEW.commande_id;

  -- Cohérence mode ↔ sous-table
  IF (TG_TABLE_NAME = 'commande_pickup_store'  AND v_mode <> 'pickup_store')
  OR (TG_TABLE_NAME = 'commande_pickup_relay'  AND v_mode <> 'pickup_relay')
  OR (TG_TABLE_NAME = 'commande_home_delivery' AND v_mode <> 'home_delivery') THEN
    RAISE EXCEPTION 'Commande % : mode=% incohérent avec %', NEW.commande_id, v_mode, TG_TABLE_NAME;
  END IF;

  IF TG_TABLE_NAME = 'commande_pickup_store' THEN
    -- Plusieurs lieux autorisés pour pickup_store ; vérifier juste qu'aucune autre sous-table n'est utilisée
    SELECT (SELECT COUNT(*) FROM commande_pickup_relay  WHERE commande_id = NEW.commande_id)
         + (SELECT COUNT(*) FROM commande_home_delivery WHERE commande_id = NEW.commande_id)
    INTO v_nb;
    IF v_nb > 0 THEN
      RAISE EXCEPTION 'Commande % : pickup_store ne peut pas coexister avec un autre mode', NEW.commande_id;
    END IF;
  ELSE
    -- Pour relay et home_delivery : une seule ligne autorisée en tout
    SELECT (SELECT COUNT(*) FROM commande_pickup_store  WHERE commande_id = NEW.commande_id)
         + (SELECT COUNT(*) FROM commande_pickup_relay  WHERE commande_id = NEW.commande_id)
         + (SELECT COUNT(*) FROM commande_home_delivery WHERE commande_id = NEW.commande_id)
    INTO v_nb;
    IF v_nb > 1 THEN
      RAISE EXCEPTION 'Commande % : plus d''une sous-table de livraison peuplée', NEW.commande_id;
    END IF;
  END IF;

  RETURN NEW;
END $$;
