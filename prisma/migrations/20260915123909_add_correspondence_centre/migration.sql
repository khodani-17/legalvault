-- CreateEnum
CREATE TYPE "CorrespondenceDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "CorrespondenceType" AS ENUM ('LETTER', 'COURT_NOTICE', 'CLIENT_EMAIL', 'DEMAND', 'NOTICE', 'OPPOSING_ATTORNEY', 'CLIENT_CORRESPONDENCE', 'COURT_CORRESPONDENCE', 'FOLLOW_UP', 'OTHER');

-- CreateEnum
CREATE TYPE "CorrespondenceStatus" AS ENUM ('RECEIVED', 'ASSIGNED', 'ACTION_REQUIRED', 'RESPONDED', 'CLOSED');

-- CreateTable
CREATE TABLE "Correspondence" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "matterId" TEXT,
    "clientId" TEXT,
    "direction" "CorrespondenceDirection" NOT NULL,
    "correspondenceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sender" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "type" "CorrespondenceType" NOT NULL,
    "status" "CorrespondenceStatus" NOT NULL DEFAULT 'RECEIVED',
    "responsibleUserId" TEXT,
    "responseRequired" BOOLEAN NOT NULL DEFAULT false,
    "responseDeadline" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Correspondence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrespondenceAttachment" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "correspondenceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrespondenceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Correspondence_firmId_idx" ON "Correspondence"("firmId");

-- CreateIndex
CREATE INDEX "Correspondence_matterId_idx" ON "Correspondence"("matterId");

-- CreateIndex
CREATE INDEX "Correspondence_clientId_idx" ON "Correspondence"("clientId");

-- CreateIndex
CREATE INDEX "Correspondence_responsibleUserId_idx" ON "Correspondence"("responsibleUserId");

-- CreateIndex
CREATE INDEX "Correspondence_createdById_idx" ON "Correspondence"("createdById");

-- CreateIndex
CREATE INDEX "Correspondence_status_idx" ON "Correspondence"("status");

-- CreateIndex
CREATE INDEX "Correspondence_direction_idx" ON "Correspondence"("direction");

-- CreateIndex
CREATE INDEX "Correspondence_type_idx" ON "Correspondence"("type");

-- CreateIndex
CREATE INDEX "Correspondence_correspondenceDate_idx" ON "Correspondence"("correspondenceDate");

-- CreateIndex
CREATE INDEX "Correspondence_responseDeadline_idx" ON "Correspondence"("responseDeadline");

-- CreateIndex
CREATE INDEX "Correspondence_firmId_status_idx" ON "Correspondence"("firmId", "status");

-- CreateIndex
CREATE INDEX "Correspondence_firmId_responseDeadline_idx" ON "Correspondence"("firmId", "responseDeadline");

-- CreateIndex
CREATE INDEX "CorrespondenceAttachment_firmId_idx" ON "CorrespondenceAttachment"("firmId");

-- CreateIndex
CREATE INDEX "CorrespondenceAttachment_correspondenceId_idx" ON "CorrespondenceAttachment"("correspondenceId");

-- CreateIndex
CREATE INDEX "CorrespondenceAttachment_documentId_idx" ON "CorrespondenceAttachment"("documentId");

-- CreateIndex
CREATE INDEX "CorrespondenceAttachment_addedById_idx" ON "CorrespondenceAttachment"("addedById");

-- CreateIndex
CREATE UNIQUE INDEX "CorrespondenceAttachment_correspondenceId_documentId_key" ON "CorrespondenceAttachment"("correspondenceId", "documentId");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "Task_firmId_dueDate_idx" ON "Task"("firmId", "dueDate");

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrespondenceAttachment" ADD CONSTRAINT "CorrespondenceAttachment_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrespondenceAttachment" ADD CONSTRAINT "CorrespondenceAttachment_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrespondenceAttachment" ADD CONSTRAINT "CorrespondenceAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrespondenceAttachment" ADD CONSTRAINT "CorrespondenceAttachment_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
