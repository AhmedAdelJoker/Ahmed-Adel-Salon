/** Reassign-barber + cancel-appointment dialogs (moved from ReceptionBoard page). */
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
import { useTranslation } from "react-i18next";

export default function ReceptionActionDialogs({
  assigningAppt,
  setAssigningAppt,
  barbers,
  onReassignBarber,
  cancelAppt,
  setCancelAppt,
  onConfirmCancel,
  t,
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
              {t("dialogs.reassign_title")}
            </DialogTitle>
            <DialogDescription className="text-muted font-bold">
              {t("dialogs.reassign_desc")}
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
                  {b.job_title && (
                    <p className="text-[10px] font-bold text-muted uppercase mt-0.5">
                      {b.job_title}
                    </p>
                  )}
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
              {t("dialogs.cancel_title")}
            </DialogTitle>
            <DialogDescription className="text-muted font-bold">
              {t("dialogs.cancel_desc", { name: cancelAppt?.customer_name || t("card.unknown_customer") })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setCancelAppt(null)}
              className="flex-1 h-12 rounded-xl font-black text-xs"
            >
              {t("dialogs.cancel_back")}
            </Button>
            <Button
              variant="danger"
              onClick={onConfirmCancel}
              className="flex-1 h-12 rounded-xl font-black text-xs"
            >
              <Trash2 size={15} /> {t("dialogs.cancel_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
