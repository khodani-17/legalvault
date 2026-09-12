"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type UploadDocumentVersionFormProps = {
  documentId: string;
  currentVersion: number;
};

export default function UploadDocumentVersionForm({
  documentId,
  currentVersion,
}: UploadDocumentVersionFormProps) {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile =
      event.target.files?.[0] || null;

    setFile(selectedFile);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!file) {
      setError("Please select a document file.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);

      formData.append(
        "changeNote",
        changeNote.trim()
      );

      const response = await fetch(
        `/api/documents/${documentId}/versions`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to upload document version."
        );
      }

      setSuccess(
        `Version ${data.version.version} uploaded successfully.`
      );

      setFile(null);
      setChangeNote("");

      const fileInput =
        document.getElementById(
          "document-version-file"
        ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
    >
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Upload New Version
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Current version: Version {currentVersion}
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="mt-6 space-y-6">

        <div>
          <label
            htmlFor="document-version-file"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            New Document File *
          </label>

          <input
            id="document-version-file"
            type="file"
            required
            onChange={handleFileChange}
            className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm"
          />

          {file && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-900">
                {file.name}
              </p>

              <p className="mt-1 text-slate-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="change-note"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Change Note
          </label>

          <textarea
            id="change-note"
            value={changeNote}
            onChange={(event) =>
              setChangeNote(event.target.value)
            }
            rows={4}
            placeholder="e.g. Updated medical report and supporting documents."
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />

          <p className="mt-1 text-xs text-slate-500">
            Explain what changed in this version.
          </p>
        </div>

      </div>

      <div className="mt-8 flex justify-end gap-3">

        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Uploading..."
            : `Upload Version ${currentVersion + 1}`}
        </button>

      </div>
    </form>
  );
}