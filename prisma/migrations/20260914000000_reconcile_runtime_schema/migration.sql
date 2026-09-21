-- Reconciles the Prisma schema with fields and tables that were previously
-- created lazily by API handlers. Apply this migration before deploying the
-- corresponding application code.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "ciudad" TEXT,
  ADD COLUMN IF NOT EXISTS "porcentaje" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "cedula" TEXT;

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "ciudad" TEXT;

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "demandTags" TEXT,
  ADD COLUMN IF NOT EXISTS "legalSection" TEXT;

ALTER TABLE "LegalCase"
  ADD COLUMN IF NOT EXISTS "abogadoId" TEXT,
  ADD COLUMN IF NOT EXISTS "estadoAsignacion" TEXT,
  ADD COLUMN IF NOT EXISTS "estatusCliente" TEXT,
  ADD COLUMN IF NOT EXISTS "precioCliente" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "honorarioAbogado" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT,
  ADD COLUMN IF NOT EXISTS "anticipoPagado" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "ciudad" TEXT,
  ADD COLUMN IF NOT EXISTS "facts" TEXT,
  ADD COLUMN IF NOT EXISTS "courtNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "courtType" TEXT,
  ADD COLUMN IF NOT EXISTS "counterpartyAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "expedienteReal" TEXT,
  ADD COLUMN IF NOT EXISTS "folioProvisional" TEXT,
  ADD COLUMN IF NOT EXISTS "questionnaireData" TEXT,
  ADD COLUMN IF NOT EXISTS "questionnaireType" TEXT;

ALTER TABLE "CaseAttachment"
  ADD COLUMN IF NOT EXISTS "concept" TEXT;

UPDATE "LegalCase"
SET
  "estadoAsignacion" = COALESCE("estadoAsignacion", 'PENDIENTE'),
  "estatusCliente" = COALESCE("estatusCliente", 'PENDIENTE'),
  "anticipoPagado" = COALESCE("anticipoPagado", false);

ALTER TABLE "LegalCase"
  ALTER COLUMN "estadoAsignacion" SET DEFAULT 'PENDIENTE',
  ALTER COLUMN "estadoAsignacion" SET NOT NULL,
  ALTER COLUMN "estatusCliente" SET DEFAULT 'PENDIENTE',
  ALTER COLUMN "estatusCliente" SET NOT NULL,
  ALTER COLUMN "anticipoPagado" SET DEFAULT false,
  ALTER COLUMN "anticipoPagado" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "StripePaymentDraft" (
  "id" TEXT NOT NULL,
  "portalUserId" TEXT NOT NULL,
  "tipoServicio" TEXT NOT NULL,
  "datosPersonales" TEXT NOT NULL,
  "respuestas" TEXT NOT NULL,
  "cotizacion" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripePaymentDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServicioConfig" (
  "id" TEXT NOT NULL,
  "servicioId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "precioBase" INTEGER NOT NULL,
  "precioDesde" BOOLEAN NOT NULL DEFAULT false,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServicioConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PrecioModificador" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "valor" INTEGER NOT NULL,
  CONSTRAINT "PrecioModificador_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientPortalUser" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "clientId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientPortalUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CasePayment" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "concept" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CasePayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LegalCase_stripePaymentIntentId_key"
  ON "LegalCase"("stripePaymentIntentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CaseAttachment_caseId_concept_key"
  ON "CaseAttachment"("caseId", "concept");
CREATE UNIQUE INDEX IF NOT EXISTS "ServicioConfig_servicioId_key"
  ON "ServicioConfig"("servicioId");
CREATE UNIQUE INDEX IF NOT EXISTS "PrecioModificador_key_key"
  ON "PrecioModificador"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "ClientPortalUser_email_key"
  ON "ClientPortalUser"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "ClientPortalUser_clientId_key"
  ON "ClientPortalUser"("clientId");
CREATE INDEX IF NOT EXISTS "StripePaymentDraft_portalUserId_idx"
  ON "StripePaymentDraft"("portalUserId");
CREATE INDEX IF NOT EXISTS "CasePayment_caseId_idx"
  ON "CasePayment"("caseId");
CREATE INDEX IF NOT EXISTS "Document_ownerUserId_idx"
  ON "Document"("ownerUserId");
CREATE INDEX IF NOT EXISTS "LegalCase_abogadoId_idx"
  ON "LegalCase"("abogadoId");
CREATE INDEX IF NOT EXISTS "LegalCase_isActive_updatedAt_idx"
  ON "LegalCase"("isActive", "updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'LegalCase_abogadoId_fkey'
      AND conrelid = '"LegalCase"'::regclass
  ) THEN
    ALTER TABLE "LegalCase"
      ADD CONSTRAINT "LegalCase_abogadoId_fkey"
      FOREIGN KEY ("abogadoId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ClientPortalUser_clientId_fkey'
      AND conrelid = '"ClientPortalUser"'::regclass
  ) THEN
    ALTER TABLE "ClientPortalUser"
      ADD CONSTRAINT "ClientPortalUser_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CasePayment_caseId_fkey'
      AND conrelid = '"CasePayment"'::regclass
  ) THEN
    ALTER TABLE "CasePayment"
      ADD CONSTRAINT "CasePayment_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "LegalCase"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
