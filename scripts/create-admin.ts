import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined.");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const firmReferenceNumber = "FIRM-2026-000001";

  const firm = await prisma.firm.upsert({
    where: {
      referenceNumber: firmReferenceNumber,
    },
    update: {},
    create: {
      referenceNumber: firmReferenceNumber,
      name: "LegalVault Demo Law Firm",
    },
  });

  const password = "ChangeMe123!";

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: {
      email: "admin@legalvault.local",
    },
    update: {
      passwordHash,
      firmId: firm.id,
      role: UserRole.MANAGING_PARTNER,
      status: "ACTIVE",
    },
    create: {
      name: "System Administrator",
      email: "admin@legalvault.local",
      passwordHash,
      firmId: firm.id,
      role: UserRole.MANAGING_PARTNER,
      status: "ACTIVE",
    },
  });

  console.log("");
  console.log("====================================");
  console.log("LegalVault administrator created");
  console.log("====================================");
  console.log(`Firm: ${firm.name}`);
  console.log(`Firm Reference: ${firm.referenceNumber}`);
  console.log(`Name: ${user.name}`);
  console.log(`Email: ${user.email}`);
  console.log(`Password: ${password}`);
  console.log("====================================");
  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });