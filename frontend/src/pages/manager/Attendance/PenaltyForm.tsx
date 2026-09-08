import React, { useState } from "react";
import { AlertCircle, User, ShieldAlert } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { formatCurrency } from "@/lib/core/utils";
import { Input } from "@/components/ui/input";
import { AnimatePresence } from "framer-motion";
import { DollarSign } from "lucide-react";

const PenaltyForm = ({ employees }) => {
  const [penaltyEmployeeId, setPenaltyEmployeeId] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [penaltyReason, setPenaltyReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedEmployee = employees?.find(
    (e) => String(e.id) === String(penaltyEmployeeId),
  );

  const handleSubmitPenalty = () => {
    if (!penaltyEmployeeId || !penaltyAmount || !penaltyReason) return;
    setIsSubmitting(true);
    setTimeout(() => {
      toast.success("تم اعتماد الجزاء المالي");
      setIsSubmitting(false);
      setPenaltyEmployeeId("");
      setPenaltyAmount("");
      setPenaltyReason("");
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-muted">
          الموظف المعني
        </label>
        <Select value={penaltyEmployeeId} onValueChange={setPenaltyEmployeeId}>
          <SelectTrigger className="h-11 w-full rounded-xl font-bold">
            <SelectValue placeholder="اختر الموظف..." />
          </SelectTrigger>
          <SelectContent>
            {employees?.map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted">
            المبلغ
          </label>
          <div className="relative">
            <Input
              type="number"
              value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(e.target.value)}
              placeholder="0.00"
              className="h-11 w-full rounded-xl pl-8 font-bold"
              min="0"
              step="0.01"
            />
            <DollarSign
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted">
            النوع
          </label>
          <Select defaultValue="late">
            <SelectTrigger className="h-11 w-full rounded-xl font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="late">تأخير</SelectItem>
              <SelectItem value="absence">غياب</SelectItem>
              <SelectItem value="other">أخرى</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-muted">
          السبب
        </label>
        <textarea
          value={penaltyReason}
          onChange={(e) => setPenaltyReason(e.target.value)}
          placeholder="اكتب سبب الجزاء..."
          className="h-20 w-full resize-none rounded-xl border border-border bg-card p-3 text-sm font-bold outline-none transition-all placeholder:text-muted/40 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
        />
      </div>

      <AnimatePresence>
        {penaltyEmployeeId && penaltyAmount && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-danger/20 bg-danger-soft p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-danger" />
              <span className="text-[10px] font-black uppercase text-danger">
                معاينة الجزاء
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card">
                <User size={14} className="text-main" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-main">
                  {selectedEmployee?.full_name || "اختر موظف"}
                </p>
                <p className="text-[9px] font-bold text-muted">
                  مبلغ: {formatCurrency(penaltyAmount || 0)}
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-card p-2">
              <p className="text-[8px] font-bold uppercase text-muted">السبب</p>
              <p className="text-[9px] font-bold text-main">
                {penaltyReason || "—"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={handleSubmitPenalty}
        disabled={
          isSubmitting || !penaltyEmployeeId || !penaltyAmount || !penaltyReason
        }
        loading={isSubmitting}
        className="h-11 w-full rounded-xl bg-danger text-white font-black text-xs hover:bg-danger/90"
      >
        <ShieldAlert size={14} className="ml-1.5" /> اعتماد الجزاء
      </Button>
    </div>
  );
};

export default PenaltyForm;
