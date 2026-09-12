import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export default async function NewTaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canCreateTask = hasPermission(
    session.user.role,
    "tasks.create"
  );

  if (!canCreateTask) {
    redirect("/dashboard/tasks");
  }

  return <>{children}</>;
}