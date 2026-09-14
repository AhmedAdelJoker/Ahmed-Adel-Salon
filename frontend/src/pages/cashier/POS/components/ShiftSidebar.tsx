import React, { useState } from "react";
import { usePOS } from "@/pages/cashier/POS/POSContext";
import { useSalon } from "@/context/SalonContext";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Wallet,
  Clock,
  CheckCircle2,
  Activity,
  LogOut,
  Printer,
  FileText,
  AlertCircle,
  User,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/core/utils";
import { posShiftService } from "@/services/posShiftService";
import { toast } from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { printReceiptNative } from "@/lib/print/thermal";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const ShiftSidebar = () => {
  const {
    currentShift,
    fetchShift,
    readyAppointments,
    isShopOpen,
  } = usePOS();
  const { drawerBalance, valutBalance, vaultCashBalance, refreshBalance } = useSalon();

  const [openingCash, setOpeningCash] = useState("0");
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [closingCash, setClosingCash] = useState("0");
  const [isClosingShift, setIsClosingShift] = useState(false);

  // Auto-refresh shift status from server every 1 minute to catch auto-closures
  React.useEffect(() => {
    const timer = setInterval(() => {
      fetchShift();
    }, 60000);
    return () => clearInterval(timer);
  }, [fetchShift]);

  const hasOpenShift = Boolean(
    currentShift &&
    ["open", "opened", "OPEN", "OPENED"].includes(
      String(currentShift.status || "open"),
    ),
  );

  const handleOpenShift = async () => {
    if (!isShopOpen) {
      toast.error("عذراً، المحل مغلق حالياً ولا يمكن فتح وردية جديدة.");
      return;
    }
    try {
      setIsOpeningShift(true);
      await posShiftService.open({ openingCash });
      await fetchShift();
      await refreshBalance();
      toast.success("تم فتح الوردية بنجاح — تم التحديث في الخزنة المركزية");
    } catch (error) {
       
      const apiErr = error as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr.response?.data?.detail as string) || "فشل فتح الوردية");
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handleCloseShift = async () => {
    try {
      setIsClosingShift(true);
      const shiftId = currentShift?.id || currentShift?.shift_id;
      const response = await posShiftService.close(shiftId, { closingCash });

       
      const closedData = (response as any)?.data || response;
      await fetchShift();
      await refreshBalance();
      setShowCloseShift(false);
      toast.success("تم إنهاء الوردية بنجاح — الخزنة محدثة");

      // Print enriched report
      printShiftReport(closedData);
    } catch (error) {
      console.error("Close shift error:", error);
      toast.error("فشل إنهاء الوردية");
    } finally {
      setIsClosingShift(false);
    }
  };

  const expectedAmount =
    Number(currentShift?.opening_cash || 0) +
    Number(currentShift?.total_sales || 0);
  const difference = Number(closingCash) - expectedAmount;

  const printShiftReport = async (data) => {
    const shift = data.shift || data;
    const stats = data.stats || {};

    const receiptData = {
      invoiceId: `shift-${shift.id}`,
      invoiceNo: `SHIFT-${shift.id}`,
      customerName: `الكاشير: ${stats.cashier_name || "—"}`,
      createdAt: new Date().toLocaleString("ar-EG"),
      paymentMethod: "cash",
      items: [
        {
          name: "الرصيد الافتتاحي",
          qty: 1,
          price: Number(shift.opening_cash || 0),
          barber: "",
        },
        {
          name: "إجمالي المبيعات (كاش)",
          qty: 1,
          price: Number(stats.cash_sales || 0),
          barber: "",
        },
        {
          name: "مبيعات الشبكة (Card)",
          qty: 1,
          price: Number(stats.card_sales || 0),
          barber: "",
        },
        {
          name: "مبيعات الدفع المزدوج",
          qty: 1,
          price: Number(stats.split_sales || 0),
          barber: "",
        },
        {
          name: "إجمالي الخصومات",
          qty: 1,
          price: Number(shift.discount_total || 0),
          barber: "",
        },
        {
          name: "إجمالي المصروفات",
          qty: 1,
          price: Number(stats.total_expenses || 0),
          barber: "",
        },
      ],
      subtotal: Number(shift.total_sales || 0),
      discount: Number(shift.discount_total || 0),
      total: Number(shift.expected_closing_cash || 0),
      shopName: "صالون برو - تقرير وردية",
      shopPhone: "",
      shopAddress: "",
      footer: `نظام صالون برو - ${new Date().getFullYear()} © جميع الحقوق محفوظة`,
      qrDataUrl: "",
      widthMm: 80,
    };

    try {
       
      await printReceiptNative(receiptData as any);
      toast.success("تم إرسال تقرير الوردية للطابعة");
    } catch (error) {
      console.error("Shift report print error:", error);
      toast.error("فشل طباعة التقرير، سيتم فتح نافذة الطباعة");
      // Fallback to browser print
      const reportHtml = `
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
              body { font-family: 'Cairo', sans-serif; padding: 30px; color: #1f2937; background: #fff; line-height: 1.5; }
              .header { text-align: center; border-bottom: 3px solid #D4AF37; padding-bottom: 15px; margin-bottom: 25px; }
              .header h1 { margin: 0; font-size: 26px; font-weight: 900; color: #111827; }
              .header-meta { font-size: 14px; color: #4b5563; margin-top: 8px; font-weight: 700; }
              
              .section-title { font-size: 12px; font-weight: 900; color: #D4AF37; text-transform: uppercase; margin: 30px 0 15px; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; }
              
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
              .item { padding: 15px; border: 1px solid #e5e7eb; border-radius: 16px; background: #f9fafb; }
              .label { font-size: 11px; color: #6b7280; font-weight: 900; margin-bottom: 4px; }
              .value { font-size: 18px; font-weight: 900; color: #111827; }
              
              .stats-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              .stats-table td { padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; font-weight: 700; }
              .stats-table td:last-child { text-align: left; font-weight: 900; }
              
              .footer { text-align: center; margin-top: 50px; font-size: 11px; color: #9ca3af; border-top: 1px dashed #e5e7eb; padding-top: 20px; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>تقرير إغلاق الوردية</h1>
              <div class="header-meta">الموظف: ${stats.cashier_name || "—"}</div>
              <div class="header-meta">رقم الوردية: #${shift.id} • بتاريخ: ${new Date().toLocaleString("ar-EG")}</div>
            </div>

            <div class="section-title">ملخص الحساب النقدي</div>
            <div class="grid">
              <div class="item">
                <div class="label">الرصيد الافتتاحي</div>
                <div class="value">${formatCurrency(shift.opening_cash || 0)}</div>
              </div>
              <div class="item">
                <div class="label">إجمالي المبيعات (كاش)</div>
                <div class="value" style="color: #059669">${formatCurrency(stats.cash_sales || 0)}</div>
              </div>
              <div class="item" style="grid-column: span 2; background: #f3f4f6; border: 2px solid #D4AF37;">
                <div class="label">الرصيد المتوقع بالصندوق</div>
                <div class="value" style="font-size: 24px;">${formatCurrency(shift.expected_closing_cash || 0)}</div>
              </div>
              <div class="item" style="grid-column: span 2; background: #fff; border: 2px solid #111827;">
                <div class="label">الرصيد الفعلي (المجرود)</div>
                <div class="value" style="font-size: 24px;">${formatCurrency(shift.actual_closing_cash || 0)}</div>
              </div>
            </div>

            <div class="section-title">تفاصيل العمليات</div>
            <table class="stats-table">
              <tr><td>إجمالي المبيعات (الكل)</td><td>${formatCurrency(shift.total_sales || 0)}</td></tr>
              <tr><td>مبيعات الشبكة (Card)</td><td>${formatCurrency(stats.card_sales || 0)}</td></tr>
              <tr><td>مبيعات الدفع المزدوج</td><td>${formatCurrency(stats.split_sales || 0)}</td></tr>
              <tr><td>إجمالي الخصومات</td><td style="color: #dc2626">${formatCurrency(shift.discount_total || 0)}</td></tr>
              <tr><td>عدد الخدمات المنفذة</td><td>${stats.service_count || 0}</td></tr>
              <tr><td>عدد المنتجات المباعة</td><td>${stats.product_count || 0}</td></tr>
              <tr><td>إجمالي المصروفات (أثناء الوردية)</td><td style="color: #dc2626">${formatCurrency(stats.total_expenses || 0)}</td></tr>
            </table>

            <div class="footer">
              نظام صالون برو - ${new Date().getFullYear()} © جميع الحقوق محفوظة
              <br/>تم استخراج هذا التقرير آلياً بواسطة ${stats.cashier_name || "النظام"}
            </div>
            <script>window.onload = () => { window.focus(); setTimeout(() => { window.print(); window.close(); }, 500); };</script>
          </body>
        </html>
      `;
      const win = window.open("", "_blank", "width=800,height=600");
      win!.document.write(reportHtml);
      win!.document.close();
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Shift Control Card */}
      <Card className="p-4 sm:p-5 rounded-2xl border border-border/50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl shadow-sm relative overflow-hidden group shrink-0">
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-primary/10 transition-all duration-700" />

        <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 text-primary border border-primary/10">
              <Activity size={14} className="sm:size-4" />
            </div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
              الوردية
            </h2>
          </div>
          <Badge
            className={cn(
              "rounded-lg px-2 sm:px-2.5 py-0.5 font-black text-[8px] sm:text-[9px] uppercase tracking-wider border-none",
              hasOpenShift
                ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/10"
                : "bg-amber-500 text-white shadow-sm shadow-amber-500/10",
            )}
          >
            {hasOpenShift ? "نشطة" : "مغلقة"}
          </Badge>
        </div>

        {hasOpenShift && (
          <div className="mb-3 sm:mb-4 p-2 sm:p-2.5 rounded-xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10 relative z-10">
            <div className="flex items-center gap-1.5 text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 pr-1">
              <User size={8} className="text-primary" /> المسؤول
            </div>
            <div className="text-[11px] sm:text-xs font-black text-slate-700 dark:text-slate-200 truncate">
              {currentShift?.user?.full_name ||
                currentShift?.user?.username ||
                "جاري التحميل..."}
            </div>
          </div>
        )}

        {!hasOpenShift ? (
          <div className="space-y-3 sm:space-y-4 relative z-10">
            {!isShopOpen && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-2 items-start">
                <AlertCircle
                  size={14}
                  className="text-amber-600 shrink-0 mt-0.5"
                />
                <p className="text-[10px] font-bold text-amber-700 leading-tight">
                  المحل خارج ساعات العمل الرسمية حالياً. لا يمكن بدء وردية
                  جديدة.
                </p>
              </div>
            )}
            <div className="space-y-1.5 sm:space-y-2">
              <label
                htmlFor="opening-cash"
                className="text-[8px] sm:text-[9px] font-black uppercase text-slate-400 tracking-widest mr-1"
              >
                الرصيد الافتتاحي
              </label>
              <div className="relative">
                <Input
                  id="opening-cash"
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  disabled={!isShopOpen}
                  className="h-10 sm:h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 font-black text-base sm:text-lg px-3 focus:border-primary/40 transition-all shadow-sm disabled:opacity-50 touch-target"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] sm:text-[9px] font-black text-slate-300">
                  ج.م
                </span>
              </div>
            </div>
            <Button
              className={cn(
                "w-full h-10 sm:h-11 rounded-xl font-black text-xs sm:text-sm shadow-md transition-all flex gap-2",
                isShopOpen
                  ? "bg-slate-900 dark:bg-primary text-white hover:scale-[1.02] active:scale-95"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none",
              )}
              onClick={handleOpenShift}
              disabled={!isShopOpen || isOpeningShift}
              loading={isOpeningShift}
            >
              <Zap size={14} className="sm:size-4" fill="currentColor" />
              {isShopOpen ? "فتح الوردية" : "المحل مغلق حالياً"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3 relative z-10">
            <div className="flex justify-between items-center p-2 sm:p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Clock size={14} className="text-emerald-600 sm:size-4" />
                <span className="text-[9px] sm:text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                  بدأت
                </span>
              </div>
              <span className="text-[11px] sm:text-xs font-black text-slate-700 dark:text-white tabular-nums">
                {(() => {
                  const openedAt = currentShift!.opened_at;
                  if (!openedAt) return "--:--";
                  const dateObj = new Date(
                    openedAt.includes("Z") || openedAt.includes("+")
                      ? openedAt
                      : openedAt.replace(" ", "T") + "Z",
                  );
                  return dateObj.toLocaleTimeString("ar-EG", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  });
                })()}
              </span>
            </div>
            <Button
              variant="outline"
              className="w-full h-9 sm:h-10 border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl font-black text-[10px] sm:text-xs transition-all flex gap-2"
              onClick={() => setShowCloseShift(true)}
            >
              <LogOut size={14} className="sm:size-4" />
              إغلاق الوردية
            </Button>
          </div>
        )}
      </Card>

      {/* Quick Summary Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-3">
        {[
          {
            label: "جلسات جاهزة",
            value: readyAppointments.length,
            icon: Clock,
            bgClass: "bg-indigo-500/5",
            textClass: "text-indigo-600 dark:text-indigo-400",
            iconBg: "bg-indigo-500 text-white",
          },
          {
            label: "مبيعات الوردية",
            value: formatCurrency(currentShift?.total_sales || 0),
            icon: Wallet,
            bgClass: "bg-emerald-500/5",
            textClass: "text-emerald-600 dark:text-emerald-400",
            iconBg: "bg-emerald-500 text-white",
          },
          {
            label: "عدد الفواتير",
            value: currentShift?.invoice_count || 0,
            icon: FileText,
            bgClass: "bg-sky-500/5",
            textClass: "text-sky-600 dark:text-sky-400",
            iconBg: "bg-sky-500 text-white",
          },
          {
            label: "رصيد الخزنة (مرتبط)",
            value: formatCurrency(vaultCashBalance || drawerBalance),
            icon: Wallet,
            bgClass: "bg-emerald-500/5",
            textClass: "text-emerald-600 dark:text-emerald-400",
            iconBg: "bg-emerald-500 text-white",
          },
          {
            label: "الخزنة • الإجمالي",
            value: formatCurrency(valutBalance || drawerBalance),
            icon: Wallet,
            bgClass: "bg-slate-500/5",
            textClass: "text-slate-800 dark:text-slate-200",
            iconBg: "bg-slate-900 text-white",
          },
        ].map((tile, i) => (
          <Card
            key={i}
            className={cn(
              "p-3 sm:p-4 rounded-2xl border border-border/40 bg-white dark:bg-white/5 shadow-sm flex items-center justify-between group hover:shadow-md transition-all duration-300 cursor-default overflow-hidden relative",
              i === 1 && "col-span-2 lg:col-span-1",
            )}
          >
            <div
              className={cn(
                "absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full blur-xl -mr-6 sm:-mr-8 -mt-6 sm:-mt-8 transition-all duration-700 group-hover:scale-150",
                tile.bgClass,
              )}
            />

            <div className="relative z-10 min-w-0">
              <p className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 pr-1 truncate">
                {tile.label}
              </p>
              <p
                className={cn(
                  "text-sm sm:text-lg font-black tabular-nums tracking-tighter truncate",
                  tile.textClass,
                )}
              >
                {tile.value}
              </p>
            </div>
            <div
              className={cn(
                "h-8 w-8 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-sm border border-white/10 shrink-0",
                tile.iconBg,
              )}
            >
              <tile.icon size={14} className="sm:size-[18px]" />
            </div>
          </Card>
        ))}
      </div>

      {/* Close Shift Dialog */}
      <Dialog open={showCloseShift} onOpenChange={setShowCloseShift}>
        <DialogContent
          className="max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl"
          dir="rtl"
        >
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-black tracking-tight">
              إنهاء جلسة الكاشير
            </DialogTitle>
            <DialogDescription className="font-bold text-muted text-base">
              يرجى جرد الصندوق وإدخال المبلغ الفعلي المتوفر الآن.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="p-5 rounded-premium bg-soft/50 border border-border/50 backdrop-blur-sm">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-muted">المتوقع بالنظام:</span>
                  <span className="text-xl font-black text-main">
                    {formatCurrency(expectedAmount)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-main uppercase tracking-widest mr-1">
                  رصيد الإغلاق الفعلي
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    placeholder="0.00"
                    className="h-16 rounded-2xl font-black text-2xl border-2 border-primary/10 focus:border-primary/40 bg-white dark:bg-white/5 pr-4 pl-12 transition-all shadow-sm touch-target"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">
                    ج.م
                  </div>
                </div>
              </div>

              {/* Difference Indicator - The "Red Line" logic */}
              <div
                className={cn(
                  "p-5 rounded-premium border-2 transition-all duration-500 flex justify-between items-center",
                  difference === 0
                    ? "bg-success/5 border-success/20 text-success"
                    : difference > 0
                      ? "bg-blue-50 border-blue-100 text-blue-600"
                      : "bg-red-50 border-red-200 text-red-600 shadow-[0_0_15px_rgba(220,38,38,0.1)]",
                )}
              >
                <div className="flex items-center gap-2">
                  {difference < 0 ? (
                    <AlertCircle size={20} />
                  ) : (
                    <CheckCircle2 size={20} />
                  )}
                  <span className="text-sm font-black uppercase">
                    العجز / الزيادة:
                  </span>
                </div>
                <span className="text-xl font-black tabular-nums">
                  {difference > 0 ? "+" : ""}
                  {formatCurrency(difference)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-8 gap-3 flex-row-reverse">
            <Button
              className="rounded-2xl h-14 font-black text-lg bg-red-600 hover:bg-red-700 text-white flex-1 shadow-lg shadow-red-600/20 transition-all hover:-translate-y-0.5"
              onClick={handleCloseShift}
              loading={isClosingShift}
            >
              <Printer size={20} className="ml-2" />
              إنهاء الوردية والطباعة
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowCloseShift(false)}
              className="rounded-2xl h-14 px-8 font-black text-muted hover:bg-soft transition-all"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftSidebar;
