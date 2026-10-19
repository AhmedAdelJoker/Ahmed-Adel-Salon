/** Customers CustomerOverviewTab (moved from CustomerDetail page, no logic changes). */
import { Activity, CalendarClock, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatTime12h } from "@/lib/core/utils";
import { getInvoiceStatusConfig, getStatusConfig } from "@/features/customers/utils/customer";
import { TabsContent } from "@/components/ui/tabs";

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
  return (
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Recent Appointments */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
                  <CalendarClock size={14} className="text-primary" /> آخر
                  المواعيد
                </h3>
                {appointmentsLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-12 rounded-lg" />
                    ))}
                  </div>
                ) : appointments.length === 0 ? (
                  <p className="text-xs font-bold text-muted text-center py-6">
                    لا توجد مواعيد
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
                                ).toLocaleDateString("ar-EG", {
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
                            {conf.label}
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
                  <Receipt size={14} className="text-primary" /> آخر الفواتير
                </h3>
                {invoicesLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-12 rounded-lg" />
                    ))}
                  </div>
                ) : invoices.length === 0 ? (
                  <p className="text-xs font-bold text-muted text-center py-6">
                    لا توجد فواتير
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
                                  "ar-EG",
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-emerald-600">
                              {formatCurrency(inv.total_amount)}
                            </p>
                            <span
                              className={cn(
                                "text-[8px] font-black",
                                conf.color,
                              )}
                            >
                              {conf.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Activity Log */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
                <Activity size={14} className="text-primary" /> سجل النشاط
              </h3>
              {activityLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-9 rounded-lg" />
                  ))}
                </div>
              ) : activityLogs.length === 0 ? (
                <p className="text-xs font-bold text-muted text-center py-4">
                  لا توجد أنشطة مسجلة
                </p>
              ) : (
                <div className="space-y-1.5">
                  {activityLogs.slice(0, 8).map((log) => (
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
                            ? new Date(log.created_at).toLocaleString("ar-EG", {
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
          </TabsContent>
  );
}
