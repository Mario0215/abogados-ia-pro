-- Fases 0 y 1: gobierno normativo aditivo para Abogados IA Pro.
-- No modifica Document, CaseKnowledge, pgvector ni el RAG heredado salvo
-- referencias opcionales hacia disposiciones del nuevo núcleo.

CREATE TYPE "LegalMatter" AS ENUM ('CIVIL', 'FAMILIAR', 'LABORAL');
CREATE TYPE "LegalNormVersionStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'CURRENT', 'FUTURE', 'REPEALED', 'HISTORICAL');
CREATE TYPE "LegalSourceTrustLevel" AS ENUM ('PRIMARY_OFFICIAL', 'OFFICIAL_CONSOLIDATED', 'OFFICIAL_OPERATIONAL', 'CURATED_INTERNAL');
CREATE TYPE "LegalSourceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "LegalScope" AS ENUM ('STATE', 'FEDERAL', 'NATIONAL');
CREATE TYPE "LegalTerritory" AS ENUM ('GUANAJUATO', 'FEDERAL_NACIONAL');
CREATE TYPE "LegalProvisionType" AS ENUM ('BOOK', 'TITLE', 'CHAPTER', 'SECTION', 'ARTICLE', 'FRACTION', 'TRANSITORY');
CREATE TYPE "LegalEmbeddingIndexStatus" AS ENUM ('PENDING', 'INDEXED', 'FAILED', 'RETIRED');
CREATE TYPE "LegalApplicabilityResult" AS ENUM ('RESOLVED', 'REQUIRES_REVIEW', 'BLOCKED');
CREATE TYPE "LegalRegime" AS ENUM ('CPC_GTO_LEGACY', 'CNPCF', 'LABORAL_FEDERAL');

ALTER TABLE "Document" ADD COLUMN "legalProvisionId" TEXT;
ALTER TABLE "CaseKnowledge" ADD COLUMN "legalProvisionId" TEXT;

