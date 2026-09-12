import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export default async function EditTaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canUpdateTask = hasPermission(
    session.user.role,
    "tasks.update"
  );

  if (!canUpdateTask) {
    redirect("/dashboard/tasks");
  }

  return <>{children}</>;
}