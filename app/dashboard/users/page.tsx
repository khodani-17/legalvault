import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

import UsersList from "./UsersList";

export default async function UsersPage() {
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

  const canCreateUser = hasPermission(
    session.user.role,
    "users.create"
  );

  const canUpdateUser = hasPermission(
    session.user.role,
    "users.update"
  );

  const canDeactivateUser = hasPermission(
    session.user.role,
    "users.deactivate"
  );

  return (
    <UsersList
      canCreateUser={canCreateUser}
      canUpdateUser={canUpdateUser}
      canDeactivateUser={canDeactivateUser}
    />
  );
}