/*
  Add metadata to DocumentVersion safely.

  Existing DocumentVersion rows receive their metadata
  from the corresponding Document record.
*/

-- Step 1: Add the new columns as nullable.
ALTER TABLE "DocumentVersion"
ADD COLUMN "extension" TEXT,
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "originalName" TEXT;

-- Step 2: Populate existing versions from their parent documents.
UPDATE "DocumentVersion" AS dv
SET
  "extension" = d."extension",
  "mimeType" = d."mimeType",
  "originalName" = d."originalName"
FROM "Document" AS d
WHERE dv."documentId" = d."id";