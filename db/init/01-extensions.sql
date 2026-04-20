-- Exécuté une seule fois au premier démarrage du conteneur PostgreSQL.
-- (Le dossier /docker-entrypoint-initdb.d n'est lu que si le volume de données est vide.)
--
-- Active les extensions requises. Les migrations node-pg-migrate prennent ensuite le relais
-- pour le schéma métier (tables, vues, fonctions).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- pour gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- email case-insensitive

-- Petit garde-fou : log la version PostGIS à l'initialisation.
DO $$
BEGIN
  RAISE NOTICE 'PostGIS version: %', PostGIS_Version();
END $$;
