-- Conservación de PDFs oficiales y su representación derivada para el núcleo
-- normativo. Es aditiva: las fuentes manuales y los módulos heredados quedan
-- intactos.

CREATE TYPE "LegalSourceExtractionStatus" AS ENUM (
  'NOT_REQUESTED',
  'PENDING',
  'EXTRACTED',
  'REQUIRES_OCR',
  'FAILED'
);

ALTER TABLE "LegalSource"
  ADD COLUMN "targetNormId" TEXT,
  ADD COLUMN "originalFileName" TEXT,
  ADD COLUMN "originalMimeType" TEXT,
  ADD COLUMN "originalStorageProvider" TEXT,
  ADD COLUMN "originalStoragePath" TEXT,
  ADD COLUMN "originalFileData" BYTEA,
  ADD COLUMN "originalSizeBytes" INTEGER,
  ADD COLUMN "originalSha256" TEXT,
  ADD COLUMN "extractionStatus" "LegalSourceExtractionStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN "extractedText" TEXT,
  ADD COLUMN "extractedTextHash" TEXT,
  ADD COLUMN "structuredMarkdown" TEXT,
  ADD COLUMN "structuredHash" TEXT,
  ADD COLUMN "extractionEngine" TEXT,
  ADD COLUMN "extractionMetadata" JSONB,
  ADD COLUMN "extractionError" TEXT,
  ADD COLUMN "extractedAt" TIMESTAMP(3);

ALTER TABLE "LegalSource"
  ADD CONSTRAINT "LegalSource_targetNormId_fkey"
  FOREIGN KEY ("targetNormId") REFERENCES "LegalNorm"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LegalSource"
  ADD CONSTRAINT "LegalSource_original_pdf_metadata_check"
  CHECK (
    (
      "originalFileName" IS NULL
      AND "originalMimeType" IS NULL
      AND "originalStorageProvider" IS NULL
      AND "originalStoragePath" IS NULL
      AND "originalFileData" IS NULL
      AND "originalSizeBytes" IS NULL
      AND "originalSha256" IS NULL
    )
    OR
    (
      "originalFileName" IS NOT NULL
      AND "originalMimeType" = 'application/pdf'
      AND "originalStorageProvider" IS NOT NULL
      AND ("originalStoragePath" IS NOT NULL OR "originalFileData" IS NOT NULL)
      AND "originalSizeBytes" > 0
      AND "originalSha256" ~ '^[a-f0-9]{64}$'
    )
  );

ALTER TABLE "LegalSource"
  ADD CONSTRAINT "LegalSource_extracted_text_check"
  CHECK (
    "extractionStatus" <> 'EXTRACTED'
    OR (
      "extractedText" IS NOT NULL
      AND "extractedTextHash" ~ '^[a-f0-9]{64}$'
      AND "structuredMarkdown" IS NOT NULL
      AND "structuredHash" ~ '^[a-f0-9]{64}$'
      AND "extractedAt" IS NOT NULL
    )
  );

CREATE INDEX "LegalSource_targetNormId_idx" ON "LegalSource"("targetNormId");
CREATE INDEX "LegalSource_originalSha256_idx" ON "LegalSource"("originalSha256");
CREATE INDEX "LegalSource_extractionStatus_updatedAt_idx" ON "LegalSource"("extractionStatus", "updatedAt");
