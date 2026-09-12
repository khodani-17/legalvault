import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export default async function NewMatterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canCreateMatter = hasPermission(
    session.user.role,
    "matters.create"
  );

  if (!canCreateMatter) {
    redirect("/dashboard/matters");
  }

  return <>{children}</>;
}