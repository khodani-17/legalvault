import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export default async function NewUserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canCreateUser = hasPermission(
    session.user.role,
    "users.create"
  );

  if (!canCreateUser) {
    redirect("/dashboard/users");
  }

  return <>{children}</>;
}