import { useEffect } from 'react';
import { Scissors, Sparkles, Receipt, Activity } from "lucide-react";
import { currency } from "../../lib/formatters";

export default function TopPerformancePanel({ widgets = {}, className = "" }) {
  const topBarber = widgets?.top_barber || {};
  const topService = widgets?.top_service || {};
  const latestInvoices = widgets?.latest_invoices || [];
  const latestActivities = widgets?.latest_activities || [];

  


return (

    <section
      className={`card rounded-3xl border border-border bg-card p-5 shadow-soft ${className}`}
      dir="rtl"
    >
      <div className="mb-5">
        <h3 className="text-lg font-black tracking-tight text-main">
          أفضل أداء اليوم
        </h3>
        <p className="mt-1 text-xs font-bold leading-relaxed text-muted">
          لمحة سريعة عن الأفضل أداءً خلال الفترة الحالية
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-border bg-soft/50 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-2xl border border-border-accent bg-accent-soft p-3 text-accent">
              <Scissors size={20} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-muted">
                أفضل حلاق
              </div>
              <div className="text-base font-black text-main">
                {topBarber?.barber_name || "—"}
              </div>
            </div>
          </div>
          <div className="text-2xl font-black text-accent">
            {currency(topBarber?.total_revenue || 0)}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-soft/50 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-2xl border border-border-accent bg-accent-soft p-3 text-accent">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-muted">
                أفضل خدمة
              </div>
              <div className="text-base font-black text-main">
                {topService?.service_name || "—"}
              </div>
            </div>
          </div>
          <div className="text-2xl font-black text-accent">
            {currency(topService?.total_revenue || 0)}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <Receipt size={18} className="text-accent" />
            <h4 className="text-sm font-black text-main">أحدث الفواتير</h4>
          </div>

          {latestInvoices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-soft/40 p-4 text-center text-xs font-bold text-muted">
              لا توجد فواتير حديثة
            </div>
          ) : (
            <div className="space-y-3">
              {latestInvoices.map((item) => (
                <div
                  key={item.id || item.invoice_no}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-soft/50 p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-main">
                      {item.invoice_no}
                    </div>
                    <p className="truncate text-xs font-bold text-muted">
                      {item.customer_name || "عميل نقدي"}
                    </p>
                  </div>
                  <div className="shrink-0 text-sm font-black text-success">
                    {currency(item.total_amount || 0)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <Activity size={18} className="text-accent" />
            <h4 className="text-sm font-black text-main">آخر الأنشطة</h4>
          </div>

          {latestActivities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-soft/40 p-4 text-center text-xs font-bold text-muted">
              لا توجد أنشطة حديثة
            </div>
          ) : (
            <div className="space-y-3">
              {latestActivities.map((item, index) => (
                <div
                  key={item.id || `${item.action}-${index}`}
                  className="rounded-2xl border border-border bg-soft/50 p-3"
                >
                  <div className="text-sm font-black text-main">
                    {item.action}
                  </div>
                  <p className="mt-1 text-xs font-bold leading-relaxed text-muted">
                    {item.description || "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


