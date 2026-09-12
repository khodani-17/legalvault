import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export default async function NewClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canCreateClients = hasPermission(
    session.user.role,
    "clients.create"
  );

  if (!canCreateClients) {
    redirect("/dashboard/clients");
  }

  return <>{children}</>;
}