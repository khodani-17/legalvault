CREATE UNIQUE INDEX "MatterAccessRequest_pending_unique"
ON "MatterAccessRequest" ("matterId", "requesterId")
WHERE "status" = 'PENDING';