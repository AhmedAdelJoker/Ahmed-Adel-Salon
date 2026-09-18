import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { CheckCheck } from "lucide-react";
import { notificationService } from "@/services/notificationService";
import { notify } from "@/lib/core/toast";
import { dateTime } from "@/lib/format/formatters";
import { Bell, ChevronLeft, ChevronRight, X } from "lucide-react";

export interface NotificationItem {
  id?: string | number;
  title?: string;
  message?: string;
  is_read?: boolean;
  created_at?: string;
  [key: string]: unknown;
}

export default function NotificationDrawer() {
  const { loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    pageSize: 8,
    totalPages: 1,
  });

  async function load(page = 1) {
    try {
      const data = await notificationService.list({
        page,
        page_size: meta.pageSize,
      });
      setItems((data.items || []) as NotificationItem[]);
      setMeta({
        total: data.total || 0,
        page: data.page || 1,
        pageSize: data.page_size || 8,
        totalPages: data.total_pages || 1,
      });
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      notify.error((apiErr?.response?.data?.detail as string) || "فشل تحميل الإشعارات");
    }
  }

  useEffect(() => {
    load(1);
  }, []);

  async function markAllRead() {
    try {
      const unreadIds = items
        .filter((item) => !item.is_read)
        .map((item) => item.id)
        .filter((id): id is string | number => id !== undefined);
      await notificationService.markAllRead(unreadIds);
      notify.success("تم تعليم كل الإشعارات كمقروءة");
      load(1);
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      notify.error((apiErr?.response?.data?.detail as string) || "فشل تحديث الإشعارات");
    }
  }

  async function toggleRead(item: NotificationItem) {
    if (item.is_read || item.id === undefined) return;

    try {
      await notificationService.markRead(item.id);
      load(meta.page);
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      notify.error((apiErr?.response?.data?.detail as string) || "فشل تحديث الإشعار");
    }
  }

  const unreadCount = items.filter((i) => !i.is_read).length;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen((value) => !value)}
        className="notification-button relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-main shadow-soft transition hover:bg-accent-subtle hover:text-accent"
        aria-label="فتح درج الإشعارات"
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
        <div className="fixed inset-0 z-modal">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="إغلاق درج الإشعارات"
            disabled={loading}
            onClick={() => setOpen(false)}
          />

          <aside className="absolute inset-y-0 left-0 flex w-[420px] max-w-[92vw] flex-col border-r border-border bg-elevated shadow-2xl">
            <header className="border-b border-border bg-soft/50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-main">الإشعارات</h3>
                  <p className="mt-1 text-xs font-bold text-muted">
                    آخر التنبيهات داخل النظام
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setOpen(false)}
                  className="btn btn-ghost btn-icon btn-sm rounded-xl"
                  aria-label="إغلاق"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
                <span className="badge badge-info">
                  غير المقروءة: {unreadCount}
                </span>
                <button
                  type="button"
                  onClick={markAllRead}
                  className="btn btn-primary btn-sm rounded-xl"
                  disabled={loading || items.length === 0 || unreadCount === 0}
                >
                  <CheckCheck size={15} />
                  تعليم الكل
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-soft/40 p-8 text-center text-sm font-bold text-muted">
                  لا توجد إشعارات حالياً
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className={`rounded-3xl border p-4 ${
                        item.is_read
                          ? "border-border bg-card"
                          : "border-border-accent bg-accent-soft/35"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {!item.is_read ? (
                              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                            ) : null}
                            <h4 className="text-sm font-black text-main">
                              {item.title}
                            </h4>
                          </div>
                          {item.message ? (
                            <p className="mt-2 text-xs font-bold leading-relaxed text-muted">
                              {item.message}
                            </p>
                          ) : null}
                          <div className="mt-2 text-[11px] font-bold text-subtle">
                            {dateTime(item.created_at)}
                          </div>
                        </div>

                        {item.is_read ? (
                          <span className="shrink-0 text-[11px] font-black text-subtle">
                            مقروء
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => toggleRead(item)}
                            className="btn btn-secondary btn-sm rounded-xl shrink-0 text-[11px]"
                          >
                            تمييز كمقروء
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <footer className="border-t border-border bg-soft/40 p-4">
              <div className="mb-3 text-center text-xs font-black text-muted">
                الصفحة {meta.page} من {meta.totalPages}
              </div>
              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  disabled={loading || meta.page <= 1}
                  onClick={() => load(meta.page - 1)}
                  className="btn btn-secondary btn-sm rounded-2xl"
                >
                  <ChevronRight size={15} />
                  السابق
                </button>
                <button
                  type="button"
                  disabled={loading || meta.page >= meta.totalPages}
                  onClick={() => load(meta.page + 1)}
                  className="btn btn-secondary btn-sm rounded-2xl"
                >
                  التالي
                  <ChevronLeft size={15} />
                </button>
              </div>
            </footer>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
