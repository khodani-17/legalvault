import { prisma } from "@/lib/prisma";

const MATTER_MANAGEMENT_ROLES = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ADMIN",
] as const;

export function canAccessAllFirmMatters(role: string): boolean {
  return MATTER_MANAGEMENT_ROLES.includes(
    role as (typeof MATTER_MANAGEMENT_ROLES)[number],
  );
}

export async function userCanAccessMatter({
  matterId,
  userId,
  firmId,
  role,
}: {
  matterId: string;
  userId: string;
  firmId: string;
  role: string;
}): Promise<boolean> {
  const matter = await prisma.matter.findFirst({
    where: {
      id: matterId,
      firmId,
    },
    select: {
      id: true,
      users: {
        where: {
          userId,
          canView: true,
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (!matter) {
    return false;
  }

  if (canAccessAllFirmMatters(role)) {
    return true;
  }

  return matter.users.length > 0;
}