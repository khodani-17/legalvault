import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canViewUsers = hasPermission(
    session.user.role,
    "users.view"
  );

  if (!canViewUsers) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}