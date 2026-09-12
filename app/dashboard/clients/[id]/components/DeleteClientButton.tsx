"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteClientButtonProps = {
  clientId: string;
  clientName: string;
};

export default function DeleteClientButton({
  clientId,
  clientName,
}: DeleteClientButtonProps) {
  const router = useRouter();

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${clientName}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/clients/${clientId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to delete client."
        );
      }

      router.push("/dashboard/clients");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete client."
      );

      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-lg border border-red-300 bg-white px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Delete Client"}
      </button>

      {error && (
        <p className="max-w-sm text-right text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}