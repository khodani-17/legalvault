"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

type Matter = {
  id: string;
  referenceNumber: string;
  title: string;
};

type Folder = {
  id: string;
  name: string;
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/jpeg",
  "image/png",
];

export default function UploadDocumentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialMatterId =
    searchParams.get("matterId") || "";

  const [matters, setMatters] = useState<Matter[]>(
    []
  );

  const [folders, setFolders] = useState<Folder[]>(
    []
  );

  const [loadingMatters, setLoadingMatters] =
    useState(true);

  const [loadingFolders, setLoadingFolders] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");

  const [form, setForm] = useState({
    matterId: initialMatterId,
    folderId: "",
    name: "",
    category: "",
    tags: "",
  });

  const [file, setFile] =
    useState<File | null>(null);

  // =====================================================
  // LOAD MATTERS
  // =====================================================

  useEffect(() => {
    async function loadMatters() {
      try {
        setLoadingMatters(true);
        setError("");

        const response = await fetch(
          "/api/matters",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load matters."
          );
        }

        setMatters(data.matters || []);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load matters."
        );
      } finally {
        setLoadingMatters(false);
      }
    }

    loadMatters();
  }, []);

  // =====================================================
  // LOAD FOLDERS FOR SELECTED MATTER
  // =====================================================

  useEffect(() => {
    async function loadFolders() {
      if (!form.matterId) {
        setFolders([]);
        return;
      }

      try {
        setLoadingFolders(true);

        const response = await fetch(
          `/api/folders?matterId=${encodeURIComponent(
            form.matterId
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load folders."
          );
        }

        setFolders(data.folders || []);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load folders."
        );

        setFolders([]);
      } finally {
        setLoadingFolders(false);
      }
    }

    loadFolders();
  }, [form.matterId]);

  // =====================================================
  // UPDATE FORM
  // =====================================================

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  // =====================================================
  // FILE SELECTION
  // =====================================================

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    setError("");

    const selectedFile =
      event.target.files?.[0] || null;

    if (!selectedFile) {
      setFile(null);
      return;
    }

    // ---------------------------------------------------
    // FILE SIZE VALIDATION
    // ---------------------------------------------------

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);

      event.target.value = "";

      setError(
        "The selected file is too large. The maximum file size is 25 MB."
      );

      return;
    }

    // ---------------------------------------------------
    // FILE TYPE VALIDATION
    // ---------------------------------------------------

    if (
      selectedFile.type &&
      !ALLOWED_FILE_TYPES.includes(
        selectedFile.type
      )
    ) {
      setFile(null);

      event.target.value = "";

      setError(
        "This file type is not supported. Please upload a PDF, Word, Excel, PowerPoint, text, JPG, or PNG document."
      );

      return;
    }

    setFile(selectedFile);

    // ---------------------------------------------------
    // AUTOMATIC DOCUMENT NAME
    // ---------------------------------------------------

    if (!form.name.trim()) {
      const filenameWithoutExtension =
        selectedFile.name.replace(
          /\.[^/.]+$/,
          ""
        );

      setForm((current) => ({
        ...current,
        name: filenameWithoutExtension,
      }));
    }
  }

  // =====================================================
  // SUBMIT
  // =====================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    // ---------------------------------------------------
    // MATTER VALIDATION
    // ---------------------------------------------------

    if (!form.matterId) {
      setError(
        "Please select a matter."
      );
      return;
    }

    // ---------------------------------------------------
    // DOCUMENT NAME VALIDATION
    // ---------------------------------------------------

    if (!form.name.trim()) {
      setError(
        "Document name is required."
      );
      return;
    }

    // ---------------------------------------------------
    // FILE VALIDATION
    // ---------------------------------------------------

    if (!file) {
      setError(
        "Please select a document file."
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        "The selected file is too large. The maximum file size is 25 MB."
      );
      return;
    }

    // ---------------------------------------------------
    // FOLDER VALIDATION
    // ---------------------------------------------------

    if (form.folderId) {
      const selectedFolder =
        folders.find(
          (folder) =>
            folder.id === form.folderId
        );

      if (!selectedFolder) {
        setError(
          "The selected folder is not valid for this matter."
        );
        return;
      }
    }

    setLoading(true);

    try {
      // =================================================
      // BUILD FORM DATA
      // =================================================

      const formData = new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "matterId",
        form.matterId
      );

      formData.append(
        "documentName",
        form.name.trim()
      );

      // Category is optional.
      if (form.category.trim()) {
        formData.append(
          "category",
          form.category.trim()
        );
      }

      // -------------------------------------------------
      // NORMALISE TAGS
      // -------------------------------------------------

      const tags = form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .filter(
          (tag, index, array) =>
            array.indexOf(tag) === index
        );

      if (tags.length > 0) {
        formData.append(
          "tags",
          tags.join(",")
        );
      }

      // -------------------------------------------------
      // OPTIONAL FOLDER
      // -------------------------------------------------

      if (form.folderId) {
        formData.append(
          "folderId",
          form.folderId
        );
      }

      // =================================================
      // UPLOAD
      // =================================================

      const response = await fetch(
        "/api/documents/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      let data: {
        error?: string;
        document?: {
          id?: string;
        };
      } = {};

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "The server returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to upload document."
        );
      }

      // =================================================
      // SUCCESS
      // =================================================

      if (data.document?.id) {
        router.push(
          `/dashboard/documents/${data.document.id}`
        );
      } else {
        router.push(
          "/dashboard/documents"
        );
      }

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while uploading the document."
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
    >

      {/* ================================================= */}
      {/* ERROR */}
      {/* ================================================= */}

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">

        {/* ================================================= */}
        {/* MATTER */}
        {/* ================================================= */}

        <div className="md:col-span-2">

          <label
            htmlFor="matterId"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Matter *
          </label>

          <select
            id="matterId"
            required
            value={form.matterId}
            onChange={(event) => {
              setForm((current) => ({
                ...current,
                matterId:
                  event.target.value,
                folderId: "",
              }));

              setFolders([]);
              setError("");
            }}
            disabled={
              loadingMatters || loading
            }
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="">
              {loadingMatters
                ? "Loading matters..."
                : "Select a matter"}
            </option>

            {matters.map((matter) => (
              <option
                key={matter.id}
                value={matter.id}
              >
                {matter.referenceNumber} —{" "}
                {matter.title}
              </option>
            ))}
          </select>

          {!loadingMatters &&
            matters.length === 0 && (
              <p className="mt-2 text-xs text-amber-600">
                No matters are available.
                Create a matter before
                uploading a document.
              </p>
            )}

        </div>

        {/* ================================================= */}
        {/* FOLDER */}
        {/* ================================================= */}

        <div>

          <label
            htmlFor="folderId"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Folder
          </label>

          <select
            id="folderId"
            value={form.folderId}
            onChange={(event) =>
              updateField(
                "folderId",
                event.target.value
              )
            }
            disabled={
              !form.matterId ||
              loadingFolders ||
              loading
            }
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="">
              {!form.matterId
                ? "Select a matter first"
                : loadingFolders
                ? "Loading folders..."
                : folders.length === 0
                ? "No folders available"
                : "No folder"}
            </option>

            {folders.map((folder) => (
              <option
                key={folder.id}
                value={folder.id}
              >
                {folder.name}
              </option>
            ))}
          </select>

        </div>

        {/* ================================================= */}
        {/* CATEGORY */}
        {/* ================================================= */}

        <div>

          <label
            htmlFor="category"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Category
          </label>

          <input
            id="category"
            value={form.category}
            onChange={(event) =>
              updateField(
                "category",
                event.target.value
              )
            }
            disabled={loading}
            placeholder="e.g. Court Document"
            maxLength={100}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />

        </div>

        {/* ================================================= */}
        {/* DOCUMENT NAME */}
        {/* ================================================= */}

        <div className="md:col-span-2">

          <label
            htmlFor="documentName"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Document Name *
          </label>

          <input
            id="documentName"
            required
            value={form.name}
            onChange={(event) =>
              updateField(
                "name",
                event.target.value
              )
            }
            disabled={loading}
            placeholder="e.g. RAF Claim Form"
            maxLength={200}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />

          <p className="mt-1 text-xs text-slate-500">
            Use a clear name that will be easy
            to find later.
          </p>

        </div>

        {/* ================================================= */}
        {/* TAGS */}
        {/* ================================================= */}

        <div className="md:col-span-2">

          <label
            htmlFor="tags"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Tags
          </label>

          <input
            id="tags"
            value={form.tags}
            onChange={(event) =>
              updateField(
                "tags",
                event.target.value
              )
            }
            disabled={loading}
            placeholder="RAF, medical, claim"
            maxLength={500}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />

          <p className="mt-1 text-xs text-slate-500">
            Separate multiple tags with commas.
          </p>

        </div>

        {/* ================================================= */}
        {/* FILE */}
        {/* ================================================= */}

        <div className="md:col-span-2">

          <label
            htmlFor="documentFile"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Document File *
          </label>

          <div className="rounded-xl border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-slate-400">

            <input
              id="documentFile"
              required
              type="file"
              onChange={handleFileChange}
              disabled={loading}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
              className="mx-auto block w-full max-w-md text-sm disabled:cursor-not-allowed"
            />

            <p className="mt-3 text-xs text-slate-500">
              Maximum file size: 25 MB
            </p>

            <p className="text-xs text-slate-500">
              PDF, Word, Excel, PowerPoint,
              TXT, JPG or PNG
            </p>

            {/* ================================================= */}
            {/* SELECTED FILE */}
            {/* ================================================= */}

            {file && (
              <div className="mt-5 rounded-lg bg-slate-50 p-4 text-left">

                <p className="text-sm font-medium text-slate-900">
                  Selected file
                </p>

                <p className="mt-1 break-all text-sm text-slate-700">
                  {file.name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(
                    2
                  )}{" "}
                  MB
                </p>

              </div>
            )}

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* ACTIONS */}
      {/* ================================================= */}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={
            loading ||
            loadingMatters ||
            matters.length === 0
          }
          className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Uploading..."
            : "Upload Document"}
        </button>

      </div>

    </form>
  );
}