import React, { useEffect, useMemo, useState } from "react";

import { toast } from "react-hot-toast";
import {
  getReadyBookingsForPos,
  bookingToPosDraft,
  markBookingPaid,
} from "@/features/bookings/services/bookingPosBridgeService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CalendarCheck, RefreshCw, Send, X } from "lucide-react";

function money(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function bookingTitle(booking) {
  return booking?.service_name || booking?.serviceName || "خدمة حجز";
}

function customerName(booking) {
  return booking?.customer_name || booking?.customerName || "عميل حجز";
}

function employeeName(booking) {
  return booking?.employee_name || booking?.employeeName || "غير محدد";
}

export interface ReadyBooking {
  id?: string | number;
  amount?: number | string;
  [key: string]: unknown;
}

export default function ReadyBookingsForPosPanel({ onSelectBooking }: { onSelectBooking?: (draft: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<ReadyBooking[]>([]);

  async function loadBookings() {
    try {
      setLoading(true);
      const list = await getReadyBookingsForPos();
      setBookings(Array.isArray(list) ? list as ReadyBooking[] : []);
    } catch (error) {
      const apiErr = error as { response?: { data?: unknown }; message?: string };
      console.error("ready bookings error", apiErr?.response?.data || error);
      const detail =
        (apiErr?.response as { data?: { detail?: unknown } } | undefined)?.data?.detail ||
        apiErr?.message ||
        "تعذر تحميل الحجوزات الجاهزة للدفع";
      toast.error(
        typeof detail === "string"
          ? detail
          : "تعذر تحميل الحجوزات الجاهزة للدفع",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) loadBookings();
  }, [open]);

  const total = useMemo(
    () =>
      bookings.reduce((sum, booking) => sum + Number(booking?.amount || 0), 0),
    [bookings],
  );

  function sendToPos(booking: ReadyBooking) {
    const draft = bookingToPosDraft(booking);
    localStorage.setItem("pos_booking_draft", JSON.stringify(draft));
    window.dispatchEvent(
      new window.CustomEvent("pos:booking-draft", { detail: draft }),
    );
    if (typeof onSelectBooking === "function") onSelectBooking(draft);
    toast.success(
      "تم تجهيز الحجز داخل الكاشير. إذا لم يظهر تلقائيًا اضغط تحديث أو افتح POS مرة أخرى.",
    );
    setOpen(false);
  }

  async function markPaidManually(booking: ReadyBooking) {
    const invoiceId = window.prompt(
      "اكتب رقم الفاتورة المرتبطة بالحجز لتعليمه كمدفوع:",
    );
    if (!invoiceId) return;
    try {
      await markBookingPaid(booking.id, Number(invoiceId));
      toast.success("تم تعليم الحجز كمدفوع");
      loadBookings();
    } catch (error) {
      const apiErr = error as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr?.response?.data?.detail as string) || "تعذر تعليم الحجز كمدفوع");
    }
  }

  return (
    <Card
      className="mb-4 border-cyan-100 bg-cyan-50/50 p-4 shadow-sm dark:border-cyan-400/20 dark:bg-cyan-400/5"
      dir="rtl"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300">
            <CalendarCheck size={23} />
          </div>
          <div>
            <h3 className="font-black text-gray-950 dark:text-gray-50">
              حجوزات جاهزة للدفع
            </h3>
            <p className="text-xs font-bold text-gray-500">
              اسحب حجز مكتمل إلى الكاشير لإنشاء فاتورة بسرعة
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{bookings.length} حجز</Badge>
          <Badge variant="secondary">{money(total)}</Badge>
          <Button
            type="button"
            disabled={loading}
            onClick={() => setOpen(!open)}
            className="rounded-2xl font-black"
          >
            {open ? (
              <X size={16} className="ml-2" />
            ) : (
              <CalendarCheck size={16} className="ml-2" />
            )}
            {open ? "إخفاء" : "عرض الحجوزات"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={loadBookings}
            className="rounded-2xl font-black"
          >
            <RefreshCw
              size={16}
              className={loading ? "ml-2 animate-spin" : "ml-2"}
            />{" "}
            تحديث
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 overflow-hidden rounded-3xl border bg-white dark:border-white/10 dark:bg-white/5">
          {loading ? (
            <div className="flex min-h-28 items-center justify-center text-sm font-bold text-gray-500">
              <RefreshCw className="ml-2 h-4 w-4 animate-spin" /> جاري تحميل
              الحجوزات...
            </div>
          ) : bookings.length === 0 ? (
            <div className="min-h-28 p-6 text-center text-sm font-bold text-gray-400">
              لا توجد حجوزات جاهزة للدفع الآن
            </div>
          ) : (
            <div className="max-h-80 overflow-auto divide-y divide-gray-100 dark:divide-white/10">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black">#{booking.id}</span>
                      <span className="font-black text-cyan-700 dark:text-cyan-300">
                        {bookingTitle(booking)}
                      </span>
                      <Badge variant="secondary">{money(booking.amount)}</Badge>
                    </div>
                    <p className="mt-1 text-xs font-bold text-gray-500">
                      العميل: {customerName(booking)} · الموظف:{" "}
                      {employeeName(booking)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={loading}
                      onClick={() => sendToPos(booking)}
                      className="rounded-xl font-black"
                    >
                      <Send size={14} className="ml-1" /> تحويل لفاتورة
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={() => markPaidManually(booking)}
                      className="rounded-xl font-black"
                    >
                      تعليم كمدفوع
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
