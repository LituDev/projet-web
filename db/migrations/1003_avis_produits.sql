-- Up Migration

CREATE TABLE avis_produit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id  UUID NOT NULL REFERENCES produit(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  note        SMALLINT NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire TEXT NOT NULL CHECK (char_length(trim(commentaire)) BETWEEN 3 AND 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (produit_id, client_id)
);

CREATE INDEX avis_produit_produit_idx ON avis_produit (produit_id, created_at DESC);
CREATE INDEX avis_produit_client_idx ON avis_produit (client_id, created_at DESC);

CREATE TRIGGER avis_produit_touch_updated
  BEFORE UPDATE ON avis_produit
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Down Migration

DROP TABLE IF EXISTS avis_produit;
