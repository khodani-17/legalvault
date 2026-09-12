-- CreateEnum
CREATE TYPE "DeadlineType" AS ENUM ('COURT_DATE', 'FILING_DEADLINE', 'PRESCRIPTION_DATE', 'NOTICE_PERIOD', 'CONSULTATION', 'DISCOVERY_DEADLINE', 'OPPOSING_PARTY_DEADLINE', 'INTERNAL_REVIEW');

-- CreateEnum
CREATE TYPE "DeadlinePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DeadlineStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DEADLINE';

-- CreateTable
CREATE TABLE "Deadline" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "DeadlineType" NOT NULL,
    "priority" "DeadlinePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "DeadlineStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "isCalculated" BOOLEAN NOT NULL DEFAULT false,
    "sourceDate" TIMESTAMP(3),
    "calculationNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deadline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deadline_firmId_idx" ON "Deadline"("firmId");

-- CreateIndex
CREATE INDEX "Deadline_matterId_idx" ON "Deadline"("matterId");

-- CreateIndex
CREATE INDEX "Deadline_assignedToId_idx" ON "Deadline"("assignedToId");

-- CreateIndex
CREATE INDEX "Deadline_createdById_idx" ON "Deadline"("createdById");

-- CreateIndex
CREATE INDEX "Deadline_dueDate_idx" ON "Deadline"("dueDate");

-- CreateIndex
CREATE INDEX "Deadline_firmId_dueDate_idx" ON "Deadline"("firmId", "dueDate");

-- CreateIndex
CREATE INDEX "Deadline_firmId_status_idx" ON "Deadline"("firmId", "status");

-- CreateIndex
CREATE INDEX "Deadline_matterId_dueDate_idx" ON "Deadline"("matterId", "dueDate");

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
