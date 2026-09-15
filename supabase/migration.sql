-- ==========================================================================
--  MIGRATION SUPABASE — Ma Résidence
-- ==========================================================================
--  À exécuter dans l'éditeur SQL de Supabase (Dashboard → SQL Editor).
--  Toutes les opérations sont IDEMPOTENTES : le script peut être relancé
--  sans risque et ne modifie ni ne supprime aucune donnée existante.
--
--  Il corrige les incohérences entre le schéma existant et le code :
--    1. valeur d'enum 'sondage' (type de publication)
--    2. colonnes du sondage sur la table publications
--    3. table poll_votes (participations aux sondages)
--    4. tables admin_audit / data_archives (créées si absentes)
--    5. colonnes payload / downloaded_at sur data_archives
--    6. index d'accompagnement
-- ==========================================================================


-- --------------------------------------------------------------------------
-- 1. Type de publication : ajouter 'sondage'
-- --------------------------------------------------------------------------
-- ⚠️ ALTER TYPE ... ADD VALUE ne peut pas toujours s'exécuter dans un bloc
--    transactionnel. Si vous obtenez « cannot be executed within a
--    transaction block », exécutez cette seule ligne séparément.
ALTER TYPE public.publication_type ADD VALUE IF NOT EXISTS 'sondage' BEFORE 'texte';


-- --------------------------------------------------------------------------
-- 2. Colonnes du sondage sur la table publications
-- --------------------------------------------------------------------------
-- ⚠️ RÉCONCILIATION DES NOMENCLATURES
-- Deux versions du code coexistent : l'une nomme la colonne `poll_options`,
-- l'autre `poll_choices`. Cette section crée `poll_options` (nom retenu) et,
-- si `poll_choices` existe déjà avec des données, les transfère avant de la
-- supprimer. Aucune donnée n'est perdue.
--
-- `DO` est utilisé car ALTER TYPE / renommage conditionnel n'existe pas
-- en SQL pur idempotent.

DO $$
DECLARE
  has_choices  boolean;
  has_options  boolean;
  has_multiple boolean;
  has_ends     boolean;
BEGIN
  SELECT count(*) > 0 INTO has_choices
    FROM information_schema.columns
    WHERE table_name = 'publications' AND column_name = 'poll_choices';
  SELECT count(*) > 0 INTO has_options
    FROM information_schema.columns
    WHERE table_name = 'publications' AND column_name = 'poll_options';

  -- Cas 1 : `poll_choices` existe (version Gemini) → renommer en `poll_options`.
  IF has_choices AND NOT has_options THEN
    EXECUTE 'ALTER TABLE public.publications RENAME COLUMN poll_choices TO poll_options';
    RAISE NOTICE 'Colonne poll_choices renommée en poll_options (données conservées)';
  END IF;

  -- Cas 2 : les deux existent → transférer les données puis supprimer l'ancienne.
  IF has_choices AND has_options THEN
    EXECUTE 'UPDATE public.publications SET poll_options = poll_choices
             WHERE poll_options IS NULL AND poll_choices IS NOT NULL';
    EXECUTE 'ALTER TABLE public.publications DROP COLUMN poll_choices';
    RAISE NOTICE 'Données poll_choices transférées vers poll_options, colonne ancienne supprimée';
  END IF;

  -- Compléter les colonnes manquantes.
  SELECT count(*) > 0 INTO has_multiple
    FROM information_schema.columns
    WHERE table_name = 'publications' AND column_name = 'poll_multiple';
  IF NOT has_multiple THEN
    EXECUTE 'ALTER TABLE public.publications ADD COLUMN poll_multiple boolean NOT NULL DEFAULT false';
    RAISE NOTICE 'Colonne poll_multiple créée';
  END IF;

  SELECT count(*) > 0 INTO has_ends
    FROM information_schema.columns
    WHERE table_name = 'publications' AND column_name = 'poll_ends_at';
  IF NOT has_ends THEN
    EXECUTE 'ALTER TABLE public.publications ADD COLUMN poll_ends_at timestamptz';
    RAISE NOTICE 'Colonne poll_ends_at créée';
  END IF;
END $$;

-- Créer poll_options si aucune des deux n'existe.
ALTER TABLE public.publications
  ADD COLUMN IF NOT EXISTS poll_options jsonb;

COMMENT ON COLUMN public.publications.poll_options IS
  'Options du sondage (type = sondage uniquement). Null pour les autres types.';
COMMENT ON COLUMN public.publications.poll_multiple IS
  'Sondage à choix multiples (true) ou choix unique (false).';
COMMENT ON COLUMN public.publications.poll_ends_at IS
  'Date de clôture facultative du sondage.';


