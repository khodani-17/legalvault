import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export default async function MattersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canViewMatters = hasPermission(
    session.user.role,
    "matters.view"
  );

  if (!canViewMatters) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}