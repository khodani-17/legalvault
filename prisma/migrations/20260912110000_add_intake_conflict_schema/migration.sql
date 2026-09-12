-- Existing LegalVault Intake / Conflict Checking schema
-- This migration represents schema that already exists in the database.
-- It must be marked as applied and must NOT be executed against the existing database.

CREATE TYPE "public"."ConflictCheckStatus" AS ENUM (
    'NOT_CHECKED',
    'CLEAR',
    'POTENTIAL_CONFLICT',
    'CONFLICT_DETECTED',
    'REQUIRES_REVIEW'
);

CREATE TYPE "public"."IntakePriority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);

CREATE TYPE "public"."IntakeStatus" AS ENUM (
    'NEW',
    'CONFLICT_CHECK_PENDING',
    'CONFLICT_REVIEW',
    'APPROVED',
    'REJECTED',
    'CONVERTED',
    'CLOSED'
);

CREATE TABLE "public"."MatterIntake" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "prospectiveClientName" TEXT NOT NULL,
    "clientId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "practiceArea" TEXT,
    "description" TEXT,
    "opposingParties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedParties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT,
    "priority" "public"."IntakePriority" NOT NULL DEFAULT 'MEDIUM',
    "conflictCheckRequired" BOOLEAN NOT NULL DEFAULT true,
    "conflictStatus" "public"."ConflictCheckStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "status" "public"."IntakeStatus" NOT NULL DEFAULT 'NEW',
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "conflictCheckedAt" TIMESTAMP(3),
    "conflictCheckedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterIntake_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ConflictCheck" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "intakeId" TEXT,
    "clientId" TEXT,
    "checkedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" "public"."ConflictCheckStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "searchTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchedMatterIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchedClientIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConflictCheck_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."Matter"
ADD COLUMN "intakeId" TEXT;

CREATE UNIQUE INDEX "Matter_intakeId_key"
ON "public"."Matter"("intakeId" ASC);

CREATE INDEX "MatterIntake_assignedToId_idx"
ON "public"."MatterIntake"("assignedToId" ASC);

CREATE INDEX "MatterIntake_clientId_idx"
ON "public"."MatterIntake"("clientId" ASC);

CREATE INDEX "MatterIntake_createdAt_idx"
ON "public"."MatterIntake"("createdAt" ASC);

CREATE INDEX "MatterIntake_firmId_conflictStatus_idx"
ON "public"."MatterIntake"("firmId" ASC, "conflictStatus" ASC);

CREATE INDEX "MatterIntake_firmId_idx"
ON "public"."MatterIntake"("firmId" ASC);

CREATE INDEX "MatterIntake_firmId_priority_idx"
ON "public"."MatterIntake"("firmId" ASC, "priority" ASC);

CREATE INDEX "MatterIntake_firmId_status_idx"
ON "public"."MatterIntake"("firmId" ASC, "status" ASC);

CREATE INDEX "ConflictCheck_checkedById_idx"
ON "public"."ConflictCheck"("checkedById" ASC);

CREATE INDEX "ConflictCheck_clientId_idx"
ON "public"."ConflictCheck"("clientId" ASC);

CREATE INDEX "ConflictCheck_createdAt_idx"
ON "public"."ConflictCheck"("createdAt" ASC);

CREATE INDEX "ConflictCheck_firmId_idx"
ON "public"."ConflictCheck"("firmId" ASC);

CREATE INDEX "ConflictCheck_firmId_status_idx"
ON "public"."ConflictCheck"("firmId" ASC, "status" ASC);

CREATE INDEX "ConflictCheck_intakeId_idx"
ON "public"."ConflictCheck"("intakeId" ASC);

CREATE INDEX "ConflictCheck_reviewedById_idx"
ON "public"."ConflictCheck"("reviewedById" ASC);

ALTER TABLE "public"."MatterIntake"
ADD CONSTRAINT "MatterIntake_assignedToId_fkey"
FOREIGN KEY ("assignedToId")
REFERENCES "public"."User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "public"."MatterIntake"
ADD CONSTRAINT "MatterIntake_clientId_fkey"
FOREIGN KEY ("clientId")
REFERENCES "public"."Client"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "public"."MatterIntake"
ADD CONSTRAINT "MatterIntake_conflictCheckedById_fkey"
FOREIGN KEY ("conflictCheckedById")
REFERENCES "public"."User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "public"."MatterIntake"
ADD CONSTRAINT "MatterIntake_createdById_fkey"
FOREIGN KEY ("createdById")
REFERENCES "public"."User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "public"."MatterIntake"
ADD CONSTRAINT "MatterIntake_firmId_fkey"
FOREIGN KEY ("firmId")
REFERENCES "public"."Firm"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "public"."ConflictCheck"
ADD CONSTRAINT "ConflictCheck_checkedById_fkey"
FOREIGN KEY ("checkedById")
REFERENCES "public"."User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "public"."ConflictCheck"
ADD CONSTRAINT "ConflictCheck_clientId_fkey"
FOREIGN KEY ("clientId")
REFERENCES "public"."Client"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "public"."ConflictCheck"
ADD CONSTRAINT "ConflictCheck_firmId_fkey"
FOREIGN KEY ("firmId")
REFERENCES "public"."Firm"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "public"."ConflictCheck"
ADD CONSTRAINT "ConflictCheck_intakeId_fkey"
FOREIGN KEY ("intakeId")
REFERENCES "public"."MatterIntake"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "public"."ConflictCheck"
ADD CONSTRAINT "ConflictCheck_reviewedById_fkey"
FOREIGN KEY ("reviewedById")
REFERENCES "public"."User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "public"."Matter"
ADD CONSTRAINT "Matter_intakeId_fkey"
FOREIGN KEY ("intakeId")
REFERENCES "public"."MatterIntake"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;