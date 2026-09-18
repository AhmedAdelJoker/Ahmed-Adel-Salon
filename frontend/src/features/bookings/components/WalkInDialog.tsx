import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/core/utils";

export default function WalkInDialog({
  open,
  onOpenChange,
  walkInData,
  setWalkInData,
  walkInCustomer,
  setWalkInCustomer,
  walkInSuggestions,
  setWalkInSuggestions,
  employees,
  services,
  onPhoneSearch,
  onSelectCustomer,
  onSubmit,
  saving,
}: any) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) {
          onOpenChange(false);
          setWalkInData({
            phone: "",
            firstName: "",
            lastName: "",
            employeeId: "",
            serviceIds: [],
            notes: "",
          });
          setWalkInCustomer(null);
          setWalkInSuggestions([]);
        }
      }}
    >
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-black flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <UserPlus size={16} className="text-emerald-600" />
            </div>
            تسجيل عميل مشاة (Walk-in)
          </DialogTitle>
          <DialogDescription className="text-[10px] text-muted">
            سجّل العميل بسرعة وسينتقل تلقائياً للاستقبال
          </DialogDescription>
        </DialogHeader>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Customer Search/Create */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              رقم الهاتف
            </label>
            <div className="relative">
              <Input
                value={walkInData.phone}
                onChange={(e) => onPhoneSearch(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="h-10 rounded-xl bg-soft border-border font-bold"
                dir="ltr"
              />
              {walkInSuggestions.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-32 overflow-y-auto">
                  {walkInSuggestions.map((c: any) => (
                    <button
                      key={c.customer_id || c.id}
                      type="button"
                      onClick={() => onSelectCustomer(c)}
                      className="w-full text-right p-2 hover:bg-soft text-xs font-bold"
                    >
                      {c.first_name || c.name} {c.last_name || ""} - {c.phone}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {walkInCustomer && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2.5">
              <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                ✓ تم العثور على العميل: {walkInCustomer.first_name}{" "}
                {walkInCustomer.last_name || ""}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                الاسم الأول *
              </label>
              <Input
                value={walkInData.firstName}
                onChange={(e) =>
                  setWalkInData({ ...walkInData, firstName: e.target.value })
                }
                placeholder="الاسم"
                className="h-10 rounded-xl bg-soft border-border font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                اسم العائلة
              </label>
              <Input
                value={walkInData.lastName}
                onChange={(e) =>
                  setWalkInData({ ...walkInData, lastName: e.target.value })
                }
                placeholder="العائلة"
                className="h-10 rounded-xl bg-soft border-border font-bold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              الخبير *
            </label>
            <Select
              value={walkInData.employeeId}
              onValueChange={(v: string) =>
                setWalkInData({ ...walkInData, employeeId: v })
              }
            >
              <SelectTrigger className="h-10 rounded-xl bg-soft border-border font-bold">
                <SelectValue placeholder="اختر الخبير..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" className="font-bold text-xs">
                  توزيع تلقائي
                </SelectItem>
                {employees.map((emp: any) => (
                  <SelectItem
                    key={emp.id}
                    value={String(emp.id)}
                    className="font-bold text-xs"
                  >
                    {emp.display_name || emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              الخدمات *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto rounded-lg border border-border bg-soft p-2">
              {services.map((srv: any) => {
                const isSelected = walkInData.serviceIds.includes(srv.id);
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() =>
                      setWalkInData({
                        ...walkInData,
                        serviceIds: isSelected
                          ? walkInData.serviceIds.filter(
                              (id: any) => id !== srv.id,
                            )
                          : [...walkInData.serviceIds, srv.id],
                      })
                    }
                    className={cn(
                      "p-2 rounded-lg border text-right text-[10px] font-bold transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted hover:border-primary/30",
                    )}
                  >
                    <span className="block truncate">{srv.name}</span>
                    <span className="text-[8px] text-muted">
                      {formatCurrency(srv.price || srv.base_price || 0)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              ملاحظات
            </label>
            <input
              value={walkInData.notes}
              onChange={(e) =>
                setWalkInData({ ...walkInData, notes: e.target.value })
              }
              placeholder="أي ملاحظات..."
              className="w-full h-10 rounded-xl border border-border bg-soft px-3 text-xs font-bold focus:border-primary focus:ring-0"
            />
          </div>
        </div>
        <DialogFooter className="p-5 pt-3 border-t border-border/40 gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setWalkInData({
                phone: "",
                firstName: "",
                lastName: "",
                employeeId: "",
                serviceIds: [],
                notes: "",
              });
              setWalkInCustomer(null);
            }}
            className="h-10 flex-1 rounded-xl text-xs"
          >
            إلغاء
          </Button>
          <Button
            onClick={onSubmit}
            loading={saving}
            disabled={
              !walkInData.firstName.trim() ||
              !walkInData.phone.trim() ||
              walkInData.serviceIds.length === 0
            }
            className="h-10 flex-1 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700"
          >
            <UserPlus size={14} className="ml-1.5" /> تسجيل ودخول الاستقبال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