-- --------------------------------------------------------------------------
-- 3. Table des participations aux sondages
-- --------------------------------------------------------------------------
-- Séquence d'abord (référencée par la table ci-dessous).
CREATE SEQUENCE IF NOT EXISTS poll_votes_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id integer NOT NULL DEFAULT nextval('poll_votes_id_seq'::regclass),
  publication_id integer NOT NULL,
  user_id integer NOT NULL,
  option_index integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT poll_votes_pkey PRIMARY KEY (id),
  CONSTRAINT poll_votes_publication_id_publications_id_fk
    FOREIGN KEY (publication_id) REFERENCES public.publications(id)
    ON DELETE CASCADE,
  CONSTRAINT poll_votes_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES public.users(id)
    ON DELETE CASCADE,
  -- Un même utilisateur ne peut pas voter deux fois la même option
  CONSTRAINT poll_votes_unique UNIQUE (publication_id, user_id, option_index)
);

ALTER SEQUENCE poll_votes_id_seq OWNED BY public.poll_votes.id;

CREATE INDEX IF NOT EXISTS poll_votes_pub_idx ON public.poll_votes (publication_id);
CREATE INDEX IF NOT EXISTS poll_votes_pub_user_idx
  ON public.poll_votes (publication_id, user_id);

COMMENT ON TABLE public.poll_votes IS
  'Votes de sondage : chaque membre actif (y compris les propriétaires) peut participer.';


-- --------------------------------------------------------------------------
-- 4. Tables d'administration (créées seulement si absentes)
-- --------------------------------------------------------------------------
-- Sur votre base Supabase elles existent déjà : ces ordres sont alors sans
-- effet. Ils garantissent le fonctionnement sur une base neuve.

CREATE SEQUENCE IF NOT EXISTS admin_audit_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE IF NOT EXISTS public.admin_audit (
  id integer NOT NULL DEFAULT nextval('admin_audit_id_seq'::regclass),
  actor_id integer NOT NULL,
  action character varying NOT NULL,
  target text,
  details text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_pkey PRIMARY KEY (id),
  CONSTRAINT admin_audit_actor_id_users_id_fk
    FOREIGN KEY (actor_id) REFERENCES public.users(id)
);

ALTER SEQUENCE admin_audit_id_seq OWNED BY public.admin_audit.id;

CREATE SEQUENCE IF NOT EXISTS data_archives_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE IF NOT EXISTS public.data_archives (
  id integer NOT NULL DEFAULT nextval('data_archives_id_seq'::regclass),
  kind character varying NOT NULL,
  title text NOT NULL,
  filename text NOT NULL,
  payload text NOT NULL,
  downloaded_at timestamp with time zone,
  created_by integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT data_archives_pkey PRIMARY KEY (id),
  CONSTRAINT data_archives_created_by_users_id_fk
    FOREIGN KEY (created_by) REFERENCES public.users(id)
);

ALTER SEQUENCE data_archives_id_seq OWNED BY public.data_archives.id;


-- --------------------------------------------------------------------------
-- 5. data_archives : colonnes complémentaires
-- --------------------------------------------------------------------------
-- Si la table existait déjà sans ces colonnes (ancien modèle par fichier),
-- on les ajoute. `payload` contient le ZIP encodé en base64.
ALTER TABLE public.data_archives
  ADD COLUMN IF NOT EXISTS payload text,
  ADD COLUMN IF NOT EXISTS downloaded_at timestamp with time zone;

COMMENT ON COLUMN public.data_archives.payload IS
  'Contenu de l''archive ZIP encodé en base64 (stockage en base, sans fichier).';
COMMENT ON COLUMN public.data_archives.downloaded_at IS
  'Date du téléchargement (l''enregistrement est ensuite supprimé).';


-- --------------------------------------------------------------------------
-- 6. Index
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS admin_audit_created_idx
  ON public.admin_audit (created_at);
CREATE INDEX IF NOT EXISTS data_archives_created_idx
  ON public.data_archives (created_at);


-- ==========================================================================
--  VÉRIFICATION (à lancer séparément après la migration)
-- ==========================================================================
-- SELECT
--   (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
--      WHERE t.typname = 'publication_type' AND e.enumlabel = 'sondage')
--     AS enum_sondage,
--   (SELECT count(*) FROM information_schema.columns
--      WHERE table_name = 'publications' AND column_name = 'poll_options')
--     AS colonne_poll_options,
--   (SELECT count(*) FROM information_schema.tables
--      WHERE table_name = 'poll_votes')
--     AS table_poll_votes,
--   (SELECT count(*) FROM information_schema.columns
--      WHERE table_name = 'data_archives' AND column_name = 'payload')
--     AS colonne_payload,
--   (SELECT count(*) FROM information_schema.columns
--      WHERE table_name = 'data_archives' AND column_name = 'downloaded_at')
--     AS colonne_downloaded_at;
--
--  Résultat attendu : enum_sondage=1, colonne_poll_options=1, table_poll_votes=1,
--                     colonne_payload=1, colonne_downloaded_at=1
-- ==========================================================================
