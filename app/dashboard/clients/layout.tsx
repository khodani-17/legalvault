import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export default async function ClientsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canViewClients = hasPermission(
    session.user.role,
    "clients.view"
  );

  if (!canViewClients) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}