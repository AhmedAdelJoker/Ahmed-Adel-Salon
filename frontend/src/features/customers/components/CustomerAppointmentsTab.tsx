/** Customers CustomerAppointmentsTab (moved from CustomerDetail page, no logic changes). */
import { CalendarClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatTime12h } from "@/lib/core/utils";
import { getStatusConfig } from "@/features/customers/utils/customer";
import CustomerInlineEmptyState from "@/features/customers/components/CustomerInlineEmptyState";
import { TabsContent } from "@/components/ui/tabs";

export default function CustomerAppointmentsTab({
  appointments,
  loading,
}: {
  appointments: any[];
  loading: boolean;
}) {
  return (
          <TabsContent value="appointments" className="mt-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : appointments.length === 0 ? (
              <CustomerInlineEmptyState
                icon={CalendarClock}
                title="لا توجد مواعيد"
                description="لم يتم تسجيل أي مواعيد لهذا العميل"
              />
            ) : (
              <div className="space-y-2">
                {appointments.map((appt) => {
                  const conf = getStatusConfig(appt.status);
                  return (
                    <div
                      key={appt.id}
                      className={cn(
                        "rounded-xl border bg-card p-3 shadow-soft sm:p-4",
                        conf.border,
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-9 w-9 rounded-lg flex items-center justify-center",
                              conf.bg,
                            )}
                          >
                            <conf.icon size={14} className={conf.color} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-main">
                              {new Date(
                                appt.appointment_date,
                              ).toLocaleDateString("ar-EG", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}
                            </p>
                            <p className="text-[9px] font-bold text-muted">
                              {formatTime12h(
                                String(
                                  appt.appointment_time ||
                                    appt.appointmentTime ||
                                    "",
                                ).slice(0, 5),
                              )}{" "}
                              • {appt.barber_name || appt.employee_name || "?"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-black px-2 py-1 rounded-lg",
                            conf.bg,
                            conf.color,
                          )}
                        >
                          {conf.label}
                        </span>
                      </div>
                      {appt.services && appt.services.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {appt.services.map((s, i) => (
                            <span
                              key={i}
                              className="text-[8px] font-bold bg-soft px-1.5 py-0.5 rounded"
                            >
                              {s.service_name_snapshot ||
                                s.service_name ||
                                s.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
  );
}
