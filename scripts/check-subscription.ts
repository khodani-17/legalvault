import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

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
  const email = process.argv[2];

  if (!email) {
    console.log("Usage: npx tsx scripts/check-subscription.ts email@example.com");
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      email: true,
      name: true,
      firmId: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    console.log("USER NOT FOUND");
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: {
      firmId: user.firmId,
    },
    select: {
      id: true,
      plan: true,
      status: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      provider: true,
      providerCustomerId: true,
      providerSubscriptionId: true,
    },
  });

  console.log("\nUSER:");
  console.log(user);

  console.log("\nSUBSCRIPTION:");
  console.log(subscription);

  if (subscription?.trialEndsAt) {
    console.log("\nTRIAL CHECK:");
    console.log(
      subscription.trialEndsAt > new Date()
        ? "TRIAL IS ACTIVE"
        : "TRIAL HAS EXPIRED"
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });