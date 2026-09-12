import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

import TasksList from "./TasksList";

export default async function TasksPage() {
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

  const canCreateTask = hasPermission(
    session.user.role,
    "tasks.create"
  );

  return (
    <TasksList
      canCreateTask={canCreateTask}
    />
  );
}