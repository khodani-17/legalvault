import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export default async function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canViewTasks = hasPermission(
    session.user.role,
    "tasks.view"
  );

  if (!canViewTasks) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}