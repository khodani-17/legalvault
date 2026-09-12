"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

type FinanceFolder = {
  id: string;
  firmId: string;
  parentFolderId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type FinanceDocument = {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  extension: string;
  size: string;
  folderId: string | null;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
};

const PREVIEWABLE_FINANCE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
]);

function formatFileSize(size: string): string {
  const bytes = Number(size);

  if (!Number.isFinite(bytes)) {
    return `${size} bytes`;
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(
    "en-ZA",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  );
}

export default function FinancePage() {
  const [folders, setFolders] = useState<
    FinanceFolder[]
  >([]);

  const [documents, setDocuments] = useState<
    FinanceDocument[]
  >([]);

  const [selectedFolderId, setSelectedFolderId] =
    useState<string | null>(null);

  const [newFolderName, setNewFolderName] =
    useState("");

  const [newFolderParentId, setNewFolderParentId] =
    useState<string>("");

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [uploadFolderId, setUploadFolderId] =
    useState<string>("");

  const [loading, setLoading] =
    useState(true);

  const [creatingFolder, setCreatingFolder] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [
    downloadingDocumentId,
    setDownloadingDocumentId,
  ] = useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  // ==========================================================
  // LOAD FINANCE DATA
  // ==========================================================

  async function loadFinanceData() {
    setLoading(true);
    setError(null);

    try {
      const [
        foldersResponse,
        documentsResponse,
      ] = await Promise.all([
        fetch("/api/finance/folders", {
          method: "GET",
          cache: "no-store",
        }),

        fetch("/api/finance/documents", {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      if (
        foldersResponse.status === 401 ||
        foldersResponse.status === 403
      ) {
        throw new Error(
          "You do not have access to the Finance workspace.",
        );
      }

      if (!foldersResponse.ok) {
        throw new Error(
          "Unable to load Finance folders.",
        );
      }

      if (!documentsResponse.ok) {
        throw new Error(
          "Unable to load Finance documents.",
        );
      }

      const foldersData =
        await foldersResponse.json();

      const documentsData =
        await documentsResponse.json();

      setFolders(
        Array.isArray(foldersData.folders)
          ? foldersData.folders
          : [],
      );

      setDocuments(
        Array.isArray(documentsData.documents)
          ? documentsData.documents
          : [],
      );
    } catch (loadError) {
      console.error(
        "Finance workspace loading error:",
        loadError,
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load Finance workspace.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFinanceData();
  }, []);

  // ==========================================================
  // FOLDER HELPERS
  // ==========================================================

  const folderMap = useMemo(() => {
    return new Map(
      folders.map((folder) => [
        folder.id,
        folder,
      ]),
    );
  }, [folders]);

  function getFolderPath(
    folder: FinanceFolder,
  ): string {
    const parts: string[] = [];

    let current: FinanceFolder | undefined =
      folder;

    const visited = new Set<string>();

    while (
      current &&
      !visited.has(current.id)
    ) {
      visited.add(current.id);

      parts.unshift(current.name);

      if (!current.parentFolderId) {
        break;
      }

      current = folderMap.get(
        current.parentFolderId,
      );
    }

    return parts.join(" / ");
  }

  function getFolderName(
    folderId: string | null,
  ): string {
    if (!folderId) {
      return "Unfiled";
    }

    return (
      folderMap.get(folderId)?.name ||
      "Unknown folder"
    );
  }

  const visibleDocuments =
    selectedFolderId === null
      ? documents
      : documents.filter(
          (financeDocument) =>
            financeDocument.folderId ===
            selectedFolderId,
        );

  // ==========================================================
  // CREATE FOLDER
  // ==========================================================

  async function handleCreateFolder(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    const name =
      newFolderName.trim();

    if (!name) {
      setError(
        "Please enter a folder name.",
      );

      return;
    }

    setCreatingFolder(true);

    try {
      const response =
        await fetch(
          "/api/finance/folders",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name,
              parentFolderId:
                newFolderParentId ||
                null,
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to create Finance folder.",
        );
      }

      setNewFolderName("");
      setNewFolderParentId("");

      setSuccess(
        `Folder "${data.folder.name}" was created.`,
      );

      await loadFinanceData();
    } catch (createError) {
      console.error(
        "Finance folder creation error:",
        createError,
      );

      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create Finance folder.",
      );
    } finally {
      setCreatingFolder(false);
    }
  }

  // ==========================================================
  // UPLOAD DOCUMENT
  // ==========================================================

  async function handleUpload(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    if (!selectedFile) {
      setError(
        "Please select a document to upload.",
      );

      return;
    }

    setUploading(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile,
      );

      if (uploadFolderId) {
        formData.append(
          "folderId",
          uploadFolderId,
        );
      }

      const response =
        await fetch(
          "/api/finance/documents",
          {
            method: "POST",
            body: formData,
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to upload Finance document.",
        );
      }

      setSelectedFile(null);

      const fileInput =
        document.getElementById(
          "finance-file",
        ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      setSuccess(
        `Document "${data.document.name}" was uploaded successfully.`,
      );

      await loadFinanceData();
    } catch (uploadError) {
      console.error(
        "Finance document upload error:",
        uploadError,
      );

      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload Finance document.",
      );
    } finally {
      setUploading(false);
    }
  }

  // ==========================================================
  // PREVIEW FINANCE DOCUMENT
  // ==========================================================

  function canPreview(
    financeDocument: FinanceDocument,
  ): boolean {
    return PREVIEWABLE_FINANCE_TYPES.has(
      financeDocument.mimeType,
    );
  }

  function handlePreview(
    financeDocument: FinanceDocument,
  ) {
    setError(null);
    setSuccess(null);

    const previewUrl =
      `/api/finance/documents/${encodeURIComponent(
        financeDocument.id,
      )}/preview`;

    window.open(
      previewUrl,
      "_blank",
      "noopener,noreferrer",
    );
  }

  // ==========================================================
  // DOWNLOAD FINANCE DOCUMENT
  // ==========================================================

  async function handleDownload(
    financeDocument: FinanceDocument,
  ) {
    setError(null);
    setSuccess(null);

    setDownloadingDocumentId(
      financeDocument.id,
    );

    try {
      const response =
        await fetch(
          `/api/finance/documents/${encodeURIComponent(
            financeDocument.id,
          )}/download`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

      if (!response.ok) {
        let message =
          "Unable to download Finance document.";

        try {
          const data =
            await response.json();

          if (
            typeof data?.error ===
            "string"
          ) {
            message = data.error;
          }
        } catch {
          // Ignore non-JSON error responses.
        }

        throw new Error(message);
      }

      const blob =
        await response.blob();

      if (blob.size === 0) {
        throw new Error(
          "The Finance document is empty.",
        );
      }

      const objectUrl =
        URL.createObjectURL(blob);

      const link =
        window.document.createElement(
          "a",
        );

      link.href = objectUrl;

      link.download =
        financeDocument.originalName ||
        financeDocument.name ||
        `finance-document${financeDocument.extension}`;

      link.style.display = "none";

      window.document.body.appendChild(
        link,
      );

      link.click();

      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);

      setSuccess(
        `Document "${financeDocument.name}" downloaded successfully.`,
      );
    } catch (downloadError) {
      console.error(
        "Finance document download error:",
        downloadError,
      );

      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to download Finance document.",
      );
    } finally {
      setDownloadingDocumentId(null);
    }
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-7xl">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-700">
              LegalVault Finance
            </p>

            <h1 className="text-3xl font-bold text-slate-900">
              Finance Vault
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Securely organise Finance documents
              using your own folder structure.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSuccess(null);
              setError(null);
              void loadFinanceData();
            }}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        {/* ====================================================
            SECURITY NOTICE
        ==================================================== */}

        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-900">
            Finance access is restricted.
          </p>

          <p className="mt-1 text-sm text-blue-800">
            Only authorised Finance users can
            access Finance documents and folders.
          </p>
        </div>

        {/* ====================================================
            MESSAGES
        ==================================================== */}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        {/* ====================================================
            ACTION CARDS
        ==================================================== */}

        <div className="mb-8 grid gap-6 lg:grid-cols-2">

          {/* CREATE FOLDER */}

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Create Finance Folder
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Create your own folders and
              subfolders.
            </p>

            <form
              onSubmit={handleCreateFolder}
              className="mt-5 space-y-4"
            >
              <div>
                <label
                  htmlFor="folder-name"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Folder name
                </label>

                <input
                  id="folder-name"
                  type="text"
                  value={newFolderName}
                  onChange={(event) =>
                    setNewFolderName(
                      event.target.value,
                    )
                  }
                  maxLength={150}
                  placeholder="e.g. Bank Statements"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="folder-parent"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Parent folder
                </label>

                <select
                  id="folder-parent"
                  value={newFolderParentId}
                  onChange={(event) =>
                    setNewFolderParentId(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    No parent — top-level folder
                  </option>

                  {folders.map((folder) => (
                    <option
                      key={folder.id}
                      value={folder.id}
                    >
                      {getFolderPath(folder)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={creatingFolder}
                className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingFolder
                  ? "Creating..."
                  : "Create Folder"}
              </button>
            </form>
          </section>

          {/* UPLOAD DOCUMENT */}

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Upload Finance Document
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Upload a document directly into a
              Finance folder.
            </p>

            <form
              onSubmit={handleUpload}
              className="mt-5 space-y-4"
            >
              <div>
                <label
                  htmlFor="finance-file"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Document
                </label>

                <input
                  id="finance-file"
                  type="file"
                  onChange={(event) =>
                    setSelectedFile(
                      event.target.files?.[0] ||
                        null,
                    )
                  }
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Maximum size: 100 MB.
                </p>
              </div>

              <div>
                <label
                  htmlFor="upload-folder"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Save in folder
                </label>

                <select
                  id="upload-folder"
                  value={uploadFolderId}
                  onChange={(event) =>
                    setUploadFolderId(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    Unfiled
                  </option>

                  {folders.map((folder) => (
                    <option
                      key={folder.id}
                      value={folder.id}
                    >
                      {getFolderPath(folder)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={
                  uploading ||
                  !selectedFile
                }
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading
                  ? "Uploading..."
                  : "Upload Document"}
              </button>
            </form>
          </section>
        </div>

        {/* ====================================================
            MAIN CONTENT
        ==================================================== */}

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">

          {/* ==================================================
              FOLDERS
          ================================================== */}

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Finance Folders
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {folders.length} folder
                  {folders.length === 1
                    ? ""
                    : "s"}
                </p>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">
                Loading folders...
              </p>
            ) : folders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No Finance folders yet.
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Create your first folder above.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedFolderId(null)
                  }
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    selectedFolderId === null
                      ? "bg-blue-50 text-blue-800"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  All Finance Documents
                </button>

                {folders.map((folder) => (
                  <button
                    type="button"
                    key={folder.id}
                    onClick={() =>
                      setSelectedFolderId(
                        folder.id,
                      )
                    }
                    className={`w-full rounded-lg px-3 py-2 text-left transition ${
                      selectedFolderId ===
                      folder.id
                        ? "bg-blue-50 text-blue-800"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">
                        📁
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {folder.name}
                        </span>

                        {folder.parentFolderId && (
                          <span className="mt-0.5 block truncate text-xs text-slate-400">
                            {getFolderPath(
                              folder,
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ==================================================
              DOCUMENTS
          ================================================== */}

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  {selectedFolderId
                    ? getFolderName(
                        selectedFolderId,
                      )
                    : "All Finance Documents"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {visibleDocuments.length} document
                  {visibleDocuments.length === 1
                    ? ""
                    : "s"}
                </p>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">
                Loading documents...
              </p>
            ) : visibleDocuments.length ===
              0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No Finance documents found.
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Upload a document using the
                  form above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3 font-semibold">
                        Document
                      </th>

                      <th className="px-3 py-3 font-semibold">
                        Folder
                      </th>

                      <th className="px-3 py-3 font-semibold">
                        Size
                      </th>

                      <th className="px-3 py-3 font-semibold">
                        Uploaded
                      </th>

                      <th className="px-3 py-3 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleDocuments.map(
                      (financeDocument) => (
                        <tr
                          key={
                            financeDocument.id
                          }
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-3 py-4">
                            <p className="text-sm font-medium text-slate-900">
                              {
                                financeDocument.name
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {
                                financeDocument.originalName
                              }
                            </p>
                          </td>

                          <td className="px-3 py-4 text-sm text-slate-600">
                            {getFolderName(
                              financeDocument.folderId,
                            )}
                          </td>

                          <td className="px-3 py-4 text-sm text-slate-600">
                            {formatFileSize(
                              financeDocument.size,
                            )}
                          </td>

                          <td className="px-3 py-4 text-sm text-slate-600">
                            {formatDate(
                              financeDocument.createdAt,
                            )}
                          </td>

                          <td className="px-3 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {canPreview(
                                financeDocument,
                              ) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handlePreview(
                                      financeDocument,
                                    )
                                  }
                                  className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
                                >
                                  Preview
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  void handleDownload(
                                    financeDocument,
                                  )
                                }
                                disabled={
                                  downloadingDocumentId ===
                                  financeDocument.id
                                }
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {downloadingDocumentId ===
                                financeDocument.id
                                  ? "Downloading..."
                                  : "Download"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}