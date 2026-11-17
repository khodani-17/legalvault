import type { Prisma } from "../src/generated/prisma/client";

type Transaction = Prisma.TransactionClient;

type ReferenceType = "CLIENT";

const PREFIX: Record<ReferenceType, string> = {
  CLIENT: "CL",
};

export async function generateReferenceNumber(
  tx: Transaction,
  firmId: string,
  type: ReferenceType,
  year = new Date().getFullYear(),
): Promise<string> {
  const prefix = PREFIX[type];
  const referencePrefix = `${prefix}-${year}-`;

  // Create the counter if it does not exist.
  // Existing client references are checked before initialization.
  await tx.$executeRaw`
    INSERT INTO "ReferenceCounter"
      ("id", "firmId", "type", "year", "lastValue", "createdAt", "updatedAt")
    SELECT
      gen_random_uuid()::text,
      ${firmId},
      ${type},
      ${year},
      COALESCE(
        (
          SELECT MAX(
            CAST(
              SUBSTRING("referenceNumber" FROM ${referencePrefix.length + 1})
              AS INTEGER
            )
          )
          FROM "Client"
          WHERE "firmId" = ${firmId}
            AND "referenceNumber" ~ ${`^${referencePrefix}[0-9]+$`}
        ),
        0
      ),
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    ON CONFLICT ("firmId", "type", "year")
    DO NOTHING
  `;

  // Atomically increment the counter.
  const counter = await tx.referenceCounter.update({
    where: {
      firmId_type_year: {
        firmId,
        type,
        year,
      },
    },
    data: {
      lastValue: {
        increment: 1,
      },
    },
    select: {
      lastValue: true,
    },
  });

  return `${referencePrefix}${String(
    counter.lastValue,
  ).padStart(6, "0")}`;
}
