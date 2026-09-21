-- Fase 6: movimientos financieros del cliente y pagos manuales de PRO al abogado.
-- Es aditiva y conserva los importes existentes en Float conforme a la decisión de MESA.

CREATE TYPE "ClientPaymentType" AS ENUM ('ANTICIPO_CLIENTE', 'PAGO_CLIENTE', 'REEMBOLSO_CLIENTE');
CREATE TYPE "FinancialMovementStatus" AS ENUM ('CONFIRMADO', 'ANULADO');
CREATE TYPE "LawyerPaymentMethod" AS ENUM ('TRANSFERENCIA', 'EFECTIVO', 'OTRO');

ALTER TABLE "LegalCase"
  ADD COLUMN "honorarioAbogadoAcordadoAt" TIMESTAMP(3),
  ADD COLUMN "honorarioAbogadoAcordadoPorId" TEXT;

ALTER TABLE "CasePayment"
  ADD COLUMN "tipo" "ClientPaymentType" NOT NULL DEFAULT 'PAGO_CLIENTE',
  ADD COLUMN "estado" "FinancialMovementStatus" NOT NULL DEFAULT 'CONFIRMADO',
  ADD COLUMN "referenciaExterna" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "registradoPorAdminId" TEXT,
  ADD COLUMN "anuladoAt" TIMESTAMP(3),
  ADD COLUMN "anuladoPorAdminId" TEXT,
  ADD COLUMN "motivoAnulacion" TEXT;

-- Backfill determinista: sólo el concepto histórico exacto de Stripe se clasifica como anticipo.
UPDATE "CasePayment"
SET "tipo" = 'ANTICIPO_CLIENTE'
WHERE "concept" = 'Anticipo (Stripe)';

CREATE TABLE "LawyerPayment" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "lawyerId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "method" "LawyerPaymentMethod" NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "status" "FinancialMovementStatus" NOT NULL DEFAULT 'CONFIRMADO',
  "idempotencyKey" TEXT NOT NULL,
  "recordedByAdminId" TEXT NOT NULL,
  "voidedAt" TIMESTAMP(3),
  "voidedByAdminId" TEXT,
  "voidReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LawyerPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CasePayment_idempotencyKey_key" ON "CasePayment"("idempotencyKey");
CREATE INDEX "CasePayment_caseId_estado_tipo_idx" ON "CasePayment"("caseId", "estado", "tipo");
CREATE INDEX "CasePayment_referenciaExterna_idx" ON "CasePayment"("referenciaExterna");
CREATE UNIQUE INDEX "LawyerPayment_idempotencyKey_key" ON "LawyerPayment"("idempotencyKey");
CREATE INDEX "LawyerPayment_caseId_status_idx" ON "LawyerPayment"("caseId", "status");
CREATE INDEX "LawyerPayment_lawyerId_paidAt_idx" ON "LawyerPayment"("lawyerId", "paidAt");

ALTER TABLE "LegalCase"
  ADD CONSTRAINT "LegalCase_honorarioAbogadoAcordadoPorId_fkey"
  FOREIGN KEY ("honorarioAbogadoAcordadoPorId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CasePayment"
  ADD CONSTRAINT "CasePayment_registradoPorAdminId_fkey"
  FOREIGN KEY ("registradoPorAdminId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CasePayment_anuladoPorAdminId_fkey"
  FOREIGN KEY ("anuladoPorAdminId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LawyerPayment"
  ADD CONSTRAINT "LawyerPayment_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "LegalCase"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "LawyerPayment_lawyerId_fkey"
  FOREIGN KEY ("lawyerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "LawyerPayment_recordedByAdminId_fkey"
  FOREIGN KEY ("recordedByAdminId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "LawyerPayment_voidedByAdminId_fkey"
  FOREIGN KEY ("voidedByAdminId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
