import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export default async function EditUserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canUpdateUser = hasPermission(
    session.user.role,
    "users.update"
  );

  if (!canUpdateUser) {
    redirect("/dashboard/users");
  }

  return <>{children}</>;
}