import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  Clock,
  Phone,
  TrendingUp,
} from "lucide-react";
import api from "@/services/api";
import { formatCurrency, cn } from "@/lib/core/utils";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";

export interface EmployeeQuickViewData {
  full_name?: string;
  profile_image_url?: string;
  job_title?: string;
  status?: string;
  performance?: {
    net_salary?: number;
    [key: string]: unknown;
  };
  phone_primary?: string;
  services?: { id?: string | number; name?: string; name_ar?: string }[];
  [key: string]: unknown;
}

export interface EmployeeQuickViewProps {
  employeeId?: string | number | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const EmployeeQuickView = ({ employeeId, open, onOpenChange }: EmployeeQuickViewProps) => {
  const [data, setData] = useState<EmployeeQuickViewData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && employeeId) {
      fetchData();
    }
  }, [open, employeeId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, perfRes] = await Promise.all([
        api.get(`/employees/${employeeId}`),
        api.get(`/payroll/expected-net?employee_id=${employeeId}`), // Use existing calc endpoint
      ]);
      setData({ ...empRes.data, performance: perfRes.data });
    } catch (error) {
      console.error("Quick view data fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!data && loading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px] rounded-3xl border border-border shadow-2xl overflow-hidden p-0 bg-card dark:bg-slate-900"
        dir="rtl"
      >
        <DialogTitle className="sr-only">
          بيانات الموظف: {data?.full_name}
        </DialogTitle>
        <DialogDescription className="sr-only">
          عرض سريع لأداء وتفاصيل الموظف
        </DialogDescription>

        <div className="bg-accent h-28 relative">
          <div className="absolute -bottom-10 right-6">
            <EmployeeAvatar
              imageUrl={data?.profile_image_url}
              name={data?.full_name}
              size="2xl"
              className="ring-4 ring-card shadow-lg"
            />
          </div>
        </div>

        <div className="pt-14 pb-6 px-6 space-y-5">
          <div>
            <h3 className="text-xl font-black text-main">{data?.full_name}</h3>
            <div className="flex gap-2 mt-1.5">
              <Badge
                variant="outline"
                className="bg-accent/5 text-accent border-accent/20 font-black uppercase text-[9px] tracking-wider"
              >
                {data?.job_title}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "font-black uppercase text-[9px] tracking-wider",
                  data?.status === "active"
                    ? "bg-success/5 text-success border-success/20"
                    : "bg-danger/5 text-danger border-danger/20",
                )}
              >
                {data?.status === "active" ? "نشط" : "غير نشط"}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-soft border border-border/50 space-y-1">
              <div className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={12} className="text-accent" /> عمولات اليوم
              </div>
              <div className="text-lg font-black text-main tabular-nums">
                {formatCurrency(data?.performance?.commission_amount || 0)}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-soft border border-border/50 space-y-1">
              <div className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <Activity size={12} className="text-accent" /> إنتاجية الشهر
              </div>
              <div className="text-lg font-black text-main tabular-nums">
                {Number(data?.performance?.sessions_count ?? 0)} جلسة
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-accent/5 text-accent border border-accent/10">
              <div className="flex items-center gap-3 font-bold text-sm">
                <Phone size={16} /> {data?.phone_primary}
              </div>
              <Badge variant="secondary" className="font-black text-[9px]">
                اتصال
              </Badge>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-soft border border-border/50 text-muted font-bold text-sm">
              <Clock size={16} className="text-accent" />
              <span>آخر ظهور: منذ ساعة</span>
            </div>
          </div>

          {(data?.services?.length ?? 0) > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[9px] font-black text-muted uppercase tracking-widest">
                التخصصات الأساسية
              </span>
              <div className="flex flex-wrap gap-1.5">
                {data?.services?.slice(0, 5).map((s) => (
                  <Badge
                    key={s.id}
                    variant="secondary"
                    className="rounded-lg text-[8px] font-black bg-soft text-muted border border-border/50 px-2 py-0.5"
                  >
                    {s.name_ar || s.name}
                  </Badge>
                ))}
                {(data?.services?.length ?? 0) > 5 && (
                  <Badge
                    variant="secondary"
                    className="rounded-lg text-[8px] font-black bg-soft text-muted border border-border/50"
                  >
                    +{(data?.services?.length ?? 0) - 5}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
