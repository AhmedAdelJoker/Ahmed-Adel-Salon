const groups = [
  {
    key: "waiting",
    title: "بانتظار البدء",
    tone: "badge badge-warning",
    dot: "bg-warning",
  },
  {
    key: "inProgress",
    title: "قيد التنفيذ",
    tone: "badge badge-info",
    dot: "bg-info",
  },
  {
    key: "completedUnpaid",
    title: "جاهز للمحاسبة",
    tone: "badge badge-gold",
    dot: "bg-accent",
  },
  {
    key: "checkedOut",
    title: "تم السداد",
    tone: "badge badge-success",
    dot: "bg-success",
  },
];

export default function TodayQueuePanel({
  waiting = [],
  inProgress = [],
  completedUnpaid = [],
  checkedOut = [],
  className = "",
}) {
  const source = {
    waiting,
    inProgress,
    completedUnpaid,
    checkedOut,
  };

  return (
    <section
      className={`card rounded-3xl border border-border bg-card p-5 shadow-soft ${className}`}
      dir="rtl"
    >
      <div className="mb-5">
        <h3 className="text-lg font-black tracking-tight text-main">
          حالة التشغيل اليوم
        </h3>
        <p className="mt-1 text-xs font-bold leading-relaxed text-muted">
          متابعة سريعة لحالة العملاء والجلسات الحالية
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {groups.map((group) => {
          const items = source[group.key] || [];

          return (
            <div
              key={group.key}
              className="rounded-3xl border border-border bg-soft/50 p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className={group.tone}>{group.title}</span>
                <span className="text-xl font-black text-main">
                  {items.length}
                </span>
              </div>

              <div className="space-y-3">
                {items.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border bg-card p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${group.dot}`}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-main">
                          {item.customer_name || `جلسة #${item.id}`}
                        </div>
                        <p className="mt-1 truncate text-xs font-bold text-muted">
                          {item.service_name || "—"} • {item.barber_name || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-card/60 p-4 text-center text-xs font-bold text-muted">
                    لا توجد عناصر حالياً
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
