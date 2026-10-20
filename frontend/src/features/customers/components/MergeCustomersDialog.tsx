/**
 * Merge duplicated customers (same phone) into one surviving record.
 *
 * Backend: GET /customers/duplicates groups customers by phone and
 * POST /customers/{source}/merge archives the source and repoints every
 * related row to the target.
 */
import { useCallback, useEffect, useState } from "react";
import { GitMerge, Loader2, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/core/utils";
import { getInitials, getTierInfo } from "@/features/customers/utils/customer";

type GroupCustomer = {
  customer_id: number;
  first_name: string;
  last_name: string;
  phone: string;
  second_phone?: string | null;
  visits_count: number;
  lifetime_spend: number;
  current_tier: string;
  created_at: string;
};

type DuplicateGroup = {
  phone: string;
  customers: GroupCustomer[];
};

export default function MergeCustomersDialog({
  open,
  onOpenChange,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/customers/duplicates");
      const nextGroups: DuplicateGroup[] = res.data?.groups || [];
      setGroups(nextGroups);
      const defaults: Record<string, number> = {};
      for (const group of nextGroups) {
        // Keep the customer with the longest history by default.
        const target = [...group.customers].sort(
          (a, b) => b.visits_count - a.visits_count || a.customer_id - b.customer_id,
        )[0];
        defaults[group.phone] = target.customer_id;
      }
      setSelected(defaults);
    } catch (error) {
      console.error("Duplicate groups load failed:", error);
      toast.error("فشل تحميل مجموعات التكرار");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadGroups();
    }
  }, [open, loadGroups]);

  const handleMergeGroup = async (group: DuplicateGroup) => {
    const targetId = selected[group.phone];
    const target = group.customers.find((c) => c.customer_id === targetId);
    if (!target) return;

    const duplicates = group.customers.filter((c) => c.customer_id !== targetId);
    const confirmed = window.confirm(
      `سيتم دمج ${duplicates.length} عميل داخل «${target.first_name} ${target.last_name}».\n` +
        "ستُنقل كل المواعيد والفواتير والجلسات للعميل المُحتفظ به، وسيُؤرشف الباقون مع تسجيل سبب الدمج.\n" +
        "هل تريد المتابعة؟",
    );
    if (!confirmed) return;

    try {
      setMerging(true);
      for (const source of duplicates) {
        await api.post(`/customers/${source.customer_id}/merge`, {
          target_customer_id: targetId,
        });
      }
      toast.success("تم دمج المجموعة بنجاح");
      await loadGroups();
      onMerged();
    } catch (error: any) {
      console.error("Customer merge failed:", error);
      toast.error(
        error?.response?.data?.detail || "فشل دمج المجموعة",
        { duration: 6000 },
      );
      await loadGroups();
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="p-5 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-black flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <GitMerge size={14} className="text-primary" />
            </div>
            دمج العملاء المكررين
          </DialogTitle>
          <DialogDescription className="text-[10px] text-muted">
            مجموعات العملاء الذين يتشاركون نفس رقم الهاتف — اختر من كل مجموعة الصف الذي يبقى
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs font-bold">جاري التحميل…</span>
            </div>
          ) : groups.length === 0 ? (
            <p className="text-xs font-bold text-muted text-center py-10">
              لا توجد مجموعات مكررة حالياً
            </p>
          ) : (
            groups.map((group) => (
              <div
                key={group.phone}
                className="rounded-xl border border-border bg-soft/40 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[10px] font-black text-muted"
                    dir="ltr"
                  >
                    {group.phone}
                  </span>
                  <Button
                    variant="primary"
                    className="h-8 rounded-lg px-3 text-[10px]"
                    disabled={merging}
                    onClick={() => handleMergeGroup(group)}
                  >
                    {merging ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <GitMerge size={12} />
                    )}
                    <span className="ms-1.5">دمج الباقي مع المحدد</span>
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {group.customers.map((customer) => {
                    const tier = getTierInfo(customer.current_tier);
                    const isTarget =
                      selected[group.phone] === customer.customer_id;
                    return (
                      <label
                        key={customer.customer_id}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border bg-card p-2.5 cursor-pointer transition-colors",
                          isTarget
                            ? "border-primary/50"
                            : "border-border/60 hover:border-primary/30",
                        )}
                      >
                        <input
                          type="radio"
                          name={`merge-target-${group.phone}`}
                          checked={isTarget}
                          onChange={() =>
                            setSelected((prev) => ({
                              ...prev,
                              [group.phone]: customer.customer_id,
                            }))
                          }
                          className="accent-primary"
                        />
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-black text-primary shrink-0">
                          {getInitials(
                            `${customer.first_name} ${customer.last_name}`,
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-main truncate">
                              {customer.first_name} {customer.last_name}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[8px] font-black",
                                tier.bg,
                                tier.color,
                              )}
                            >
                              <tier.icon size={9} /> {tier.label}
                            </span>
                          </div>
                          <p className="text-[9px] font-bold text-muted">
                            #{customer.customer_id} • {customer.visits_count}{" "}
                            زيارة •{" "}
                            {formatCurrency(customer.lifetime_spend)}
                          </p>
                        </div>
                        {isTarget && (
                          <span className="text-[8px] font-black text-primary shrink-0">
                            يبقى
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="p-5 pt-3 border-t border-border/40">
          <Button
            variant="outline"
            onClick={() => loadGroups()}
            disabled={loading}
            className="h-9 rounded-xl text-xs"
          >
            <RefreshCw size={13} className="ms-1.5" /> تحديث
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-xl text-xs"
          >
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
