"use client";

import { useEffect, useState } from "react";

type Folder = {
  id: string;
  name: string;
  createdAt: string;
};

type FolderManagerProps = {
  matterId: string;
  canCreateFolder: boolean;
};

export default function FolderManager({
  matterId,
  canCreateFolder,
}: FolderManagerProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function loadFolders() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/folders?matterId=${encodeURIComponent(matterId)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load folders."
        );
      }

      setFolders(data.folders || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load folders."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFolders();
  }, [matterId]);

  async function createFolder(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canCreateFolder) {
      setError(
        "You do not have permission to create folders."
      );
      return;
    }

    const folderName = name.trim();

    if (!folderName) {
      setError("Please enter a folder name.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const response = await fetch("/api/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matterId,
          name: folderName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create folder."
        );
      }

      setFolders((current) =>
        [...current, data.folder].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setName("");
      setShowForm(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to create folder."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Folders
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Organise documents within this matter.
          </p>
        </div>

        {canCreateFolder && (
          <button
            type="button"
            onClick={() => {
              setShowForm((current) => !current);
              setError("");
            }}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {showForm ? "Cancel" : "+ New Folder"}
          </button>
        )}
      </div>

      {showForm && canCreateFolder && (
        <form
          onSubmit={createFolder}
          className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Folder Name
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="e.g. Court Documents"
              autoFocus
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600"
            />

            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating
                ? "Creating..."
                : "Create Folder"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">
            Loading folders...
          </p>
        </div>
      ) : folders.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <div className="text-4xl">📁</div>

          <p className="mt-3 font-medium text-slate-700">
            No folders yet
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {canCreateFolder
              ? "Create your first folder to organise this matter's documents."
              : "No folders have been created for this matter yet."}
          </p>

          {canCreateFolder && (
            <button
              type="button"
              onClick={() => {
                setShowForm(true);
                setError("");
              }}
              className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Create Folder
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="rounded-xl border border-slate-200 p-5 transition hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">
                  📁
                </div>

                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {folder.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Matter folder
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 text-sm text-slate-500">
        {folders.length}{" "}
        {folders.length === 1
          ? "folder"
          : "folders"}
      </div>
    </section>
  );
}