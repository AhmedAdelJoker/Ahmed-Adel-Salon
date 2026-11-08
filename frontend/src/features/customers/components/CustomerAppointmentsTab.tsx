/** Customers CustomerAppointmentsTab (moved from CustomerDetail page, no logic changes). */
import { useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatTime12h } from "@/lib/core/utils";
import { getStatusConfig } from "@/features/customers/utils/customer";
import { EmptyState } from "@/components/shared/EmptyState";
import { TabsContent } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import api from "@/services/api";
import { toast } from "react-hot-toast";

export default function CustomerAppointmentsTab({
  appointments,
  loading,
}: {
  appointments: any[];
  loading: boolean;
}) {
  const { t, i18n } = useTranslation("customers");
  const dateLocale = i18n.language.startsWith("ar") ? "ar-EG" : "en-GB";
  const [showAll, setShowAll] = useState(false);

  const displayAppointments = showAll ? appointments : appointments.slice(0, 5);

  const payNow = async (appt: any) => {
    try {
      await api.post("/appointments/fast-walkin", {
        customer_id: appt.customer_id,
        service_ids: appt.services?.map((s: any) => s.id) || [appt.service_id],
        employee_id: appt.barber_id || appt.employee_id || null,
        appointment_date: appt.appointment_date,
        appointment_time: appt.appointment_time || appt.appointmentTime,
        notes: appt.notes || "",
        booking_source: "shop",
      });
      toast.success(t("quickActions.transferPOS"));
    } catch (err) {
      toast.error(t("bookingModal.failed"));
    }
  };

  const cancelAllAppointments = async () => {
    const upcoming = appointments.filter((a) =>
      ["pending", "confirmed", "waiting"].includes(
        String(a.status || "").toLowerCase(),
      ),
    );
    if (upcoming.length === 0) return;
    const confirmed = window.confirm(t("appointments.cancelAllConfirm"));
    if (!confirmed) return;
    try {
      await Promise.all(
        upcoming.map((a) =>
          api.delete(`/appointments/${a.id || a.appointment_id}`),
        ),
      );
      toast.success(t("appointments.cancelAllSuccess"));
    } catch (err) {
      toast.error(t("appointments.cancelAllFailed"));
    }
  };

  return (
    <TabsContent value="appointments" className="mt-4">
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState variant="inline"
          icon={CalendarClock}
          title={t("appointments.noAppointments")}
          message={t("appointments.emptyMessage")}
        />
      ) : (
        <div className="space-y-2">
          {displayAppointments.map((appt) => {
            const conf = getStatusConfig(appt.status);
            return (
              <div
                key={appt.id}
                className="rounded-xl border bg-card p-3 shadow-soft sm:p-4"
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
                        ).toLocaleDateString(dateLocale, {
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
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "text-[10px] font-black px-2 py-1 rounded-lg",
                        conf.bg,
                        conf.color,
                      )}
                    >
                      {t(conf.label)}
                    </span>
                    {conf.label !== "COMPLETED" && conf.label !== "DONE" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => payNow(appt)}
                        className="h-7 px-2 text-[10px]"
                        aria-label={t("appointments.payNow")}
                      >
                        {t("appointments.payNow")}
                      </Button>
                    )}
                  </div>
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
          {appointments.length > 5 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="w-full text-[10px]"
            >
              {showAll
                ? t("appointments.showLess")
                : t("appointments.showRemaining", { count: appointments.length - 5 })}
            </Button>
          )}
          {appointments.some((a) =>
            ["pending", "confirmed", "waiting"].includes(
              String(a.status || "").toLowerCase(),
            ),
          ) && (
            <Button
              variant="danger"
              size="sm"
              onClick={cancelAllAppointments}
              className="w-full text-[10px] mt-2"
              aria-label={t("appointments.cancelAll")}
            >
              <Trash2 size={12} className="mr-1" /> {t("appointments.cancelAll")}
            </Button>
          )}
        </div>
      )}
    </TabsContent>
  );
}
