import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export default async function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canViewDocuments = hasPermission(
    session.user.role,
    "documents.view"
  );

  if (!canViewDocuments) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}