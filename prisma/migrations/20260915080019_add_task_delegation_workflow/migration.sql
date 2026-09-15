-- CreateEnum
CREATE TYPE "TaskReportOutcome" AS ENUM ('COMPLETED', 'PARTIALLY_COMPLETED', 'UNABLE_TO_COMPLETE', 'AWAITING_RESPONSE');

-- CreateEnum
CREATE TYPE "AssistanceStatus" AS ENUM ('PENDING', 'RESPONDED', 'RESOLVED');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "delegatedById" TEXT,
ADD COLUMN     "delegatedOnBehalfOfId" TEXT,
ADD COLUMN     "reportOutcome" "TaskReportOutcome",
ADD COLUMN     "reportReviewedAt" TIMESTAMP(3),
ADD COLUMN     "reportSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "requiresReport" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TaskNote" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskReport" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "outcome" "TaskReportOutcome" NOT NULL,
    "report" TEXT NOT NULL,
    "nextAction" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,

    CONSTRAINT "TaskReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssistanceRequest" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "response" TEXT,
    "status" "AssistanceStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAssistanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskActivity" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskNote_taskId_idx" ON "TaskNote"("taskId");

-- CreateIndex
CREATE INDEX "TaskNote_authorId_idx" ON "TaskNote"("authorId");

-- CreateIndex
CREATE INDEX "TaskNote_createdAt_idx" ON "TaskNote"("createdAt");

-- CreateIndex
CREATE INDEX "TaskReport_taskId_idx" ON "TaskReport"("taskId");

-- CreateIndex
CREATE INDEX "TaskReport_submittedById_idx" ON "TaskReport"("submittedById");

-- CreateIndex
CREATE INDEX "TaskReport_reviewedById_idx" ON "TaskReport"("reviewedById");

-- CreateIndex
CREATE INDEX "TaskReport_submittedAt_idx" ON "TaskReport"("submittedAt");

-- CreateIndex
CREATE INDEX "TaskAssistanceRequest_taskId_idx" ON "TaskAssistanceRequest"("taskId");

-- CreateIndex
CREATE INDEX "TaskAssistanceRequest_requestedById_idx" ON "TaskAssistanceRequest"("requestedById");

-- CreateIndex
CREATE INDEX "TaskAssistanceRequest_status_idx" ON "TaskAssistanceRequest"("status");

-- CreateIndex
CREATE INDEX "TaskAssistanceRequest_createdAt_idx" ON "TaskAssistanceRequest"("createdAt");

-- CreateIndex
CREATE INDEX "TaskActivity_taskId_idx" ON "TaskActivity"("taskId");

-- CreateIndex
CREATE INDEX "TaskActivity_userId_idx" ON "TaskActivity"("userId");

-- CreateIndex
CREATE INDEX "TaskActivity_createdAt_idx" ON "TaskActivity"("createdAt");

-- CreateIndex
CREATE INDEX "Task_createdById_idx" ON "Task"("createdById");

-- CreateIndex
CREATE INDEX "Task_delegatedById_idx" ON "Task"("delegatedById");

-- CreateIndex
CREATE INDEX "Task_delegatedOnBehalfOfId_idx" ON "Task"("delegatedOnBehalfOfId");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_firmId_status_idx" ON "Task"("firmId", "status");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_delegatedById_fkey" FOREIGN KEY ("delegatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_delegatedOnBehalfOfId_fkey" FOREIGN KEY ("delegatedOnBehalfOfId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskNote" ADD CONSTRAINT "TaskNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskNote" ADD CONSTRAINT "TaskNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReport" ADD CONSTRAINT "TaskReport_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReport" ADD CONSTRAINT "TaskReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReport" ADD CONSTRAINT "TaskReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssistanceRequest" ADD CONSTRAINT "TaskAssistanceRequest_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssistanceRequest" ADD CONSTRAINT "TaskAssistanceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
