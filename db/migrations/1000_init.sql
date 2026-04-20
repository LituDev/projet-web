-- ─────────────────────────────────────────────────────────────────────────────
-- gumes marketplace — migration initiale
-- Construit le schéma métier décrit dans docs/DL1-05-06-mcd-schema-logique.md
-- Compatible node-pg-migrate (markers `-- Up Migration` / `-- Down Migration`).
-- Les extensions postgis, pgcrypto, citext sont supposées actives (voir db/init/01-extensions.sql).
-- ─────────────────────────────────────────────────────────────────────────────

-- Up Migration

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Authentification & profils
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE utilisateur (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          CITEXT      NOT NULL UNIQUE,
  password_hash  TEXT        NOT NULL,
  role           TEXT        NOT NULL CHECK (role IN ('admin','seller','user')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at  TIMESTAMPTZ,
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX utilisateur_role_idx ON utilisateur (role) WHERE deleted_at IS NULL;

CREATE TABLE profil_client (
  user_id   UUID PRIMARY KEY REFERENCES utilisateur(id) ON DELETE CASCADE,
  nom       TEXT NOT NULL,
  prenom    TEXT NOT NULL,
  tel       TEXT NOT NULL CHECK (tel ~ '^\+?[0-9 .-]{10,20}$'),
  adresse   TEXT NOT NULL
);

CREATE TABLE adresse_geocodee (
  user_id      UUID PRIMARY KEY REFERENCES profil_client(user_id) ON DELETE CASCADE,
  lat          DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90  AND 90),
  lon          DOUBLE PRECISION NOT NULL CHECK (lon BETWEEN -180 AND 180),
  geom         geography(Point, 4326) NOT NULL,
  geocoded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX adresse_geocodee_geom_idx ON adresse_geocodee USING GIST (geom);

CREATE TABLE profil_producteur (
  user_id  UUID PRIMARY KEY REFERENCES utilisateur(id) ON DELETE CASCADE,
  nom      TEXT NOT NULL,
  prenom   TEXT NOT NULL,
  tel      TEXT NOT NULL CHECK (tel ~ '^\+?[0-9 .-]{10,20}$')
);

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Entreprises, lieux de vente, horaires, points relais
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE entreprise (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES utilisateur(id) ON DELETE RESTRICT,
  nom          TEXT NOT NULL,
  siret        TEXT NOT NULL UNIQUE CHECK (siret ~ '^[0-9]{14}$'),
  description  TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX entreprise_owner_idx ON entreprise (owner_id);

CREATE TABLE lieu_de_vente (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id  UUID NOT NULL REFERENCES entreprise(id) ON DELETE CASCADE,
  nom            TEXT NOT NULL,
  adresse        TEXT NOT NULL,
  lat            DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90  AND 90),
  lon            DOUBLE PRECISION NOT NULL CHECK (lon BETWEEN -180 AND 180),
  geom           geography(Point, 4326) NOT NULL,
  actif          BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (entreprise_id, id)   -- permet une FK composite depuis produit_lieu_vente (RG-07)
);
CREATE INDEX lieu_de_vente_geom_idx       ON lieu_de_vente USING GIST (geom);
CREATE INDEX lieu_de_vente_entreprise_idx ON lieu_de_vente (entreprise_id);

CREATE TABLE horaire (
  id             SERIAL PRIMARY KEY,
  lieu_id        UUID NOT NULL REFERENCES lieu_de_vente(id) ON DELETE CASCADE,
  jour_semaine   SMALLINT NOT NULL CHECK (jour_semaine BETWEEN 0 AND 6),   -- 0=lundi
  heure_debut    TIME NOT NULL,
  heure_fin      TIME NOT NULL,
  CHECK (heure_debut < heure_fin)
);
CREATE INDEX horaire_lieu_jour_idx ON horaire (lieu_id, jour_semaine);

CREATE TABLE point_relais (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom     TEXT NOT NULL,
  adresse TEXT NOT NULL,
  lat     DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon     DOUBLE PRECISION NOT NULL CHECK (lon BETWEEN -180 AND 180),
  geom    geography(Point, 4326) NOT NULL,
  actif   BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX point_relais_geom_idx ON point_relais USING GIST (geom);

CREATE TABLE horaire_point_relais (
  id             SERIAL PRIMARY KEY,
  relais_id      UUID NOT NULL REFERENCES point_relais(id) ON DELETE CASCADE,
  jour_semaine   SMALLINT NOT NULL CHECK (jour_semaine BETWEEN 0 AND 6),
  heure_debut    TIME NOT NULL,
  heure_fin      TIME NOT NULL,
  CHECK (heure_debut < heure_fin)
);
CREATE INDEX horaire_point_relais_idx ON horaire_point_relais (relais_id, jour_semaine);

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Catalogue produits
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE produit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id   UUID NOT NULL REFERENCES entreprise(id) ON DELETE CASCADE,
  nom             TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  nature          TEXT NOT NULL CHECK (nature IN ('legume','fruit','viande','fromage','epicerie','boisson','autre')),
  bio             BOOLEAN NOT NULL,
  prix_cents      INTEGER NOT NULL CHECK (prix_cents >= 0),
  stock           INTEGER NOT NULL CHECK (stock >= 0),
  shippable       BOOLEAN NOT NULL DEFAULT FALSE,
  visibilite      TEXT NOT NULL CHECK (visibilite IN ('visible','hidden','out_of_stock')) DEFAULT 'visible',
  est_saisonnier  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, entreprise_id)   -- permet la FK composite depuis produit_lieu_vente (RG-07)
);
CREATE INDEX produit_entreprise_idx ON produit (entreprise_id);
CREATE INDEX produit_visibilite_idx ON produit (visibilite) WHERE visibilite = 'visible';

CREATE TABLE produit_saison (
  produit_id   UUID PRIMARY KEY REFERENCES produit(id) ON DELETE CASCADE,
  mois_debut   SMALLINT NOT NULL CHECK (mois_debut BETWEEN 1 AND 12),
  mois_fin     SMALLINT NOT NULL CHECK (mois_fin   BETWEEN 1 AND 12)
);

CREATE TABLE produit_lieu_vente (
  produit_id    UUID NOT NULL,
  entreprise_id UUID NOT NULL,
  lieu_id       UUID NOT NULL,
  PRIMARY KEY (produit_id, lieu_id),
  FOREIGN KEY (produit_id, entreprise_id)
    REFERENCES produit (id, entreprise_id) ON DELETE CASCADE,
  FOREIGN KEY (entreprise_id, lieu_id)
    REFERENCES lieu_de_vente (entreprise_id, id) ON DELETE CASCADE
);
CREATE INDEX produit_lieu_vente_lieu_idx ON produit_lieu_vente (lieu_id);

-- ══════════════════════════════════════════════════════════════════════════
-- 4. Commandes (éclatement par mode de livraison, pas de NULL)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE commande (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES utilisateur(id) ON DELETE RESTRICT,
  statut                TEXT NOT NULL CHECK (statut IN
                          ('pending','accepted','refused','preparing',
                           'ready_for_pickup','shipped','delivered','cancelled')),
  mode_livraison        TEXT NOT NULL CHECK (mode_livraison IN
                          ('pickup_store','pickup_relay','home_delivery')),
  total_produits_cents  INTEGER NOT NULL CHECK (total_produits_cents >= 0),
  frais_port_cents      INTEGER NOT NULL CHECK (frais_port_cents >= 0) DEFAULT 0,
  total_ttc_cents       INTEGER NOT NULL GENERATED ALWAYS AS
                          (total_produits_cents + frais_port_cents) STORED,
  date_commande         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX commande_client_date_idx ON commande (client_id, date_commande DESC);
CREATE INDEX commande_statut_actif_idx ON commande (statut)
  WHERE statut IN ('pending','accepted','preparing');

CREATE TABLE ligne_commande (
  id                    SERIAL PRIMARY KEY,
  commande_id           UUID NOT NULL REFERENCES commande(id) ON DELETE CASCADE,
  produit_id            UUID NOT NULL REFERENCES produit(id)  ON DELETE RESTRICT,
  quantite              INTEGER NOT NULL CHECK (quantite > 0),
  prix_unitaire_cents   INTEGER NOT NULL CHECK (prix_unitaire_cents >= 0),
  UNIQUE (commande_id, produit_id)
);

CREATE TABLE commande_pickup_store (
  commande_id  UUID PRIMARY KEY REFERENCES commande(id) ON DELETE CASCADE,
  lieu_id      UUID NOT NULL REFERENCES lieu_de_vente(id) ON DELETE RESTRICT
);

CREATE TABLE commande_pickup_relay (
  commande_id  UUID PRIMARY KEY REFERENCES commande(id) ON DELETE CASCADE,
  relais_id    UUID NOT NULL REFERENCES point_relais(id) ON DELETE RESTRICT
);

CREATE TABLE commande_home_delivery (
  commande_id  UUID PRIMARY KEY REFERENCES commande(id) ON DELETE CASCADE,
  adresse      TEXT NOT NULL,
  lat          DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon          DOUBLE PRECISION NOT NULL CHECK (lon BETWEEN -180 AND 180),
  geom         geography(Point, 4326) NOT NULL
);
CREATE INDEX commande_home_delivery_geom_idx ON commande_home_delivery USING GIST (geom);

-- ══════════════════════════════════════════════════════════════════════════
-- 5. Paiement (simulation)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE paiement (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id      UUID NOT NULL UNIQUE REFERENCES commande(id) ON DELETE RESTRICT,
  montant_cents    INTEGER NOT NULL CHECK (montant_cents >= 0),
  methode          TEXT NOT NULL CHECK (methode IN ('card_fake','on_pickup','on_delivery')),
  statut           TEXT NOT NULL CHECK (statut IN ('pending','success','declined','error','refunded')),
  idempotency_key  TEXT NOT NULL UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE paiement_carte (
  paiement_id  UUID PRIMARY KEY REFERENCES paiement(id) ON DELETE CASCADE,
  last4        CHAR(4) NOT NULL CHECK (last4 ~ '^[0-9]{4}$')
);

-- ══════════════════════════════════════════════════════════════════════════
-- 6. Favoris, liste de courses, alertes, audit
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE favori (
  client_id      UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  entreprise_id  UUID NOT NULL REFERENCES entreprise(id)  ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, entreprise_id)
);

CREATE TABLE liste_courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL DEFAULT 'Ma liste',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX liste_courses_client_idx ON liste_courses (client_id);

CREATE TABLE item_liste_courses (
  id          SERIAL PRIMARY KEY,
  liste_id    UUID NOT NULL REFERENCES liste_courses(id) ON DELETE CASCADE,
  produit_id  UUID NOT NULL REFERENCES produit(id)       ON DELETE CASCADE,
  quantite    INTEGER NOT NULL CHECK (quantite > 0) DEFAULT 1,
  UNIQUE (liste_id, produit_id)
);

CREATE TABLE alerte (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emetteur_id   UUID REFERENCES utilisateur(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN ('produit','commande','lieu_de_vente','autre')),
  cible_id      UUID,
  description   TEXT NOT NULL,
  statut        TEXT NOT NULL CHECK (statut IN ('open','in_progress','closed')) DEFAULT 'open',
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID REFERENCES utilisateur(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((statut = 'closed') = (resolved_at IS NOT NULL))
);
CREATE INDEX alerte_ouvertes_idx ON alerte (statut) WHERE statut <> 'closed';

CREATE TABLE audit_log (
  id           BIGSERIAL PRIMARY KEY,
  actor_id     UUID REFERENCES utilisateur(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip           INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_actor_idx  ON audit_log (actor_id, created_at DESC);
CREATE INDEX audit_action_idx ON audit_log (action, created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════
-- 7. Session (connect-pg-simple crée la table si absente, on la pose ici)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "session" (
  sid     VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess    JSON NOT NULL,
  expire  TIMESTAMP(6) NOT NULL
);
CREATE INDEX session_expire_idx ON "session" (expire);

-- ══════════════════════════════════════════════════════════════════════════
-- 8. Référentiels statiques
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE shipping_rate (
  mode                TEXT PRIMARY KEY CHECK (mode IN ('pickup_store','pickup_relay','home_delivery')),
  prix_cents          INTEGER NOT NULL CHECK (prix_cents >= 0),
  seuil_franco_cents  INTEGER NOT NULL DEFAULT 0,
  actif               BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO shipping_rate (mode, prix_cents, seuil_franco_cents) VALUES
  ('pickup_store',   0,   0),
  ('pickup_relay',   250, 0),
  ('home_delivery',  490, 5000);

-- ══════════════════════════════════════════════════════════════════════════
-- 9. Triggers : intégrité cross-table (RG-04) + updated_at
-- ══════════════════════════════════════════════════════════════════════════

-- Met à jour updated_at sur mutation
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

CREATE TRIGGER produit_touch_updated  BEFORE UPDATE ON produit
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER commande_touch_updated BEFORE UPDATE ON commande
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER paiement_touch_updated BEFORE UPDATE ON paiement
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- RG-04 : exactement une sous-table de livraison peuplée par commande,
-- cohérente avec commande.mode_livraison.
CREATE OR REPLACE FUNCTION verifier_livraison_unique() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_mode TEXT;
  v_nb   INTEGER;
BEGIN
  SELECT mode_livraison INTO v_mode FROM commande WHERE id = NEW.commande_id;
  SELECT
    (SELECT COUNT(*) FROM commande_pickup_store  WHERE commande_id = NEW.commande_id) +
    (SELECT COUNT(*) FROM commande_pickup_relay  WHERE commande_id = NEW.commande_id) +
    (SELECT COUNT(*) FROM commande_home_delivery WHERE commande_id = NEW.commande_id)
  INTO v_nb;
  IF v_nb > 1 THEN
    RAISE EXCEPTION 'Commande % : plus d''une sous-table de livraison peuplée', NEW.commande_id;
  END IF;
  -- Cohérence mode ↔ sous-table :
  IF (TG_TABLE_NAME = 'commande_pickup_store'  AND v_mode <> 'pickup_store')
  OR (TG_TABLE_NAME = 'commande_pickup_relay'  AND v_mode <> 'pickup_relay')
  OR (TG_TABLE_NAME = 'commande_home_delivery' AND v_mode <> 'home_delivery') THEN
    RAISE EXCEPTION 'Commande % : mode=% incohérent avec %', NEW.commande_id, v_mode, TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER cps_verif_livraison AFTER INSERT ON commande_pickup_store
  FOR EACH ROW EXECUTE FUNCTION verifier_livraison_unique();
CREATE TRIGGER cpr_verif_livraison AFTER INSERT ON commande_pickup_relay
  FOR EACH ROW EXECUTE FUNCTION verifier_livraison_unique();
CREATE TRIGGER chd_verif_livraison AFTER INSERT ON commande_home_delivery
  FOR EACH ROW EXECUTE FUNCTION verifier_livraison_unique();

-- RG-02 : cohérence role ↔ profil client/producteur
CREATE OR REPLACE FUNCTION verifier_profil_client() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM utilisateur WHERE id = NEW.user_id;
  IF v_role <> 'user' THEN
    RAISE EXCEPTION 'profil_client : utilisateur % n''a pas le role=user (role=%)', NEW.user_id, v_role;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profil_client_role_check BEFORE INSERT OR UPDATE ON profil_client
  FOR EACH ROW EXECUTE FUNCTION verifier_profil_client();

CREATE OR REPLACE FUNCTION verifier_profil_producteur() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM utilisateur WHERE id = NEW.user_id;
  IF v_role <> 'seller' THEN
    RAISE EXCEPTION 'profil_producteur : utilisateur % n''a pas le role=seller (role=%)', NEW.user_id, v_role;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profil_producteur_role_check BEFORE INSERT OR UPDATE ON profil_producteur
  FOR EACH ROW EXECUTE FUNCTION verifier_profil_producteur();

-- RG-10 : est_saisonnier ⇔ ligne dans produit_saison
CREATE OR REPLACE FUNCTION verifier_saison_coherence() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_flag BOOLEAN;
BEGIN
  SELECT est_saisonnier INTO v_flag FROM produit WHERE id = NEW.produit_id;
  IF NOT v_flag THEN
    RAISE EXCEPTION 'produit_saison : produit % n''est pas marqué saisonnier', NEW.produit_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER produit_saison_coherence BEFORE INSERT OR UPDATE ON produit_saison
  FOR EACH ROW EXECUTE FUNCTION verifier_saison_coherence();


-- Down Migration

DROP TRIGGER IF EXISTS produit_saison_coherence       ON produit_saison;
DROP TRIGGER IF EXISTS profil_producteur_role_check   ON profil_producteur;
DROP TRIGGER IF EXISTS profil_client_role_check       ON profil_client;
DROP TRIGGER IF EXISTS chd_verif_livraison            ON commande_home_delivery;
DROP TRIGGER IF EXISTS cpr_verif_livraison            ON commande_pickup_relay;
DROP TRIGGER IF EXISTS cps_verif_livraison            ON commande_pickup_store;
DROP TRIGGER IF EXISTS paiement_touch_updated         ON paiement;
DROP TRIGGER IF EXISTS commande_touch_updated         ON commande;
DROP TRIGGER IF EXISTS produit_touch_updated          ON produit;

DROP FUNCTION IF EXISTS verifier_saison_coherence();
DROP FUNCTION IF EXISTS verifier_profil_producteur();
DROP FUNCTION IF EXISTS verifier_profil_client();
DROP FUNCTION IF EXISTS verifier_livraison_unique();
DROP FUNCTION IF EXISTS touch_updated_at();

DROP TABLE IF EXISTS shipping_rate;
DROP TABLE IF EXISTS "session";
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS alerte;
DROP TABLE IF EXISTS item_liste_courses;
DROP TABLE IF EXISTS liste_courses;
DROP TABLE IF EXISTS favori;
DROP TABLE IF EXISTS paiement_carte;
DROP TABLE IF EXISTS paiement;
DROP TABLE IF EXISTS commande_home_delivery;
DROP TABLE IF EXISTS commande_pickup_relay;
DROP TABLE IF EXISTS commande_pickup_store;
DROP TABLE IF EXISTS ligne_commande;
DROP TABLE IF EXISTS commande;
DROP TABLE IF EXISTS produit_lieu_vente;
DROP TABLE IF EXISTS produit_saison;
DROP TABLE IF EXISTS produit;
DROP TABLE IF EXISTS horaire_point_relais;
DROP TABLE IF EXISTS point_relais;
DROP TABLE IF EXISTS horaire;
DROP TABLE IF EXISTS lieu_de_vente;
DROP TABLE IF EXISTS entreprise;
DROP TABLE IF EXISTS profil_producteur;
DROP TABLE IF EXISTS adresse_geocodee;
DROP TABLE IF EXISTS profil_client;
DROP TABLE IF EXISTS utilisateur;
