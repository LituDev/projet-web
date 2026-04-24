-- Up Migration

ALTER TABLE produit ADD COLUMN image_filename TEXT;

-- Down Migration

ALTER TABLE produit DROP COLUMN image_filename;
