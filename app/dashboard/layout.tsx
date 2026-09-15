import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  BriefcaseBusiness,
  FileText,
  CheckSquare,
  CalendarClock,
  CalendarDays,
  Building2,
  ShieldCheck,
  WalletCards,
  BarChart3,
  Settings,
  Mail,
} from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import AuthSessionProvider from "@/app/providers/SessionProvider";
import NotificationBell from "./components/NotificationBell";
import LogoutButton from "./components/LogoutButton";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // ----------------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------------

  if (!session?.user?.id) {
    redirect("/login");
  }

  // ----------------------------------------------------------
  // GET CURRENT USER
  // ----------------------------------------------------------

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      role: true,
      status: true,
      firmId: true,
    },
  });

  if (!user || user.status !== "ACTIVE" || !user.firmId) {
    redirect("/login");
  }

  // ----------------------------------------------------------
  // CHECK FIRM SUBSCRIPTION
  // ----------------------------------------------------------

  const subscription = await prisma.subscription.findFirst({
    where: {
      firmId: user.firmId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      status: true,
      plan: true,
      trialEndsAt: true,
    },
  });

  // ----------------------------------------------------------
  // SUBSCRIPTION / FREE TRIAL ACCESS
  // ----------------------------------------------------------

  if (!subscription) {
    redirect("/signup/payment");
  }

  // ----------------------------------------------------------
  // PAID SUBSCRIPTION
  // ----------------------------------------------------------

  const isActiveSubscription =
    subscription.status === "ACTIVE";

  // ----------------------------------------------------------
  // FREE TRIAL
  // ----------------------------------------------------------

  const isActiveTrial =
    subscription.status === "TRIAL" &&
    subscription.plan === "TRIAL" &&
    !!subscription.trialEndsAt &&
    subscription.trialEndsAt > new Date();

  // ----------------------------------------------------------
  // ACCESS DECISION
  // ----------------------------------------------------------

  if (!isActiveSubscription && !isActiveTrial) {
    redirect("/signup/payment");
  }

  // ----------------------------------------------------------
  // ROLE / PERMISSIONS
  // ----------------------------------------------------------

  const role = user.role ?? "";

  const isFinanceUser = role === "FINANCE";

  const canViewDashboard = hasPermission(
    role,
    "dashboard.view",
  );

  const canViewAudit = hasPermission(
    role,
    "audit.view",
  );

  const canViewBusinessIntelligence =
    canViewDashboard;

  const canViewCalendar =
    hasPermission(role, "tasks.view") ||
    hasPermission(role, "deadlines.view");

  const canViewClients = hasPermission(
    role,
    "clients.view",
  );

  const canViewCorrespondence = hasPermission(
    role,
    "correspondence.view",
  );

  const canViewDeadlines = hasPermission(
    role,
    "deadlines.view",
  );

  const canViewDocuments = hasPermission(
    role,
    "documents.view",
  );

  const canViewMatters = hasPermission(
    role,
    "matters.view",
  );

  const canViewTasks = hasPermission(
    role,
    "tasks.view",
  );

  const canViewUsers = hasPermission(
    role,
    "users.view",
  );

  // ----------------------------------------------------------
  // DASHBOARD
  // ----------------------------------------------------------

  return (
    <AuthSessionProvider>
      <div className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen">

          {/* ------------------------------------------------
              SIDEBAR
          ------------------------------------------------ */}

          <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-slate-900 text-white md:block">
            <div className="flex h-screen flex-col">

              {/* BRAND */}

              <div className="shrink-0 border-b border-slate-800 px-6 py-6">
                <Link
                  href="/dashboard"
                  className="text-xl font-bold tracking-tight"
                >
                  LegalVault
                </Link>

                <p className="mt-1 text-xs text-slate-400">
                  Legal Document Management
                </p>
              </div>

              {/* NAVIGATION */}

              <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700">
                <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Main Menu
                </p>

                <div className="space-y-1">

                  {/* ------------------------------------------------
                      AUDIT TRAIL
                  ------------------------------------------------ */}

                  {canViewAudit && (
                    <Link
                      href="/dashboard/audit"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      <ShieldCheck className="h-5 w-5 shrink-0" />
                      Audit Trail
                    </Link>
                  )}

                  {/* ------------------------------------------------
                      BUSINESS INTELLIGENCE
                  ------------------------------------------------ */}

                  {canViewBusinessIntelligence && (
                    <Link
                      href="/dashboard/business-intelligence"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      <BarChart3 className="h-5 w-5 shrink-0" />
                      Business Intelligence
                    </Link>
                  )}

                  {/* ------------------------------------------------
                      CALENDAR
                  ------------------------------------------------ */}

                  {canViewCalendar && (
                    <Link
                      href="/dashboard/calendar"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      <CalendarDays className="h-5 w-5 shrink-0" />
                      Calendar
                    </Link>
                  )}

                  {/* ------------------------------------------------
                      CLIENTS
                  ------------------------------------------------ */}

                  {canViewClients && (
                    <Link
                      href="/dashboard/clients"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      <Users className="h-5 w-5 shrink-0" />
                      Clients
                    </Link>
                  )}

                  {/* ------------------------------------------------
                      CORRESPONDENCE
                  ------------------------------------------------ */}

                  {canViewCorrespondence && (
                    <Link
                      href="/dashboard/correspondence"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      <Mail className="h-5 w-5 shrink-0" />
                      Correspondence
                    </Link>
                  )}

                  {/* ------------------------------------------------
                      DASHBOARD
                  ------------------------------------------------ */}

                  {canViewDashboard && (
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      <LayoutDashboard className="h-5 w-5 shrink-0" />
                      Dashboard
                    </Link>
                  )}

                  {/* ------------------------------------------------
                      DEADLINES
                  ------------------------------------------------ */}

                  {canViewDeadlines && (
                    <Link
                      href="/dashboard/deadlines"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      <CalendarClock className="h-5 w-5 shrink-0" />
                      Deadlines
                    </Link>
                  )}

                  {/* ------------------------------------------------
                      DOCUMENTS
                  ------------------------------------------------ */}

                  {canViewDocuments && (
                    <Link
                      href="/dashboard/documents"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      <FileText className="h-5 w-5 shrink-0" />
                      Documents
                    </Link>
                  )}

                  {/* ------------------------------------------------
                      FINANCE
                  ------------------------------------------------ */}

                  {isFinanceUser && (
                    <Link
                      href="/dashboard/finance"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      <WalletCards className="h-5 w-5 shrink-0" />
                      Finance
                    </Link>
                  )}

                  {/* ------------------------------------------------
                      FIRM PROFILE
                  ------------------------------------------------ */}

                  <Link
                    href="/dashboard/firm"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                  >
                    <Building2 className="h-5 w-5 shrink-0" />
                    Firm Profile
                  </Link>

                  {/* ------------------------------------------------
                      MATTERS
                  ------------------------------------------------ */}

                  {canViewMatters && (
                    <Link
                      href="/dashboard/matters"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      <BriefcaseBusiness className="h-5 w-5 shrink-0" />
                      Matters
                    </Link>
                  )}

                  {/* ------------------------------------------------
                      SETTINGS
                  ------------------------------------------------ */}

                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                  >
                    <Settings className="h-5 w-5 shrink-0" />
                    Settings
                  </Link>

                  {/* ------------------------------------------------
                      TASKS
                  ------------------------------------------------ */}

                  {canViewTasks && (
                    <Link
                      href="/dashboard/tasks"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      <CheckSquare className="h-5 w-5 shrink-0" />
                      Tasks
                    </Link>
                  )}

                  {/* ------------------------------------------------
                      USERS
                  ------------------------------------------------ */}

                  {canViewUsers && (
                    <Link
                      href="/dashboard/users"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      <Users className="h-5 w-5 shrink-0" />
                      Users
                    </Link>
                  )}

                </div>
              </nav>

              {/* ------------------------------------------------
                  LOGOUT / FOOTER
              ------------------------------------------------ */}

              <div className="shrink-0 border-t border-slate-800 px-4 py-4">
                <LogoutButton />

                <p className="mt-3 px-3 text-xs text-slate-500">
                  LegalVault
                </p>
              </div>

            </div>
          </aside>

          {/* ------------------------------------------------
              MAIN CONTENT
          ------------------------------------------------ */}

          <div className="min-w-0 flex-1">

            {/* DESKTOP HEADER */}

            <header className="hidden items-center justify-end border-b border-slate-200 bg-white px-6 py-3 md:flex">
              <NotificationBell />
            </header>

            {/* MOBILE HEADER */}

            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 md:hidden">
              <Link
                href="/dashboard"
                className="text-lg font-bold text-slate-900"
              >
                LegalVault
              </Link>

              <NotificationBell />
            </header>

            {children}

          </div>
        </div>
      </div>
    </AuthSessionProvider>
  );
}