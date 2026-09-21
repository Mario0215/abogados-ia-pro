-- Read-only preflight for 20260914000000_reconcile_runtime_schema.
-- Run this against staging (and review every returned row) before migrate deploy.

-- Existing runtime-created tables must already contain every required column.
WITH required_columns(table_name, column_name) AS (
  VALUES
    ('StripePaymentDraft', 'id'),
    ('StripePaymentDraft', 'portalUserId'),
    ('StripePaymentDraft', 'tipoServicio'),
    ('StripePaymentDraft', 'datosPersonales'),
    ('StripePaymentDraft', 'respuestas'),
    ('StripePaymentDraft', 'cotizacion'),
    ('StripePaymentDraft', 'createdAt'),
    ('ServicioConfig', 'id'),
    ('ServicioConfig', 'servicioId'),
    ('ServicioConfig', 'nombre'),
    ('ServicioConfig', 'precioBase'),
    ('ServicioConfig', 'precioDesde'),
    ('ServicioConfig', 'activo'),
    ('ServicioConfig', 'updatedAt'),
    ('PrecioModificador', 'id'),
    ('PrecioModificador', 'key'),
    ('PrecioModificador', 'valor'),
    ('ClientPortalUser', 'id'),
    ('ClientPortalUser', 'email'),
    ('ClientPortalUser', 'passwordHash'),
    ('ClientPortalUser', 'name'),
    ('ClientPortalUser', 'phone'),
    ('ClientPortalUser', 'clientId'),
    ('ClientPortalUser', 'active'),
    ('ClientPortalUser', 'createdAt'),
    ('ClientPortalUser', 'updatedAt'),
    ('CasePayment', 'id'),
    ('CasePayment', 'caseId'),
    ('CasePayment', 'amount'),
    ('CasePayment', 'concept'),
    ('CasePayment', 'date'),
    ('CasePayment', 'notes'),
    ('CasePayment', 'createdAt'),
    ('LegalCase', 'abogadoId'),
    ('LegalCase', 'stripePaymentIntentId'),
    ('CaseAttachment', 'caseId'),
    ('CaseAttachment', 'concept')
)
SELECT required_columns.table_name, required_columns.column_name
FROM required_columns
JOIN information_schema.tables
  ON table_schema = current_schema()
  AND tables.table_name = required_columns.table_name
LEFT JOIN information_schema.columns
  ON columns.table_schema = current_schema()
  AND columns.table_name = required_columns.table_name
  AND columns.column_name = required_columns.column_name
WHERE columns.column_name IS NULL
ORDER BY required_columns.table_name, required_columns.column_name;

-- The safeguards below are skipped when a runtime-created table never existed;
-- the migration creates it. Any raised error must be resolved before deploy.
DO $$
DECLARE duplicate_groups BIGINT;
BEGIN
  IF to_regclass(format('%I.%I', current_schema(), 'CaseAttachment')) IS NOT NULL
    AND (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'CaseAttachment'
           AND column_name IN ('caseId', 'concept')) = 2 THEN
    SELECT count(*) INTO duplicate_groups
    FROM (
      SELECT 1 FROM "CaseAttachment"
      WHERE "concept" IS NOT NULL
      GROUP BY "caseId", "concept"
      HAVING count(*) > 1
    ) AS duplicate_rows;
    IF duplicate_groups > 0 THEN
      RAISE EXCEPTION 'CaseAttachment has % duplicate (caseId, concept) groups', duplicate_groups;
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  duplicate_groups BIGINT;
  orphaned_rows BIGINT;
BEGIN
  IF to_regclass(format('%I.%I', current_schema(), 'LegalCase')) IS NOT NULL
    AND (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'LegalCase'
           AND column_name IN ('stripePaymentIntentId', 'abogadoId')) = 2 THEN
    SELECT count(*) INTO duplicate_groups
    FROM (
      SELECT 1 FROM "LegalCase"
      WHERE "stripePaymentIntentId" IS NOT NULL
      GROUP BY "stripePaymentIntentId"
      HAVING count(*) > 1
    ) AS duplicate_rows;
    SELECT count(*) INTO orphaned_rows
    FROM "LegalCase" AS cases
    LEFT JOIN "User" AS users ON users."id" = cases."abogadoId"
    WHERE cases."abogadoId" IS NOT NULL AND users."id" IS NULL;
    IF duplicate_groups > 0 THEN
      RAISE EXCEPTION 'LegalCase has % duplicate stripePaymentIntentId values', duplicate_groups;
    END IF;
    IF orphaned_rows > 0 THEN
      RAISE EXCEPTION 'LegalCase has % orphaned abogadoId values', orphaned_rows;
    END IF;
  END IF;
