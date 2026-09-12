import Link from "next/link";
import { Suspense } from "react";
import UploadDocumentForm from "../upload/UploadDocumentForm";

function UploadDocumentFormLoading() {
  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <div className="animate-pulse space-y-6">
        <div className="h-5 w-32 rounded bg-slate-200" />
        <div className="h-12 w-full rounded-lg bg-slate-200" />

        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-12 rounded-lg bg-slate-200" />
          <div className="h-12 rounded-lg bg-slate-200" />
          <div className="h-12 rounded-lg bg-slate-200 md:col-span-2" />
          <div className="h-12 rounded-lg bg-slate-200 md:col-span-2" />
          <div className="h-32 rounded-xl bg-slate-200 md:col-span-2" />
        </div>
      </div>
    </div>
  );
}

export default function NewDocumentPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div className="mb-8">

          <Link
            href="/dashboard/documents"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            ← Back to Documents
          </Link>

          <p className="mt-6 text-sm font-medium text-slate-500">
            Document Management
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Upload Document
          </h1>

          <p className="mt-2 text-slate-600">
            Add a legal document to a matter and optionally
            assign it to a folder.
          </p>

        </div>

        {/* ================================================= */}
        {/* UPLOAD FORM */}
        {/* ================================================= */}

        <Suspense fallback={<UploadDocumentFormLoading />}>
          <UploadDocumentForm />
        </Suspense>

      </div>
    </main>
  );
}