/*
  Warnings:

  - The values [CLIENT] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - Made the column `extension` on table `DocumentVersion` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mimeType` on table `DocumentVersion` required. This step will fail if there are existing NULL values in that column.
  - Made the column `originalName` on table `DocumentVersion` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'MANAGING_PARTNER', 'PARTNER', 'DIRECTOR', 'ATTORNEY', 'CANDIDATE_ATTORNEY', 'PARALEGAL', 'LEGAL_SECRETARY', 'ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'LEGAL_SECRETARY';
COMMIT;

-- AlterTable
ALTER TABLE "DocumentVersion" ALTER COLUMN "extension" SET NOT NULL,
ALTER COLUMN "mimeType" SET NOT NULL,
ALTER COLUMN "originalName" SET NOT NULL;
