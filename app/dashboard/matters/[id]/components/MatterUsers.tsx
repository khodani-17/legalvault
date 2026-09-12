"use client";

import { useEffect, useState } from "react";
import {
  UserPlus,
  Trash2,
  ShieldCheck,
  Upload,
  Download,
  FileX,
  Settings,
  X,
} from "lucide-react";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl: string | null;
};

type Assignment = {
  id: string;
  matterId: string;
  userId: string;
  canView: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canDelete: boolean;
  canManage: boolean;
  user: User;
};

type MatterUsersProps = {
  matterId: string;
  canManageUsers: boolean;
};

function formatRole(role: string) {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function MatterUsers({
  matterId,
  canManageUsers,
}: MatterUsersProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);

  const [loadingUsers, setLoadingUsers] = useState(false);

  const [showForm, setShowForm] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState("");

  const [saving, setSaving] = useState(false);

  const [removingId, setRemovingId] = useState("");

  const [updatingId, setUpdatingId] = useState("");

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [permissions, setPermissions] = useState({
    canView: true,
    canUpload: false,
    canDownload: false,
    canDelete: false,
    canManage: false,
  });

  // ============================================================
  // LOAD ASSIGNED USERS
  // ============================================================

  async function loadAssignments() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/matters/${matterId}/users`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load assigned users."
        );
      }

      setAssignments(data.users || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load assigned users."
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // LOAD FIRM USERS
  // ============================================================

  async function loadUsers() {
    if (!canManageUsers) {
      return;
    }

    try {
      setLoadingUsers(true);

      const response = await fetch("/api/users", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load firm users."
        );
      }

      const users: User[] = data.users || [];

      setAvailableUsers(users);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load firm users."
      );
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    if (!matterId) {
      return;
    }

    loadAssignments();

    if (canManageUsers) {
      loadUsers();
    }
  }, [matterId, canManageUsers]);

  // ============================================================
  // ASSIGN USER
  // ============================================================

  async function handleAssign(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!canManageUsers) {
      setError(
        "You do not have permission to manage users on this matter."
      );
      return;
    }

    if (!selectedUserId) {
      setError("Please select a user.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `/api/matters/${matterId}/users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            userId: selectedUserId,
            ...permissions,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to assign user."
        );
      }

      if (data.assignment) {
        setAssignments((current) => [
          ...current,
          data.assignment,
        ]);
      }

      setSelectedUserId("");

      setPermissions({
        canView: true,
        canUpload: false,
        canDownload: false,
        canDelete: false,
        canManage: false,
      });

      setShowForm(false);

      setSuccess(
        "User assigned to the matter successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to assign user."
      );
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // UPDATE PERMISSIONS
  // ============================================================

  async function updatePermissions(
    assignment: Assignment,
    field:
      | "canView"
      | "canUpload"
      | "canDownload"
      | "canDelete"
      | "canManage",
    value: boolean
  ) {
    if (!canManageUsers) {
      setError(
        "You do not have permission to manage users on this matter."
      );
      return;
    }

    setError("");
    setSuccess("");
    setUpdatingId(assignment.id);

    try {
      const response = await fetch(
        `/api/matters/${matterId}/users`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            assignmentId: assignment.id,
            [field]: value,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to update permissions."
        );
      }

      if (data.assignment) {
        setAssignments((current) =>
          current.map((item) =>
            item.id === assignment.id
              ? data.assignment
              : item
          )
        );
      }

      setSuccess("Permissions updated.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update permissions."
      );
    } finally {
      setUpdatingId("");
    }
  }

  // ============================================================
  // REMOVE USER
  // ============================================================

  async function removeUser(assignment: Assignment) {
    if (!canManageUsers) {
      setError(
        "You do not have permission to manage users on this matter."
      );
      return;
    }

    const confirmed = window.confirm(
      `Remove ${assignment.user.name} from this matter?`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setRemovingId(assignment.id);

    try {
      const response = await fetch(
        `/api/matters/${matterId}/users`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            assignmentId: assignment.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to remove user."
        );
      }

      setAssignments((current) =>
        current.filter(
          (item) => item.id !== assignment.id
        )
      );

      setSuccess("User removed from the matter.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove user."
      );
    } finally {
      setRemovingId("");
    }
  }

  // ============================================================
  // AVAILABLE USERS
  // ============================================================

  const assignedUserIds = new Set(
    assignments.map(
      (assignment) => assignment.userId
    )
  );

  const assignableUsers = availableUsers.filter(
    (user) =>
      user.status === "ACTIVE" &&
      !assignedUserIds.has(user.id)
  );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Assigned Users
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Users who have access to this matter.
          </p>
        </div>

        {canManageUsers && (
          <button
            type="button"
            onClick={() => {
              setShowForm((current) => !current);
              setError("");
              setSuccess("");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {showForm ? (
              <>
                <X size={16} />
                Cancel
              </>
            ) : (
              <>
                <UserPlus size={16} />
                Assign User
              </>
            )}
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Assign Form */}
      {showForm && canManageUsers && (
        <form
          onSubmit={handleAssign}
          className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5"
        >
          <h3 className="font-semibold text-slate-900">
            Assign User
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Select an active member of your firm.
          </p>

          <div className="mt-5">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              User
            </label>

            <select
              value={selectedUserId}
              onChange={(event) =>
                setSelectedUserId(event.target.value)
              }
              disabled={loadingUsers}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">
                {loadingUsers
                  ? "Loading users..."
                  : "Select a user"}
              </option>

              {assignableUsers.map((user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.name} — {formatRole(user.role)}
                </option>
              ))}
            </select>
          </div>

          {/* Permissions */}
          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-800">
              Matter Permissions
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <input
                  type="checkbox"
                  checked={permissions.canView}
                  onChange={(event) =>
                    setPermissions((current) => ({
                      ...current,
                      canView: event.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />

                <ShieldCheck
                  size={17}
                  className="text-slate-500"
                />

                <span className="text-sm font-medium text-slate-700">
                  View
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <input
                  type="checkbox"
                  checked={permissions.canUpload}
                  onChange={(event) =>
                    setPermissions((current) => ({
                      ...current,
                      canUpload: event.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />

                <Upload
                  size={17}
                  className="text-slate-500"
                />

                <span className="text-sm font-medium text-slate-700">
                  Upload
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <input
                  type="checkbox"
                  checked={permissions.canDownload}
                  onChange={(event) =>
                    setPermissions((current) => ({
                      ...current,
                      canDownload:
                        event.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />

                <Download
                  size={17}
                  className="text-slate-500"
                />

                <span className="text-sm font-medium text-slate-700">
                  Download
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <input
                  type="checkbox"
                  checked={permissions.canDelete}
                  onChange={(event) =>
                    setPermissions((current) => ({
                      ...current,
                      canDelete:
                        event.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />

                <FileX
                  size={17}
                  className="text-slate-500"
                />

                <span className="text-sm font-medium text-slate-700">
                  Delete
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={permissions.canManage}
                  onChange={(event) =>
                    setPermissions((current) => ({
                      ...current,
                      canManage:
                        event.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />

                <Settings
                  size={17}
                  className="text-slate-500"
                />

                <span className="text-sm font-medium text-slate-700">
                  Manage Matter
                </span>
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setSelectedUserId("");
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                loadingUsers ||
                !selectedUserId
              }
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Assigning..." : "Assign User"}
            </button>
          </div>
        </form>
      )}

      {/* Assigned Users */}
      {loading ? (
        <div className="mt-6 rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">
            Loading assigned users...
          </p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <UserPlus
              size={22}
              className="text-slate-500"
            />
          </div>

          <p className="mt-4 font-medium text-slate-700">
            No users assigned
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {canManageUsers
              ? "Assign attorneys or staff members to give them access to this matter."
              : "No users have been assigned to this matter yet."}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="rounded-xl border border-slate-200 p-5"
            >
              {/* User */}
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-3">
                  {assignment.user.avatarUrl ? (
                    <img
                      src={assignment.user.avatarUrl}
                      alt={assignment.user.name}
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                      {getInitials(
                        assignment.user.name
                      )}
                    </div>
                  )}

                  <div>
                    <p className="font-semibold text-slate-900">
                      {assignment.user.name}
                    </p>

                    <p className="text-sm text-slate-500">
                      {assignment.user.email}
                    </p>

                    <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {formatRole(
                        assignment.user.role
                      )}
                    </span>
                  </div>
                </div>

                {canManageUsers && (
                  <button
                    type="button"
                    onClick={() =>
                      removeUser(assignment)
                    }
                    disabled={
                      removingId === assignment.id
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={15} />

                    {removingId === assignment.id
                      ? "Removing..."
                      : "Remove"}
                  </button>
                )}
              </div>

              {/* Permissions */}
              <div className="mt-5 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">
                    Permissions
                  </p>

                  {canManageUsers &&
                    updatingId === assignment.id && (
                      <span className="text-xs text-slate-500">
                        Saving...
                      </span>
                    )}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    {
                      field: "canView" as const,
                      label: "View",
                      icon: ShieldCheck,
                    },
                    {
                      field: "canUpload" as const,
                      label: "Upload",
                      icon: Upload,
                    },
                    {
                      field: "canDownload" as const,
                      label: "Download",
                      icon: Download,
                    },
                    {
                      field: "canDelete" as const,
                      label: "Delete",
                      icon: FileX,
                    },
                    {
                      field: "canManage" as const,
                      label: "Manage",
                      icon: Settings,
                    },
                  ].map(
                    ({
                      field,
                      label,
                      icon: Icon,
                    }) => (
                      <label
                        key={field}
                        className={`flex items-center gap-2 rounded-lg border border-slate-200 p-3 ${
                          canManageUsers
                            ? "cursor-pointer"
                            : "cursor-default"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={
                            assignment[field]
                          }
                          disabled={
                            !canManageUsers ||
                            updatingId ===
                              assignment.id
                          }
                          onChange={(event) =>
                            updatePermissions(
                              assignment,
                              field,
                              event.target.checked
                            )
                          }
                          className="h-4 w-4"
                        />

                        <Icon
                          size={15}
                          className="text-slate-500"
                        />

                        <span className="text-xs font-medium text-slate-700">
                          {label}
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 text-sm text-slate-500">
        {assignments.length}{" "}
        {assignments.length === 1 ? "user" : "users"}{" "}
        assigned
      </div>
    </section>
  );
}