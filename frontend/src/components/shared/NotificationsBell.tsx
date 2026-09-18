import { useAuth } from "@/context/AuthContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { notificationService } from "@/services/notificationService";
import { toast } from "react-hot-toast";
import { Bell } from "lucide-react";

export default function NotificationsBell() {
  const { loading } = useAuth();
   
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const locale = "ar-EG";

  async function loadNotifications() {
    try {
      const data = await notificationService.list();
      setNotifications(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error("Load notifications error:", err);
      setNotifications([]);
    }
  }

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !item.is_read).length;
  }, [notifications]);

  async function handleMarkRead(notificationId: string | number) {
    try {
      await notificationService.markRead(notificationId);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item,
        ),
      );
    } catch (err) {
      console.error("Mark read error:", err);
    }
  }

  async function handleMarkAllRead() {
    try {
      const unreadIds = notifications
        .filter((item) => !item.is_read)
        .map((item) => item.id);
      await notificationService.markAllRead(unreadIds);
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true })),
      );
      toast.success("تم تحديد الكل كمقروء");
    } catch (err) {
      console.error("Mark all read error:", err);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen((prev) => !prev)}
        className="notification-button relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-main shadow-soft transition-all hover:bg-accent-subtle hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
        aria-label="الإشعارات"
        aria-expanded={open ? "true" : "false"}
      >
        <Bell size={19} />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -left-1 flex min-w-5 h-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black text-white ring-2 ring-card">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-0 top-14 z-dropdown w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-border bg-elevated shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="border-b border-border bg-soft/50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-black text-main">الإشعارات</h4>
                <p className="mt-1 text-xs font-bold text-muted">
                  {unreadCount > 0
                    ? `${unreadCount} غير مقروء`
                    : "لا توجد إشعارات جديدة"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="badge badge-gold">مباشر</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-black text-accent hover:underline uppercase tracking-widest"
                  >
                    تحديد الكل كمقروء
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto p-3">
            {notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-soft/40 p-8 text-center text-sm font-bold text-muted">
                لا توجد إشعارات حالياً
              </div>
            ) : (
              notifications.map((notification) => {
                const title = notification.title || "إشعار";
                const message = notification.message || "";
                const createdAt = notification.created_at
                  ? new Date(notification.created_at).toLocaleString(locale)
                  : "";

                return (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => {
                      if (!notification.is_read) {
                        handleMarkRead(notification.id);
                      }
                    }}
                    className={`w-full rounded-2xl border p-4 text-start transition-all hover:bg-accent-subtle hover:border-border-accent ${
                      !notification.is_read
                        ? "border-border-accent bg-accent-soft/40"
                        : "border-transparent bg-card"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                          notification.is_read ? "bg-border-3" : "bg-accent"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-main">
                          {title}
                        </div>
                        {message ? (
                          <p className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-muted">
                            {message}
                          </p>
                        ) : null}
                        {createdAt ? (
                          <div className="mt-2 text-[10px] font-bold text-subtle">
                            {createdAt}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-border bg-soft/40 p-3 text-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => setOpen(false)}
              className="btn btn-ghost btn-sm rounded-xl text-xs"
            >
              عرض كل الإشعارات
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
