-- CreateEnum
CREATE TYPE "DeadlineStatus" AS ENUM ('PENDIENTE', 'CUMPLIDO', 'CANCELADO');

-- AlterTable
ALTER TABLE "CaseAttachment" ADD COLUMN     "concept" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "sourceType" TEXT;

-- AlterTable
ALTER TABLE "LegalCase" ADD COLUMN     "claimKey" TEXT,
ADD COLUMN     "intent" TEXT;

-- CreateTable
CREATE TABLE "CaseKnowledge" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sourceType" TEXT,
    "snippet" TEXT,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseDeadline" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "termDays" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "DeadlineStatus" NOT NULL DEFAULT 'PENDIENTE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseKnowledge_caseId_idx" ON "CaseKnowledge"("caseId");

-- CreateIndex
CREATE INDEX "CaseKnowledge_documentId_idx" ON "CaseKnowledge"("documentId");

-- CreateIndex
CREATE INDEX "CaseDeadline_caseId_dueDate_idx" ON "CaseDeadline"("caseId", "dueDate");

-- CreateIndex
CREATE INDEX "CaseDeadline_userId_dueDate_idx" ON "CaseDeadline"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "CaseDeadline_status_idx" ON "CaseDeadline"("status");

-- CreateIndex
CREATE INDEX "Document_matter_submatter_jurisdiccion_sourceType_idx" ON "Document"("matter", "submatter", "jurisdiccion", "sourceType");

-- AddForeignKey
ALTER TABLE "CaseKnowledge" ADD CONSTRAINT "CaseKnowledge_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LegalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseKnowledge" ADD CONSTRAINT "CaseKnowledge_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDeadline" ADD CONSTRAINT "CaseDeadline_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LegalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDeadline" ADD CONSTRAINT "CaseDeadline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
