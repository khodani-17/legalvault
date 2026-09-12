import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export default async function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canViewAudit = hasPermission(
    session.user.role,
    "audit.view"
  );

  if (!canViewAudit) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}