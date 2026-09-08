import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePOS } from "@/pages/cashier/POS/POSContext";
import { Lock, ShieldAlert } from "lucide-react";
import { toast } from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { RefreshCw, Send, X } from "lucide-react";

const ManagerApprovalModal = () => {
  const {
    showApprovalModal,
    setShowApprovalModal,
    activeInvoiceId,
    requestInvoiceAdjustment,
    editInvoice,
    lastInvoice,
    setLastInvoice,
    setActiveInvoiceId,
    isInvoiceEditable,
  } = usePOS();

  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("pin"); // "pin" or "request"

  const invoiceId = activeInvoiceId || lastInvoice?.id;

  const handleApprove = async () => {
    if (!pin) return toast.error("يرجى إدخال كود المدير");

    // Check time limit
    if (lastInvoice && !isInvoiceEditable(lastInvoice)) {
      toast.error(
        "عفواً، انتهت الفترة المسموح بها لتعديل الفاتورة (ساعة واحدة)",
      );
      return;
    }

    try {
      setLoading(true);
      const res = (await requestInvoiceAdjustment(invoiceId, pin)) as {
         
        status?: string; invoice?: any;
      };

      if (res.status === "approved") {
        const invoiceToEdit = lastInvoice || (res as { invoice?: unknown }).invoice;
        if (!isInvoiceEditable(invoiceToEdit as Parameters<typeof isInvoiceEditable>[0])) {
          toast.error("انتهت صلاحية تعديل هذه الفاتورة");
          return;
        }

        toast.success("تم الاعتماد بنجاح، يمكنك الآن تعديل الفاتورة");
        editInvoice(invoiceToEdit as Parameters<typeof editInvoice>[0]);
        if (lastInvoice) setLastInvoice(null);
        setActiveInvoiceId(invoiceId);
        setShowApprovalModal(false);
        setPin("");
      }
    } catch (err) {
       
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr.response?.data?.detail as string) || "كود الاعتماد غير صحيح");
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async () => {
    if (!reason) return toast.error("يرجى كتابة سبب التعديل");

    if (lastInvoice && !isInvoiceEditable(lastInvoice)) {
      toast.error(
        "عفواً، انتهت الفترة المسموح بها لتعديل الفاتورة (ساعة واحدة)",
      );
      return;
    }

    try {
      setLoading(true);
      await requestInvoiceAdjustment(invoiceId, null, reason);
      toast.success("تم إرسال طلب التعديل للمدير");
      setShowApprovalModal(false);
      setReason("");
    } catch (_err) {
      toast.error("فشل إرسال الطلب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
      <DialogContent
        className="max-w-md rounded-[2.5rem] border-none p-0 overflow-hidden bg-white dark:bg-slate-900 shadow-3xl"
        dir="rtl"
      >
        <div className="bg-slate-950 text-white p-8 relative">
          <div className="absolute top-0 left-0 w-full h-full bg-primary/10 blur-3xl opacity-50" />
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                <ShieldAlert size={20} />
              </div>
              <DialogTitle className="text-xl font-black">
                اعتماد تعديل الفاتورة
              </DialogTitle>
            </div>
            <button
              onClick={() => setShowApprovalModal(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-100 dark:border-white/10">
            <button
              onClick={() => setMode("pin")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${mode === "pin" ? "bg-white dark:bg-slate-800 shadow-sm text-primary" : "text-slate-400"}`}
            >
              كود المدير (سريع)
            </button>
            <button
              onClick={() => setMode("request")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${mode === "request" ? "bg-white dark:bg-slate-800 shadow-sm text-primary" : "text-slate-400"}`}
            >
              إرسال طلب للمدير
            </button>
          </div>

          {mode === "pin" ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">
                  كود الاعتماد الخاص بالمدير
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    placeholder="••••"
                    className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/5 px-6 font-black text-center text-2xl tracking-[0.5em] focus:border-primary/40 transition-all"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    maxLength={4}
                  />
                  <Lock
                    size={18}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300"
                  />
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-400 text-center px-4">
                استخدم كود المدير الخاص بك لتجاوز الحماية وتعديل الفاتورة فوراً.
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">
                  سبب طلب التعديل
                </label>
                <textarea
                  placeholder="اشرح لماذا تريد تعديل هذه الفاتورة..."
                  className="w-full h-32 rounded-2xl bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/5 p-5 font-bold text-sm focus:border-primary/30 transition-all resize-none shadow-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <p className="text-[10px] font-bold text-slate-400 text-center px-4">
                سيصل إشعار للمدير للمراجعة والاعتماد. ستتمكن من التعديل فور
                الموافقة.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-950/50 flex items-center gap-3 border-t border-slate-100 dark:border-white/5">
          <Button
            variant="ghost"
            onClick={() => setShowApprovalModal(false)}
            className="flex-1 h-14 rounded-2xl font-black text-slate-500"
          >
            إلغاء
          </Button>
          {mode === "pin" ? (
            <Button
              onClick={handleApprove}
              loading={loading}
              className="flex-[2] h-14 rounded-2xl bg-primary text-white font-black shadow-xl shadow-primary/20 flex gap-2"
            >
              اعتماد وتعديل{" "}
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </Button>
          ) : (
            <Button
              onClick={handleRequest}
              loading={loading}
              className="flex-[2] h-14 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-600/20 flex gap-2"
            >
              إرسال الطلب الآن <Send size={18} />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerApprovalModal;
