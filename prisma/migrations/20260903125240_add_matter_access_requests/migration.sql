-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MatterAccessRequest" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reason" TEXT NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatterAccessRequest_firmId_idx" ON "MatterAccessRequest"("firmId");

-- CreateIndex
CREATE INDEX "MatterAccessRequest_matterId_idx" ON "MatterAccessRequest"("matterId");

-- CreateIndex
CREATE INDEX "MatterAccessRequest_requesterId_idx" ON "MatterAccessRequest"("requesterId");

-- CreateIndex
CREATE INDEX "MatterAccessRequest_reviewedById_idx" ON "MatterAccessRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "MatterAccessRequest_firmId_status_idx" ON "MatterAccessRequest"("firmId", "status");

-- AddForeignKey
ALTER TABLE "MatterAccessRequest" ADD CONSTRAINT "MatterAccessRequest_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterAccessRequest" ADD CONSTRAINT "MatterAccessRequest_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterAccessRequest" ADD CONSTRAINT "MatterAccessRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterAccessRequest" ADD CONSTRAINT "MatterAccessRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
