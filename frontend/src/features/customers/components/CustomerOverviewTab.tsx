/** Customers CustomerOverviewTab (moved from CustomerDetail page, no logic changes). */
import { useState } from "react";
import { Activity, CalendarClock, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatTime12h } from "@/lib/core/utils";
import { getInvoiceStatusConfig, getStatusConfig } from "@/features/customers/utils/customer";
import { TabsContent } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";

export default function CustomerOverviewTab({
  customer,
  stats,
  tierInfo,
  appointments,
  appointmentsLoading,
  invoices,
  invoicesLoading,
  activityLogs = [],
  activityLoading = false,
}: {
  customer: any;
  stats: any;
  tierInfo: any;
  appointments: any[];
  appointmentsLoading: boolean;
  invoices: any[];
  invoicesLoading: boolean;
  activityLogs?: any[];
  activityLoading?: boolean;
}) {
  const { t, i18n } = useTranslation("customers");
  const dateLocale = i18n.language.startsWith("ar") ? "ar-EG" : "en-GB";
  const [activityFilter, setActivityFilter] = useState("all");

  const activityTypeLabels: Record<string, string> = {
    all: t("overview.activityFilters.all"),
    appointment: t("overview.activityFilters.appointment"),
    invoice: t("overview.activityFilters.invoice"),
    edit: t("overview.activityFilters.edit"),
    payment: t("overview.activityFilters.payment"),
  };

  const filterActivity = (log: any) => {
    const action = String(log.action || log.description || "").toLowerCase();
    if (activityFilter === "all") return true;
    if (activityFilter === "appointment")
      return /appointment|booking|visit|schedule/.test(action);
    if (activityFilter === "invoice")
      return /invoice|bill|receipt/.test(action);
    if (activityFilter === "edit")
      return /edit|update|profile|customer|name|phone|email/.test(action);
    if (activityFilter === "payment")
      return /pay|transaction|refund|deposit/.test(action);
    return true;
  };

  const filteredLogs = activityLogs.filter(filterActivity);

  // Calculate heatmap data - visits per hour of day
  const hourCounts: Record<number, number> = {};
  for (let h = 0; h < 24; h++) hourCounts[h] = 0;
  appointments.forEach((appt) => {
    const timeStr = appt.appointment_time || appt.appointmentTime || "";
    const hour = parseInt(timeStr.split(":")[0], 10);
    if (!isNaN(hour) && hour >= 0 && hour < 24) {
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  });
  const heatmapData = Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    .sort((a, b) => a.hour - b.hour);

  return (
    <TabsContent value="overview" className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Appointments */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
            <CalendarClock size={14} className="text-primary" />{" "}
            {t("overview.recentAppointments")}
          </h3>
          {appointmentsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <p className="text-xs font-bold text-muted text-center py-6">
              {t("overview.noAppointments")}
            </p>
          ) : (
            <div className="space-y-2">
              {appointments.slice(0, 5).map((appt) => {
                const conf = getStatusConfig(appt.status);
                return (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between rounded-lg border p-2.5"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <conf.icon size={12} className={conf.color} />
                        <p className="text-xs font-black text-main">
                          {new Date(
                            appt.appointment_date,
                          ).toLocaleDateString(dateLocale, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <p className="text-[9px] font-bold text-muted">
                        {formatTime12h(
                          String(
                            appt.appointment_time ||
                              appt.appointmentTime ||
                              "",
                          ).slice(0, 5),
                        )}{" "}
                        •{" "}
                        {appt.barber_name || appt.employee_name || "?"}
                      </p>
                    </div>
                    <span
                      className={cn("text-[9px] font-black", conf.color)}
                    >
                      {t(conf.label)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
            <Receipt size={14} className="text-primary" />{" "}
            {t("overview.recentInvoices")}
          </h3>
          {invoicesLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-xs font-bold text-muted text-center py-6">
              {t("overview.noInvoices")}
            </p>
          ) : (
            <div className="space-y-2">
              {invoices.slice(0, 5).map((inv) => {
                const conf = getInvoiceStatusConfig(inv);
                return (
                  <div
                    key={inv.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-2.5",
                      conf.bg,
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Receipt size={12} className={conf.color} />
                      <div>
                        <p className="text-xs font-black text-main">
                          {inv.invoice_no || `#${inv.id}`}
                        </p>
                        <p className="text-[9px] font-bold text-muted">
                          {new Date(inv.created_at).toLocaleDateString(
                            dateLocale,
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="text-xs font-black text-emerald-600">
                        {formatCurrency(inv.total_amount)}
                      </p>
                      <span
                        className={cn(
                          "text-[8px] font-black",
                          conf.color,
                        )}
                      >
                        {t(conf.label)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-start gap-2">
            <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
              <Activity size={14} className="text-primary" />{" "}
              {t("overview.activityLog")}
            </h3>
            <div className="ml-auto flex gap-1 flex-wrap">
              {Object.entries(activityTypeLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActivityFilter(key)}
                  className={cn(
                    "px-2 py-1 rounded-md text-[9px] font-bold transition-colors",
                    activityFilter === key
                      ? "bg-primary text-white"
                      : "bg-soft text-muted hover:text-main",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {activityLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-9 rounded-lg" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="text-xs font-bold text-muted text-center py-4">
              {activityFilter === "all"
                ? t("overview.noActivity")
                : "لا توجد أنشطة مطابقة لهذا النوع"}
            </p>
          ) : (
            <div className="space-y-1.5">
              {filteredLogs.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2.5 rounded-lg bg-soft/60 p-2.5"
                >
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-main">
                      {log.description || log.action}
                    </p>
                    <p className="text-[9px] font-bold text-muted">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString(dateLocale, {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                      {log.user_name ? ` • ${log.user_name}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Heatmap - Peak Visit Hours */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
            <Activity size={14} className="text-primary" />{" "}
            {t("heatmap.title")}
          </h3>
          {heatmapData.length === 0 ||
            heatmapData.every((h) => h.count === 0) ? (
            <p className="text-xs font-bold text-muted text-center py-6">
              {t("heatmap.noData")}
            </p>
          ) : (
            <div className="flex items-end gap-1 h-32 px-4">
              {heatmapData.map((h) => (
                <div
                  key={h.hour}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className={cn(
                      "w-6 rounded-t-sm transition-colors",
                      h.count === 0
                        ? "bg-soft/30"
                        : h.count < 3
                        ? "bg-emerald-100"
                        : h.count < 6
                        ? "bg-emerald-200"
                        : h.count < 10
                        ? "bg-emerald-300"
                        : "bg-emerald-400",
                      h.count > 0 ? "opacity-100" : "opacity-30",
                    )}
                    style={{ height: `${Math.max(10, h.count * 8)}px` }}
                  />
                  <span className="text-[9px] font-black text-muted">
                    {h.hour}:00
                  </span>
                  <span className="text-[9px] font-black text-main">
                    {h.count}
                  </span>
                </div>
              ))}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-black text-muted text-center">
                  {t("heatmap.visits")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </TabsContent>
  );
}
