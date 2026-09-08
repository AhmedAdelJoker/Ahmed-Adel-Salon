import { useEffect, useState } from "react";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { notificationService } from "@/services/notificationService";
import { notify } from "@/lib/core/toast";
import EmptyState from "@/components/shared/EmptyState";
import { dateTime } from "@/lib/format/formatters";

export default function NotificationCenter() {
   
  const [items, setItems] = useState<any[]>([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    pageSize: 5,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  async function load(page = 1): Promise<void> {
    setLoading(true);
    try {
      const data = await notificationService.list({
        page,
        page_size: 5,
      });
      setItems((data as any).items || []);
      setMeta({
        total: (data as any).total || 0,
        page: (data as any).page || 1,
        pageSize: (data as any).page_size || 5,
        totalPages: (data as any).total_pages || 1,
      });
    } catch (err) {
      notify.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "فشل تحميل الإشعارات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
  }, []);

  async function markRead(id: string | number, is_read: boolean): Promise<void> {
    if (!is_read) return;

    try {
      await notificationService.markRead(id);
      await load(meta.page);
    } catch (err) {
      notify.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "فشل تحديث الإشعار");
    }
  }

  async function markAllRead(): Promise<void> {
    try {
      const unreadIds = items
        .filter((item: any) => !item.is_read)
        .map((item: any) => item.id);
      await notificationService.markAllRead(unreadIds);
      notify.success("تم تعليم كل الإشعارات كمقروءة");
      await load(1);
    } catch (err) {
      notify.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "فشل تحديث الإشعارات");
    }
  }

  const unreadCount = items.filter((item: any) => !item.is_read).length;

  return (
    <section
      className="card rounded-3xl border border-border bg-card shadow-soft overflow-hidden"
      dir="rtl"
    >
      <header className="border-b border-border bg-soft/50 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-border-accent bg-accent-soft p-3 text-accent">
              <Bell size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-main">مركز الإشعارات</h2>
              <p className="mt-1 text-sm font-bold text-muted">
                متابعة التنبيهات التشغيلية وآخر إشعارات النظام
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="badge badge-gold">الإجمالي: {meta.total}</span>
                <span className="badge badge-info">
                  غير المقروء: {unreadCount}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={markAllRead}
            className="btn btn-primary btn-md rounded-2xl"
            disabled={loading || items.length === 0 || unreadCount === 0}
          >
            <CheckCheck size={16} />
            تعليم الكل كمقروء
          </button>
        </div>
      </header>

      <div className="p-5 sm:p-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={34} />}
            title="لا توجد إشعارات"
            text="ستظهر هنا تنبيهات النظام عند توفرها."
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={item.id}
                className={`rounded-3xl border p-4 transition-all ${
                  item.is_read
                    ? "border-border bg-card"
                    : "border-border-accent bg-accent-soft/35"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span
                      className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                        item.is_read ? "bg-border-3" : "bg-accent"
                      }`}
                    />
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-main">
                        {item.title}
                      </h3>
                      {item.message ? (
                        <p className="mt-1 text-sm font-bold leading-relaxed text-muted">
                          {item.message}
                        </p>
                      ) : null}
                      <div className="mt-2 text-xs font-bold text-subtle">
                        {dateTime(item.created_at)}
                      </div>
                    </div>
                  </div>

                  {item.is_read ? (
                    <span className="text-xs font-black text-subtle">
                      مقروء
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => markRead(item.id, true)}
                      className="btn btn-secondary btn-sm rounded-2xl shrink-0"
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

      <footer className="flex flex-col gap-3 border-t border-border bg-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-black text-muted">
          الصفحة {meta.page} من {meta.totalPages}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load(meta.page - 1)}
            disabled={loading || meta.page <= 1}
            className="btn btn-secondary btn-sm rounded-2xl"
          >
            <ChevronRight size={15} />
            السابق
          </button>
          <button
            type="button"
            onClick={() => load(meta.page + 1)}
            disabled={loading || meta.page >= meta.totalPages}
            className="btn btn-secondary btn-sm rounded-2xl"
          >
            التالي
            <ChevronLeft size={15} />
          </button>
        </div>
      </footer>
    </section>
  );
}
