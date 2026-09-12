import { Suspense } from "react";
import UploadDocumentForm from "./UploadDocumentForm";

export default function UploadDocumentPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 p-6">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
              <p className="text-slate-600">
                Loading upload form...
              </p>
            </div>
          </div>
        </main>
      }
    >
      <UploadDocumentForm />
    </Suspense>
  );
}