CREATE TABLE "LegalSource" (
  "id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "authority" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "trustLevel" "LegalSourceTrustLevel" NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "contentHash" TEXT,
  "originFile" TEXT,
  "status" "LegalSourceStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalNorm" (
  "id" TEXT NOT NULL,
  "canonicalId" TEXT NOT NULL,
  "officialName" TEXT NOT NULL,
  "matter" "LegalMatter" NOT NULL,
  "scope" "LegalScope" NOT NULL,
  "issuingAuthority" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalNorm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalNormMatter" (
  "normId" TEXT NOT NULL,
  "matter" "LegalMatter" NOT NULL,
  CONSTRAINT "LegalNormMatter_pkey" PRIMARY KEY ("normId", "matter")
);

CREATE TABLE "LegalNormVersion" (
  "id" TEXT NOT NULL,
  "normId" TEXT NOT NULL,
  "versionKey" TEXT NOT NULL,
  "publicationDate" TIMESTAMP(3),
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "status" "LegalNormVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "previousVersionId" TEXT,
  "sourceId" TEXT,
  "contentHash" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalNormVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalNormVersion_effective_range_check" CHECK ("effectiveFrom" IS NULL OR "effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
);

CREATE TABLE "LegalProvision" (
  "id" TEXT NOT NULL,
  "normVersionId" TEXT NOT NULL,
  "parentId" TEXT,
  "type" "LegalProvisionType" NOT NULL,
  "designation" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "structurePath" TEXT NOT NULL,
  "heading" TEXT,
  "fullText" TEXT,
  "contentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalProvision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalEmbedding" (
  "id" TEXT NOT NULL,
  "provisionId" TEXT NOT NULL,
  "embedding" vector(1536),
  "model" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "indexStatus" "LegalEmbeddingIndexStatus" NOT NULL DEFAULT 'PENDING',
  "indexedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalApplicabilityRule" (
  "id" TEXT NOT NULL,
  "ruleKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "matter" "LegalMatter" NOT NULL,
  "territory" "LegalTerritory" NOT NULL,
  "procedure" TEXT,
  "phase" TEXT,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "result" "LegalApplicabilityResult" NOT NULL,
  "regime" "LegalRegime",
  "targetNormId" TEXT,
  "targetNormVersionId" TEXT,
  "sourceId" TEXT,
  "explanation" TEXT NOT NULL,
  "ruleVersion" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "retiredAt" TIMESTAMP(3),
  "retirementReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalApplicabilityRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalApplicabilityRule_effective_range_check" CHECK ("effectiveFrom" IS NULL OR "effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom"),
  CONSTRAINT "LegalApplicabilityRule_result_regime_check" CHECK (("result" = 'RESOLVED' AND "regime" IS NOT NULL) OR ("result" <> 'RESOLVED' AND "regime" IS NULL))
);

CREATE TABLE "LegalTransitionRule" (
  "id" TEXT NOT NULL,
  "ruleKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "matter" "LegalMatter" NOT NULL,
  "territory" "LegalTerritory" NOT NULL,
  "procedure" TEXT,
  "phase" TEXT,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "result" "LegalApplicabilityResult" NOT NULL,
  "regime" "LegalRegime",
  "fromNormId" TEXT,
  "toNormId" TEXT,
  "fromNormVersionId" TEXT,
  "toNormVersionId" TEXT,
  "sourceId" TEXT,
  "explanation" TEXT NOT NULL,
  "ruleVersion" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "retiredAt" TIMESTAMP(3),
  "retirementReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalTransitionRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalTransitionRule_effective_range_check" CHECK ("effectiveFrom" IS NULL OR "effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom"),
  CONSTRAINT "LegalTransitionRule_result_regime_check" CHECK (("result" = 'RESOLVED' AND "regime" IS NOT NULL) OR ("result" <> 'RESOLVED' AND "regime" IS NULL))
);

CREATE TABLE "CaseLegalContext" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "matter" "LegalMatter" NOT NULL,
  "territory" "LegalTerritory" NOT NULL DEFAULT 'GUANAJUATO',
  "procedure" TEXT,
  "municipality" TEXT,
  "court" TEXT,
  "startDate" TIMESTAMP(3),
  "filingDate" TIMESTAMP(3),
  "proceduralPhase" TEXT,
  "contextData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CaseLegalContext_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseLegalRegimeDecision" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "contextId" TEXT,
  "applicabilityRuleId" TEXT,
  "transitionRuleId" TEXT,
  "result" "LegalApplicabilityResult" NOT NULL,
  "regime" "LegalRegime",
  "explanation" TEXT NOT NULL,
  "ruleVersion" TEXT,
  "relevantDate" TIMESTAMP(3),
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isHumanOverride" BOOLEAN NOT NULL DEFAULT false,
  "overrideReason" TEXT,
  "actorUserId" TEXT,
  "overrideActorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseLegalRegimeDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CaseLegalRegimeDecision_result_regime_check" CHECK (("result" = 'RESOLVED' AND "regime" IS NOT NULL) OR ("result" <> 'RESOLVED' AND "regime" IS NULL)),
  CONSTRAINT "CaseLegalRegimeDecision_override_check" CHECK (NOT "isHumanOverride" OR ("overrideReason" IS NOT NULL AND "overrideActorUserId" IS NOT NULL))
);

CREATE TABLE "CaseLegalDecisionVersion" (
  "decisionId" TEXT NOT NULL,
  "normVersionId" TEXT NOT NULL,
  "reason" TEXT,
  CONSTRAINT "CaseLegalDecisionVersion_pkey" PRIMARY KEY ("decisionId", "normVersionId")
);

CREATE TABLE "LegalRagCitation" (
  "id" TEXT NOT NULL,
  "caseId" TEXT,
  "chatLogId" TEXT,
  "decisionId" TEXT,
  "sourceId" TEXT,
  "normId" TEXT,
  "normVersionId" TEXT,
  "provisionId" TEXT,
  "queryText" TEXT,
  "responseText" TEXT,
  "queryHash" TEXT,
  "responseHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalRagCitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalSource_fingerprint_key" ON "LegalSource"("fingerprint");
CREATE INDEX "LegalSource_url_idx" ON "LegalSource"("url");
CREATE INDEX "LegalSource_status_trustLevel_idx" ON "LegalSource"("status", "trustLevel");
CREATE UNIQUE INDEX "LegalNorm_canonicalId_key" ON "LegalNorm"("canonicalId");
CREATE INDEX "LegalNorm_matter_active_idx" ON "LegalNorm"("matter", "active");
CREATE INDEX "LegalNormMatter_matter_idx" ON "LegalNormMatter"("matter");
CREATE UNIQUE INDEX "LegalNormVersion_normId_versionKey_key" ON "LegalNormVersion"("normId", "versionKey");
CREATE INDEX "LegalNormVersion_normId_status_effectiveFrom_effectiveTo_idx" ON "LegalNormVersion"("normId", "status", "effectiveFrom", "effectiveTo");
CREATE INDEX "LegalNormVersion_sourceId_idx" ON "LegalNormVersion"("sourceId");
CREATE UNIQUE INDEX "LegalNormVersion_one_current_per_norm" ON "LegalNormVersion"("normId") WHERE "status" = 'CURRENT';
CREATE UNIQUE INDEX "LegalProvision_normVersionId_structurePath_key" ON "LegalProvision"("normVersionId", "structurePath");
CREATE INDEX "LegalProvision_normVersionId_type_designation_idx" ON "LegalProvision"("normVersionId", "type", "designation");
CREATE INDEX "LegalProvision_parentId_idx" ON "LegalProvision"("parentId");
CREATE UNIQUE INDEX "LegalEmbedding_provisionId_model_contentHash_key" ON "LegalEmbedding"("provisionId", "model", "contentHash");
CREATE INDEX "LegalEmbedding_indexStatus_updatedAt_idx" ON "LegalEmbedding"("indexStatus", "updatedAt");
CREATE UNIQUE INDEX "LegalApplicabilityRule_ruleKey_key" ON "LegalApplicabilityRule"("ruleKey");
CREATE INDEX "LegalApplicabilityRule_matter_territory_active_priority_idx" ON "LegalApplicabilityRule"("matter", "territory", "active", "priority");
CREATE INDEX "LegalApplicabilityRule_effectiveFrom_effectiveTo_idx" ON "LegalApplicabilityRule"("effectiveFrom", "effectiveTo");
CREATE INDEX "LegalApplicabilityRule_sourceId_idx" ON "LegalApplicabilityRule"("sourceId");
CREATE UNIQUE INDEX "LegalTransitionRule_ruleKey_key" ON "LegalTransitionRule"("ruleKey");
CREATE INDEX "LegalTransitionRule_matter_territory_active_priority_idx" ON "LegalTransitionRule"("matter", "territory", "active", "priority");
CREATE INDEX "LegalTransitionRule_effectiveFrom_effectiveTo_idx" ON "LegalTransitionRule"("effectiveFrom", "effectiveTo");
CREATE INDEX "LegalTransitionRule_sourceId_idx" ON "LegalTransitionRule"("sourceId");
CREATE UNIQUE INDEX "CaseLegalContext_caseId_key" ON "CaseLegalContext"("caseId");
CREATE INDEX "CaseLegalContext_matter_territory_idx" ON "CaseLegalContext"("matter", "territory");
CREATE INDEX "CaseLegalRegimeDecision_caseId_evaluatedAt_idx" ON "CaseLegalRegimeDecision"("caseId", "evaluatedAt");
CREATE INDEX "CaseLegalRegimeDecision_contextId_idx" ON "CaseLegalRegimeDecision"("contextId");
CREATE INDEX "CaseLegalRegimeDecision_result_idx" ON "CaseLegalRegimeDecision"("result");
CREATE INDEX "CaseLegalDecisionVersion_normVersionId_idx" ON "CaseLegalDecisionVersion"("normVersionId");
CREATE INDEX "LegalRagCitation_caseId_createdAt_idx" ON "LegalRagCitation"("caseId", "createdAt");
CREATE INDEX "LegalRagCitation_chatLogId_idx" ON "LegalRagCitation"("chatLogId");
CREATE INDEX "LegalRagCitation_normVersionId_provisionId_idx" ON "LegalRagCitation"("normVersionId", "provisionId");
CREATE INDEX "Document_legalProvisionId_idx" ON "Document"("legalProvisionId");
CREATE INDEX "CaseKnowledge_legalProvisionId_idx" ON "CaseKnowledge"("legalProvisionId");

ALTER TABLE "Document" ADD CONSTRAINT "Document_legalProvisionId_fkey" FOREIGN KEY ("legalProvisionId") REFERENCES "LegalProvision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaseKnowledge" ADD CONSTRAINT "CaseKnowledge_legalProvisionId_fkey" FOREIGN KEY ("legalProvisionId") REFERENCES "LegalProvision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalNormMatter" ADD CONSTRAINT "LegalNormMatter_normId_fkey" FOREIGN KEY ("normId") REFERENCES "LegalNorm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalNormVersion" ADD CONSTRAINT "LegalNormVersion_normId_fkey" FOREIGN KEY ("normId") REFERENCES "LegalNorm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalNormVersion" ADD CONSTRAINT "LegalNormVersion_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "LegalNormVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalNormVersion" ADD CONSTRAINT "LegalNormVersion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LegalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalProvision" ADD CONSTRAINT "LegalProvision_normVersionId_fkey" FOREIGN KEY ("normVersionId") REFERENCES "LegalNormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalProvision" ADD CONSTRAINT "LegalProvision_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LegalProvision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalEmbedding" ADD CONSTRAINT "LegalEmbedding_provisionId_fkey" FOREIGN KEY ("provisionId") REFERENCES "LegalProvision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalApplicabilityRule" ADD CONSTRAINT "LegalApplicabilityRule_targetNormId_fkey" FOREIGN KEY ("targetNormId") REFERENCES "LegalNorm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalApplicabilityRule" ADD CONSTRAINT "LegalApplicabilityRule_targetNormVersionId_fkey" FOREIGN KEY ("targetNormVersionId") REFERENCES "LegalNormVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalApplicabilityRule" ADD CONSTRAINT "LegalApplicabilityRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LegalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalTransitionRule" ADD CONSTRAINT "LegalTransitionRule_fromNormId_fkey" FOREIGN KEY ("fromNormId") REFERENCES "LegalNorm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalTransitionRule" ADD CONSTRAINT "LegalTransitionRule_toNormId_fkey" FOREIGN KEY ("toNormId") REFERENCES "LegalNorm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalTransitionRule" ADD CONSTRAINT "LegalTransitionRule_fromNormVersionId_fkey" FOREIGN KEY ("fromNormVersionId") REFERENCES "LegalNormVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalTransitionRule" ADD CONSTRAINT "LegalTransitionRule_toNormVersionId_fkey" FOREIGN KEY ("toNormVersionId") REFERENCES "LegalNormVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalTransitionRule" ADD CONSTRAINT "LegalTransitionRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LegalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaseLegalContext" ADD CONSTRAINT "CaseLegalContext_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LegalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseLegalRegimeDecision" ADD CONSTRAINT "CaseLegalRegimeDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LegalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseLegalRegimeDecision" ADD CONSTRAINT "CaseLegalRegimeDecision_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "CaseLegalContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaseLegalRegimeDecision" ADD CONSTRAINT "CaseLegalRegimeDecision_applicabilityRuleId_fkey" FOREIGN KEY ("applicabilityRuleId") REFERENCES "LegalApplicabilityRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaseLegalRegimeDecision" ADD CONSTRAINT "CaseLegalRegimeDecision_transitionRuleId_fkey" FOREIGN KEY ("transitionRuleId") REFERENCES "LegalTransitionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaseLegalRegimeDecision" ADD CONSTRAINT "CaseLegalRegimeDecision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaseLegalRegimeDecision" ADD CONSTRAINT "CaseLegalRegimeDecision_overrideActorUserId_fkey" FOREIGN KEY ("overrideActorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaseLegalDecisionVersion" ADD CONSTRAINT "CaseLegalDecisionVersion_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "CaseLegalRegimeDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseLegalDecisionVersion" ADD CONSTRAINT "CaseLegalDecisionVersion_normVersionId_fkey" FOREIGN KEY ("normVersionId") REFERENCES "LegalNormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalRagCitation" ADD CONSTRAINT "LegalRagCitation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LegalCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalRagCitation" ADD CONSTRAINT "LegalRagCitation_chatLogId_fkey" FOREIGN KEY ("chatLogId") REFERENCES "ChatLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalRagCitation" ADD CONSTRAINT "LegalRagCitation_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "CaseLegalRegimeDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalRagCitation" ADD CONSTRAINT "LegalRagCitation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LegalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalRagCitation" ADD CONSTRAINT "LegalRagCitation_normId_fkey" FOREIGN KEY ("normId") REFERENCES "LegalNorm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalRagCitation" ADD CONSTRAINT "LegalRagCitation_normVersionId_fkey" FOREIGN KEY ("normVersionId") REFERENCES "LegalNormVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalRagCitation" ADD CONSTRAINT "LegalRagCitation_provisionId_fkey" FOREIGN KEY ("provisionId") REFERENCES "LegalProvision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
