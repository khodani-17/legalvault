import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function NotificationSettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      firmId: true,
    },
  });

  if (!user || user.status !== "ACTIVE" || !user.firmId) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">

        <div className="mb-8">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
            Notifications
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Review how LegalVault keeps you informed about important activity.
          </p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-start gap-4">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <Bell className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                LegalVault Notifications
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                LegalVault uses in-app notifications to keep users informed
                about important activities affecting their work and matters.
              </p>
            </div>

          </div>

          <div className="mt-8 space-y-4">

            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

              <div>
                <p className="font-medium text-slate-900">
                  Tasks and deadlines
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Notifications can be generated when tasks or deadlines are
                  assigned, completed, reopened or reassigned.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

              <div>
                <p className="font-medium text-slate-900">
                  Matter access
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Matter access requests, approvals, rejections and permission
                  changes may generate notifications.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

              <div>
                <p className="font-medium text-slate-900">
                  Documents
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Relevant users may receive notifications when documents or
                  new document versions are uploaded to matters they can view.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />

              <div>
                <p className="font-medium text-slate-900">
                  Security notifications
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Security-related events may generate notifications where
                  appropriate.
                </p>
              </div>
            </div>

          </div>

        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">
            Notification Centre
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your current notifications can be accessed from the notification
            bell in the LegalVault dashboard.
          </p>

          <div className="mt-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Go to Dashboard
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}