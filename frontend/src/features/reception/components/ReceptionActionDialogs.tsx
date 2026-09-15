/** Reassign-barber + cancel-appointment dialogs (moved from ReceptionBoard page, no logic changes). */
import { AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ReceptionActionDialogs({
  assigningAppt,
  setAssigningAppt,
  barbers,
  onReassignBarber,
  cancelAppt,
  setCancelAppt,
  onConfirmCancel,
}: any) {
  return (
    <>
      <Dialog
        open={!!assigningAppt}
        onOpenChange={() => setAssigningAppt(null)}
      >
        <DialogContent className="sm:max-w-[400px] bg-card border-none text-main rounded-[2rem] shadow-premium">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              تغيير الخبير
            </DialogTitle>
            <DialogDescription className="text-muted font-bold">
              اختر خبيراً آخراً لهذا الموعد
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-4 max-h-[300px] overflow-y-auto custom-scrollbar text-right">
            {barbers.map((b) => (
              <Button
                key={b.id}
                variant="outline"
                onClick={() => onReassignBarber(assigningAppt.id, b.id)}
                className="justify-start gap-4 h-16 rounded-2xl border-border/40 hover:bg-soft hover:border-accent/40 transition-all group flex-row-reverse"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-black group-hover:bg-accent group-hover:text-white transition-colors">
                  {b.display_name?.[0]}
                </div>
                <div className="text-right flex-1">
                  <p className="font-black text-sm">{b.display_name}</p>
                  <p className="text-[10px] font-bold text-muted uppercase">
                    {b.job_title || "خبير"}
                  </p>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelAppt} onOpenChange={() => setCancelAppt(null)}>
        <DialogContent className="sm:max-w-[420px] bg-card border-none text-main rounded-[2rem] shadow-premium">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <AlertCircle size={20} className="text-rose-500" />
              تأكيد إلغاء الحجز
            </DialogTitle>
            <DialogDescription className="text-muted font-bold">
              هل أنت متأكد من إلغاء حجز{" "}
              <span className="text-main">
                {cancelAppt?.customer_name || "العميل"}
              </span>
              ؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setCancelAppt(null)}
              className="flex-1 h-12 rounded-xl font-black text-xs"
            >
              تراجع
            </Button>
            <Button
              variant="danger"
              onClick={onConfirmCancel}
              className="flex-1 h-12 rounded-xl font-black text-xs"
            >
              <Trash2 size={15} /> تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
