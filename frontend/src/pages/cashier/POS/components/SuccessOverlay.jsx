import React, { useEffect } from "react";
import { usePOS } from "../POSContext";
import { useSalon } from "@/context/SalonContext";
import { Button } from "../../../../components/ui/button";
import { formatCurrency } from "../../../../lib/utils";
import { printThermalReceipt } from "@/utils/receiptPrinter";
import { Printer, CheckCircle2, User, Zap, ArrowRight, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from 'canvas-confetti';

const SuccessOverlay = () => {
  const { 
    lastInvoice, 
    setLastInvoice, 
    completedCustomerName, 
    completedBarberName,
    resetPOS 
  } = usePOS();
  const { settings } = useSalon();

  useEffect(() => {
    if (lastInvoice) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#38bdf8', '#10b981']
      });
    }
  }, [lastInvoice]);

  if (!lastInvoice) return null;

  const handlePrint = () => {
    printThermalReceipt(lastInvoice, settings);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4"
        dir="rtl"
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
              <h2 className="text-3xl font-black text-main tracking-tight">تم الدفع بنجاح!</h2>
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
                    <p className="text-[10px] font-black text-muted uppercase">العميل</p>
                    <p className="text-sm font-black text-main">{completedCustomerName || "عميل مجهول"}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black text-muted uppercase">الخبير</p>
                  <p className="text-sm font-black text-primary">{completedBarberName || "الخبير"}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1">المبلغ المحصل</p>
                <p className="text-5xl font-black text-success tabular-nums tracking-tighter">
                  {formatCurrency(lastInvoice.total_amount)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button
                size="lg"
                onClick={handlePrint}
                className="h-16 rounded-[1.75rem] font-black text-lg bg-slate-900 text-white hover:bg-slate-800 shadow-xl flex items-center justify-center gap-3 group transition-all"
              >
                <Printer size={22} className="group-hover:rotate-12 transition-transform" />
                طباعة الفاتورة الحرارية
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => {
                  setLastInvoice(null);
                  resetPOS();
                }}
                className="h-14 rounded-[1.5rem] font-black text-muted hover:text-main hover:bg-slate-100 group"
              >
                تحصيل العميل التالي
                <ArrowRight size={18} className="mr-2 group-hover:-translate-x-1 transition-transform rotate-180" />
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SuccessOverlay;
