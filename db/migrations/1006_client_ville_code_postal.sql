-- Profil client: stocker explicitement ville et code postal
ALTER TABLE profil_client
  ADD COLUMN IF NOT EXISTS ville TEXT,
  ADD COLUMN IF NOT EXISTS code_postal TEXT CHECK (code_postal IS NULL OR code_postal ~ '^\d{5}$');
