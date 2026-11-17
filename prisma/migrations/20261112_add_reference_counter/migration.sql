-- CreateTable
CREATE TABLE "ReferenceCounter" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferenceCounter_firmId_idx" ON "ReferenceCounter"("firmId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceCounter_firmId_type_year_key" ON "ReferenceCounter"("firmId", "type", "year");

-- AddForeignKey
ALTER TABLE "ReferenceCounter" ADD CONSTRAINT "ReferenceCounter_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
