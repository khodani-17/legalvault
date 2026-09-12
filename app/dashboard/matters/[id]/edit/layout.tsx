import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export default async function EditMatterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canUpdateMatter = hasPermission(
    session.user.role,
    "matters.update"
  );

  if (!canUpdateMatter) {
    redirect("/dashboard/matters");
  }

  return <>{children}</>;
}