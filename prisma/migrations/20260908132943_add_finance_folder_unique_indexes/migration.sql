-- Prevent duplicate root Finance folder names within a firm.
CREATE UNIQUE INDEX "FinanceFolder_root_name_unique"
ON "FinanceFolder" ("firmId", "name")
WHERE "parentFolderId" IS NULL;

-- Prevent duplicate child Finance folder names under the same parent.
CREATE UNIQUE INDEX "FinanceFolder_parent_name_unique"
ON "FinanceFolder" ("firmId", "parentFolderId", "name")
WHERE "parentFolderId" IS NOT NULL;