END $$;

DO $$
DECLARE duplicate_groups BIGINT;
BEGIN
  IF to_regclass(format('%I.%I', current_schema(), 'ServicioConfig')) IS NOT NULL
    AND (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'ServicioConfig'
           AND column_name = 'servicioId') = 1 THEN
    SELECT count(*) INTO duplicate_groups
    FROM (
      SELECT 1 FROM "ServicioConfig"
      GROUP BY "servicioId"
      HAVING count(*) > 1
    ) AS duplicate_rows;
    IF duplicate_groups > 0 THEN
      RAISE EXCEPTION 'ServicioConfig has % duplicate servicioId values', duplicate_groups;
    END IF;
  END IF;
END $$;

DO $$
DECLARE duplicate_groups BIGINT;
BEGIN
  IF to_regclass(format('%I.%I', current_schema(), 'PrecioModificador')) IS NOT NULL
    AND (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'PrecioModificador'
           AND column_name = 'key') = 1 THEN
    SELECT count(*) INTO duplicate_groups
    FROM (
      SELECT 1 FROM "PrecioModificador"
      GROUP BY "key"
      HAVING count(*) > 1
    ) AS duplicate_rows;
    IF duplicate_groups > 0 THEN
      RAISE EXCEPTION 'PrecioModificador has % duplicate key values', duplicate_groups;
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  duplicate_emails BIGINT;
  duplicate_clients BIGINT;
  orphaned_clients BIGINT;
BEGIN
  IF to_regclass(format('%I.%I', current_schema(), 'ClientPortalUser')) IS NOT NULL
    AND (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'ClientPortalUser'
           AND column_name IN ('email', 'clientId')) = 2 THEN
    SELECT count(*) INTO duplicate_emails
    FROM (
      SELECT 1 FROM "ClientPortalUser"
      GROUP BY "email"
      HAVING count(*) > 1
    ) AS duplicate_rows;
    SELECT count(*) INTO duplicate_clients
    FROM (
      SELECT 1 FROM "ClientPortalUser"
      WHERE "clientId" IS NOT NULL
      GROUP BY "clientId"
      HAVING count(*) > 1
    ) AS duplicate_rows;
    SELECT count(*) INTO orphaned_clients
    FROM "ClientPortalUser" AS portal_users
    LEFT JOIN "Client" AS clients ON clients."id" = portal_users."clientId"
    WHERE portal_users."clientId" IS NOT NULL AND clients."id" IS NULL;
    IF duplicate_emails > 0 THEN
      RAISE EXCEPTION 'ClientPortalUser has % duplicate email values', duplicate_emails;
    END IF;
    IF duplicate_clients > 0 THEN
      RAISE EXCEPTION 'ClientPortalUser has % duplicate clientId values', duplicate_clients;
    END IF;
    IF orphaned_clients > 0 THEN
      RAISE EXCEPTION 'ClientPortalUser has % orphaned clientId values', orphaned_clients;
    END IF;
  END IF;
END $$;

DO $$
DECLARE orphaned_rows BIGINT;
BEGIN
  IF to_regclass(format('%I.%I', current_schema(), 'CasePayment')) IS NOT NULL
    AND (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'CasePayment'
           AND column_name = 'caseId') = 1 THEN
    SELECT count(*) INTO orphaned_rows
    FROM "CasePayment" AS payments
    LEFT JOIN "LegalCase" AS cases ON cases."id" = payments."caseId"
    WHERE cases."id" IS NULL;
    IF orphaned_rows > 0 THEN
      RAISE EXCEPTION 'CasePayment has % orphaned caseId values', orphaned_rows;
    END IF;
  END IF;
END $$;
