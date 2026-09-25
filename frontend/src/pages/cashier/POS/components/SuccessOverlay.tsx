import React, { useEffect, useState } from "react";
import { usePOS } from "@/pages/cashier/POS/POSContext";
import { useSalon } from "@/context/SalonContext";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/core/utils";
import { printThermalReceipt } from "@/lib/print/receipt";
import { printReceiptNative } from "@/lib/print/thermal";
import {
  Printer,
  CheckCircle2,
  User,
  Zap,
  ArrowRight,
  ShoppingBag,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { toast } from "react-hot-toast";
import { AnimatePresence } from "framer-motion";

const SuccessOverlay = () => {
  const {
    lastInvoice,
    setLastInvoice,
    completedCustomerName,
    completedBarberName,
    resetPOS,
  } = usePOS();
  const { settings } = useSalon();
  const [printing, setPrinting] = useState(false);
  const [printMethod, setPrintMethod] = useState("browser"); // "browser" | "native"
   
  const [nativePrinterError, setNativePrinterError] = useState<any>(null);

  useEffect(() => {
    if (lastInvoice) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#38bdf8", "#10b981"],
      });
    }
  }, [lastInvoice]);

  if (!lastInvoice) return null;

  const buildReceiptData = () => {
    const invoice = lastInvoice;
    const shopName = settings?.salon_name || settings?.salonName || "صالون برو";
    const shopPhone = settings?.shop_phone || settings?.shopPhone || "";
    const shopAddress = settings?.address || settings?.shopAddress || "";
    const footer =
      settings?.receipt_footer || settings?.receiptFooter || "شكراً لزيارتكم";
    const publicSlug = settings?.public_slug || "default-salon";

    const invoiceNo =
      invoice.invoice_no ||
      invoice.invoiceNo ||
      invoice.number ||
      invoice.invoice_id ||
      invoice.id ||
      "-";
    const customerName =
      invoice.customer_name ||
      invoice.customerName ||
      completedCustomerName ||
      "عميل نقدي";
    const createdAt = new Date(
      invoice.created_at || invoice.createdAt || new Date(),
    ).toLocaleString("ar-EG", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const paymentMethod = (
      invoice.payment_method ||
      invoice.paymentMethod ||
      "cash"
    ).toLowerCase();

    const rows = Array.isArray(invoice.items)
      ? invoice.items
      : Array.isArray(invoice.invoice_items)
        ? invoice.invoice_items
        : [];

    const items = rows.map((item) => ({
      name:
        item.service_name ||
        item.serviceName ||
        item.product_name ||
        item.productName ||
        item.name ||
        "بند",
      qty: Number(item.quantity || item.qty || 1),
      price: Number(
        item.total_price ||
          item.totalPrice ||
          item.unit_price ||
          item.price ||
          0,
      ),
      barber:
        item.barber_name ||
        item.barberName ||
        item.employee_name ||
        item.employeeName ||
        "",
    }));

    const subtotal = Number(
      invoice.subtotal_amount ||
        invoice.subtotalAmount ||
        invoice.total_amount ||
        0,
    );
    const discount = Number(
      invoice.discount_amount || invoice.discountAmount || 0,
    );
    const total = Number(invoice.total_amount || invoice.totalAmount || 0);

    // Generate QR code data URL for native printing
    const qrDataUrl = `https://salon-pro.com/${publicSlug}?invoice=${invoiceNo}`;

    return {
      invoiceId: invoice.invoice_id || invoice.invoiceId || invoice.id || "",
      invoiceNo,
      customerName,
      createdAt,
      paymentMethod,
      items,
      subtotal,
      discount,
      total,
      shopName,
      shopPhone,
      shopAddress,
      footer,
      qrDataUrl,
      widthMm: 80,
    };
  };

  const handlePrint = async () => {
    setPrinting(true);
    setNativePrinterError(null);

    try {
      const receiptData = buildReceiptData();

      if (printMethod === "native") {
         
        await printReceiptNative(receiptData as any);
        toast.success("تم الإرسال للطابعة الحرارية");
      } else {
        await printThermalReceipt(lastInvoice, settings);
        toast.success("تم فتح نافذة الطباعة");
      }
    } catch (error) {
      console.error("Print error:", error);
       
      const apiErr = error as { message?: string };
      setNativePrinterError(apiErr.message as string);
      toast.error(`فشل الطباعة: ${apiErr.message}`);
      // Fallback to browser print
      if (printMethod === "native") {
        try {
          await printThermalReceipt(lastInvoice, settings);
          toast.success("تم فتح نافذة الطباعة كبديل");
        } catch (_fallbackError) {
          toast.error("فشل الطباعة تماماً");
        }
      }
    } finally {
      setPrinting(false);
    }
  };

  const handleNextCustomer = () => {
    setLastInvoice(null);
    resetPOS();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] w-full max-w-md text-center shadow-2xl relative overflow-hidden border border-white/20"
        >
          {/* Decorative background elements */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-success/10 to-transparent" />

          <div className="relative z-10 space-y-6">
            <div className="flex justify-center">
              <div className="h-24 w-24 rounded-[2rem] bg-success flex items-center justify-center text-white shadow-xl shadow-success/30 animate-bounce-slow">
                <CheckCircle2 size={56} strokeWidth={2.5} />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black text-main tracking-tight">
                تم الدفع بنجاح!
              </h2>
              <p className="text-sm font-bold text-muted flex items-center justify-center gap-2 uppercase tracking-widest">
                <ShoppingBag size={14} />
                فاتورة رقم: #{lastInvoice.invoice_no || lastInvoice.id}
              </p>
            </div>

            <div className="p-6 rounded-[2.5rem] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 space-y-4">
              <div className="flex justify-between items-center text-right">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-primary shadow-sm">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase">
                      العميل
                    </p>
                    <p className="text-sm font-black text-main">
                      {completedCustomerName || "عميل مجهول"}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black text-muted uppercase">
                    الخبير
                  </p>
                  <p className="text-sm font-black text-primary">
                    {completedBarberName || "الخبير"}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1">
                  المبلغ المحصل
                </p>
                <p className="text-5xl font-black text-success tabular-nums tracking-tighter">
                  {formatCurrency(lastInvoice.total_amount)}
                </p>
              </div>
            </div>

            {/* Print Method Selector */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 space-y-3">
              <p className="text-[10px] font-black text-muted uppercase tracking-widest text-right">
                طريقة الطباعة
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPrintMethod("browser")}
                  className={`flex-1 h-12 rounded-xl font-black text-sm transition-all border-2 ${
                    printMethod === "browser"
                      ? "bg-primary text-white border-primary shadow-md"
                      : "bg-white dark:bg-white/5 text-muted border-slate-200 dark:border-white/10 hover:border-primary/30"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Printer size={18} />
                    متصفح (افتراضي)
                  </span>
                </button>
                <button
                  onClick={() => setPrintMethod("native")}
                  className={`flex-1 h-12 rounded-xl font-black text-sm transition-all border-2 ${
                    printMethod === "native"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                      : "bg-white dark:bg-white/5 text-muted border-slate-200 dark:border-white/10 hover:border-primary/30"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Zap size={18} fill="currentColor" />
                    أصلية (WebUSB/Electron)
                  </span>
                </button>
              </div>
              {nativePrinterError && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                  <AlertTriangle size={14} />
                  <span>{nativePrinterError}</span>
                </div>
              )}
              <p className="text-[9px] font-bold text-slate-400 text-center">
                {printMethod === "browser"
                  ? "يفتح نافذة طباعة في المتصفح — يعمل على أي جهاز"
                  : "يتطلب توصيل طابعة عبر USB أو تطبيق سطح مكتب (Electron/TAURI)"}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button
                size="lg"
                onClick={handlePrint}
                disabled={printing}
                className="h-16 rounded-[1.75rem] font-black text-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl flex items-center justify-center gap-3 group transition-all disabled:opacity-50"
              >
                {printing ? (
                  <>
                    <Loader2 size={22} className="animate-spin" />
                    جاري الطباعة...
                  </>
                ) : (
                  <>
                    <Printer
                      size={22}
                      className="group-hover:rotate-12 transition-transform"
                    />
                    طباعة الفاتورة الحرارية
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={handleNextCustomer}
                disabled={printing}
                className="h-14 rounded-[1.5rem] font-black text-muted hover:text-main hover:bg-slate-100 group disabled:opacity-50"
              >
                العميل التالي
                <ArrowRight
                  size={18}
                  className="mr-2 group-hover:-translate-x-1 transition-transform rotate-180"
                />
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SuccessOverlay;
