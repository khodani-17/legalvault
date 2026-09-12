import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

import UserProfile from "./UserProfile";

export default async function UserPage() {
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

  const canUpdateUser = hasPermission(
    session.user.role,
    "users.update"
  );

  const canDeactivateUser = hasPermission(
    session.user.role,
    "users.deactivate"
  );

  return (
    <UserProfile
      canUpdateUser={canUpdateUser}
      canDeactivateUser={canDeactivateUser}
    />
  );
}
