/*
  Warnings:

  - You are about to drop the column `category` on the `FinanceDocument` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "FinanceDocument_firmId_category_idx";

-- AlterTable
ALTER TABLE "FinanceDocument" DROP COLUMN "category",
ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "FinanceFolder" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "parentFolderId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceFolder_firmId_idx" ON "FinanceFolder"("firmId");

-- CreateIndex
CREATE INDEX "FinanceFolder_parentFolderId_idx" ON "FinanceFolder"("parentFolderId");

-- CreateIndex
CREATE INDEX "FinanceFolder_firmId_name_idx" ON "FinanceFolder"("firmId", "name");

-- CreateIndex
CREATE INDEX "FinanceDocument_folderId_idx" ON "FinanceDocument"("folderId");

-- AddForeignKey
ALTER TABLE "FinanceFolder" ADD CONSTRAINT "FinanceFolder_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceFolder" ADD CONSTRAINT "FinanceFolder_parentFolderId_fkey" FOREIGN KEY ("parentFolderId") REFERENCES "FinanceFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocument" ADD CONSTRAINT "FinanceDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "FinanceFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
