"use client";

import { FormEvent, useRef, useState } from "react";

type UploadVersionFormProps = {
  documentId: string;
  currentVersion: number;
};

export default function UploadVersionForm({
  documentId,
  currentVersion,
}: UploadVersionFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!file) {
      setError("Please select a file.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("changeNote", changeNote);

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
        `Version ${
          data.version?.version ??
          currentVersion + 1
        } uploaded successfully.`
      );

      setFile(null);
      setChangeNote("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while uploading the version."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Upload New Version
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Upload a replacement or updated version of this
          document.
        </p>
      </div>

      {/* ================================================= */}
      {/* CURRENT VERSION */}
      {/* ================================================= */}

      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm font-medium text-blue-900">
          Current version
        </p>

        <p className="mt-1 text-lg font-bold text-blue-700">
          Version {currentVersion}
        </p>
      </div>

      {/* ================================================= */}
      {/* ERROR */}
      {/* ================================================= */}

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ================================================= */}
      {/* SUCCESS */}
      {/* ================================================= */}

      {success && (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* ================================================= */}
      {/* FORM */}
      {/* ================================================= */}

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5"
      >
        {/* ================================================= */}
        {/* FILE */}
        {/* ================================================= */}

        <div>
          <label
            htmlFor="version-file"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            New Document File
          </label>

          <input
            ref={fileInputRef}
            id="version-file"
            type="file"
            onChange={(event) => {
              setFile(
                event.target.files?.[0] ?? null
              );
            }}
            disabled={uploading}
            className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-sm text-slate-700 file:mr-4 file:border-0 file:bg-slate-100 file:px-4 file:py-3 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          />

          {file && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-900">
                {file.name}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          )}
        </div>

        {/* ================================================= */}
        {/* CHANGE NOTE */}
        {/* ================================================= */}

        <div>
          <label
            htmlFor="change-note"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Change Note
          </label>

          <textarea
            id="change-note"
            value={changeNote}
            onChange={(event) =>
              setChangeNote(event.target.value)
            }
            disabled={uploading}
            rows={4}
            placeholder="Describe what changed in this version..."
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
        </div>

        {/* ================================================= */}
        {/* ACTIONS */}
        {/* ================================================= */}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={uploading || !file}
            className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? "Uploading..."
              : `Upload Version ${
                  currentVersion + 1
                }`}
          </button>

          <button
            type="button"
            disabled={uploading}
            onClick={() => {
              setFile(null);
              setChangeNote("");
              setError("");
              setSuccess("");

              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </form>
    </section>
  );
}