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
  const email = "finance@test.local";

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      email: true,
      firmId: true,
    },
  });

  if (!user) {
    console.log("USER NOT FOUND");
    return;
  }

  const now = new Date();

  const trialEndsAt = new Date(
    now.getTime() + 14 * 24 * 60 * 60 * 1000
  );

  const subscription = await prisma.subscription.update({
    where: {
      firmId: user.firmId,
    },
    data: {
      plan: "TRIAL",
      status: "TRIAL",
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
      trialEndsAt,
      cancelledAt: null,
      provider: null,
      providerCustomerId: null,
      providerSubscriptionId: null,
    },
  });

  console.log("\nTRIAL ACTIVATED");
  console.log({
    email: user.email,
    plan: subscription.plan,
    status: subscription.status,
    trialEndsAt: subscription.trialEndsAt,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });