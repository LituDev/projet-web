-- Up Migration

ALTER TABLE favori ADD COLUMN produit_id UUID;

UPDATE favori f
SET produit_id = (
  SELECT p.id
  FROM produit p
  WHERE p.entreprise_id = f.entreprise_id
  ORDER BY p.nom, p.id
  LIMIT 1
)
WHERE f.produit_id IS NULL;

DELETE FROM favori WHERE produit_id IS NULL;

ALTER TABLE favori DROP CONSTRAINT favori_pkey;
ALTER TABLE favori DROP CONSTRAINT favori_entreprise_id_fkey;
ALTER TABLE favori DROP COLUMN entreprise_id;

ALTER TABLE favori
  ALTER COLUMN produit_id SET NOT NULL,
  ADD CONSTRAINT favori_produit_id_fkey FOREIGN KEY (produit_id) REFERENCES produit(id) ON DELETE CASCADE,
  ADD PRIMARY KEY (client_id, produit_id);

-- Down Migration

ALTER TABLE favori ADD COLUMN entreprise_id UUID;

UPDATE favori f
SET entreprise_id = p.entreprise_id
FROM produit p
WHERE p.id = f.produit_id;

DELETE FROM favori WHERE entreprise_id IS NULL;

ALTER TABLE favori DROP CONSTRAINT favori_pkey;
ALTER TABLE favori DROP CONSTRAINT favori_produit_id_fkey;
ALTER TABLE favori DROP COLUMN produit_id;

ALTER TABLE favori
  ALTER COLUMN entreprise_id SET NOT NULL,
  ADD CONSTRAINT favori_entreprise_id_fkey FOREIGN KEY (entreprise_id) REFERENCES entreprise(id) ON DELETE CASCADE,
  ADD PRIMARY KEY (client_id, entreprise_id);
