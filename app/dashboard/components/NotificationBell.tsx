"use client";

import {
  Bell,
  CheckCheck,
  RefreshCw,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
};

type NotificationsResponse = {
  success: boolean;
  notifications?: NotificationItem[];
  unreadCount?: number;
  error?: string;
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<
    NotificationItem[]
  >([]);

  const [unreadCount, setUnreadCount] = useState(0);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/notifications",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data =
        (await response.json()) as NotificationsResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to load notifications.",
        );
      }

      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error(
        "Failed to load notifications:",
        error,
      );

      setError(
        "Unable to load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      const response = await fetch(
        `/api/notifications/${id}`,
        {
          method: "PATCH",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to update notification.",
        );
      }

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? {
                ...notification,
                isRead: true,
              }
            : notification,
        ),
      );

      setUnreadCount((current) =>
        Math.max(0, current - 1),
      );
    } catch (error) {
      console.error(
        "Failed to mark notification as read:",
        error,
      );
    }
  }

  async function markAllAsRead() {
    if (unreadCount === 0) {
      return;
    }

    try {
      const response = await fetch(
        "/api/notifications",
        {
          method: "PATCH",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to update notifications.",
        );
      }

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          isRead: true,
        })),
      );

      setUnreadCount(0);
    } catch (error) {
      console.error(
        "Failed to mark notifications as read:",
        error,
      );
    }
  }

  useEffect(() => {
    loadNotifications();

    const interval = window.setInterval(
      loadNotifications,
      30_000,
    );

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent,
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

  function formatDate(
    dateString: string,
  ) {
    const date = new Date(dateString);

    return new Intl.DateTimeFormat(
      "en-ZA",
      {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(date);
  }

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() =>
          setOpen((current) => !current)
        }
        aria-label="Notifications"
        aria-expanded={open}
        className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <Bell
          className="h-5 w-5"
          aria-hidden="true"
        />

        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Notifications
              </h2>

              <p className="text-xs text-slate-500">
                {unreadCount === 0
                  ? "You're all caught up."
                  : `${unreadCount} unread`}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={loadNotifications}
                disabled={loading}
                title="Refresh notifications"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    loading
                      ? "animate-spin"
                      : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <CheckCheck
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                </button>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {loading &&
              notifications.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  Loading notifications...
                </div>
              )}

            {error && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-red-600">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={loadNotifications}
                  className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading &&
              !error &&
              notifications.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto h-8 w-8 text-slate-300" />

                  <p className="mt-3 text-sm font-medium text-slate-700">
                    No notifications
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    New activity will appear here.
                  </p>
                </div>
              )}

            {notifications.map(
              (notification) => (
                <div
                  key={notification.id}
                  className={`border-b border-slate-100 px-4 py-4 transition ${
                    notification.isRead
                      ? "bg-white"
                      : "bg-blue-50/60"
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="mt-1 shrink-0">
                      <span
                        className={`block h-2.5 w-2.5 rounded-full ${
                          notification.isRead
                            ? "bg-slate-300"
                            : "bg-blue-600"
                        }`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {notification.title}
                      </p>

                      <p className="mt-1 text-sm leading-5 text-slate-600">
                        {notification.message}
                      </p>

                      <p className="mt-2 text-xs text-slate-400">
                        {formatDate(
                          notification.createdAt,
                        )}
                      </p>
                    </div>

                    {!notification.isRead && (
                      <button
                        type="button"
                        onClick={() =>
                          markAsRead(
                            notification.id,
                          )
                        }
                        className="shrink-0 self-start rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        Read
                      </button>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}