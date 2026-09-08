import { useState, useEffect, useCallback } from "react";
import api from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  DollarSign,
  FileText,
  Printer,
  RefreshCw,
  Activity,
  UserCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/core/utils";
import {
  StatCard as StatCardDisplay,
  CurrencyStatCard,
} from "@/components/shared/DisplayComponents";
import { toast } from "react-hot-toast";

const DailySummaryReport = () => {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/pos-shifts/daily-summary?date_str=${date}`,
      );
      setData(response.data);
    } catch (_error) {
      toast.error("فشل تحميل ملخص اليوم");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePrint = () => {
    window.print();
  };

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const {
    summary = {},
    shifts = [],
    expenses = [],
  } = (data || {}) as {
    summary?: Record<string, number | string>;
    shifts?: Array<Record<string, any>>;
    expenses?: Array<Record<string, any>>;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700" dir="rtl">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/50 dark:bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/20 backdrop-blur-md sticky top-0 z-10 shadow-xl shadow-slate-200/20 dark:shadow-none print:hidden">
        <div>
          <h2 className="text-2xl font-black text-main flex items-center gap-3">
            <Activity className="text-primary" size={28} />
            الملخص التشغيلي لليوم
          </h2>
          <p className="text-sm font-bold text-muted mt-1">
            مراجعة شاملة لكافة الورديات والمصروفات والمبيعات.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-12 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-sm outline-none focus:ring-2 ring-primary/20 transition-all"
          />
          <Button
            onClick={handlePrint}
            variant="outline"
            className="h-12 px-6 rounded-2xl font-black gap-2 border-slate-200"
          >
            <Printer size={18} />
            طباعة
          </Button>
          <Button onClick={fetchData} className="h-12 w-12 rounded-2xl p-0">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Main Stats Grid - no overlap, fixed height */}
      <div data-stats-grid="true">
        <CurrencyStatCard
          label="إجمالي الإيرادات"
          value={summary.total_sales}
          icon={TrendingUp}
          trend="positive"
          trendValue={12}
          variant="success"
          hint={undefined}
          className={undefined}
        />
        <StatCardDisplay
          label="عدد الفواتير"
          value={summary.invoice_count ?? 0}
          icon={FileText}
          variant="info"
          hint="اليوم"
          trend={undefined}
          trendValue={undefined}
          className={undefined}
        />
        <CurrencyStatCard
          label="إجمالي المصروفات"
          value={summary.total_expenses}
          icon={ShoppingBag}
          trend="negative"
          trendValue={5}
          variant="danger"
          hint={undefined}
          className={undefined}
        />
        <StatCardDisplay
          label="الورديات المنفذة"
          value={summary.shift_count ?? 0}
          icon={Clock}
          variant="warning"
          hint="مكتملة"
          trend={undefined}
          trendValue={undefined}
          className={undefined}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Shifts Timeline */}
        <Card className="xl:col-span-2 p-8 border-none bg-white dark:bg-white/5 shadow-soft rounded-[2.5rem]">
          <h3 className="text-xl font-black mb-8 flex items-center gap-3">
            <UserCheck className="text-primary" size={24} />
            سجل ورديات الموظفين
          </h3>

          <div className="space-y-6">
            {shifts.length === 0 ? (
              <div className="py-20 text-center opacity-30">
                <Clock size={48} className="mx-auto mb-4" />
                <p className="font-black">لا توجد ورديات مسجلة لهذا اليوم</p>
              </div>
            ) : (
              shifts.map((shift, i) => (
                <div
                  key={i}
                  className="group relative pr-8 pb-8 border-r-2 border-slate-100 dark:border-white/5 last:pb-0 last:border-0"
                >
                  <div className="absolute top-0 -right-2 w-4 h-4 rounded-full bg-primary border-4 border-white dark:border-slate-900 shadow-lg group-hover:scale-125 transition-transform" />

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-white/5 p-6 rounded-[2rem] border border-slate-100 dark:border-white/10 hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-primary font-black text-xl">
                        {shift.user?.full_name?.[0] ||
                          shift.user?.username?.[0] ||
                          "U"}
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-main leading-tight">
                          {shift.user?.full_name || shift.user?.username}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-xs font-bold text-muted">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />{" "}
                            {new Date(shift.opened_at).toLocaleTimeString(
                              "ar-EG",
                            )}
                          </span>
                          {shift.closed_at && (
                            <span className="flex items-center gap-1 text-emerald-500">
                              <UserCheck size={12} />{" "}
                              {new Date(shift.closed_at).toLocaleTimeString(
                                "ar-EG",
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 w-full md:w-auto">
                      <div className="px-5 py-3 rounded-2xl bg-white dark:bg-white/5 shadow-sm border border-slate-50 dark:border-white/5">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">
                          المبيعات
                        </p>
                        <p className="text-lg font-black text-emerald-600">
                          {formatCurrency(shift.total_sales)}
                        </p>
                      </div>
                      <div className="px-5 py-3 rounded-2xl bg-white dark:bg-white/5 shadow-sm border border-slate-50 dark:border-white/5">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">
                          الفواتير
                        </p>
                        <p className="text-lg font-black text-main">
                          {shift.invoice_count}
                        </p>
                      </div>
                      <Badge
                        variant={
                          shift.status === "open" ? "success" : "outline"
                        }
                        className="h-fit py-2 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest"
                      >
                        {shift.status === "open" ? "نشط الآن" : "مكتمل"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Expenses Summary */}
        <Card className="p-8 border-none bg-white dark:bg-white/5 shadow-soft rounded-[2.5rem]">
          <h3 className="text-xl font-black mb-8 flex items-center gap-3">
            <ShoppingBag className="text-rose-500" size={24} />
            المصروفات النثرية
          </h3>

          <div className="space-y-4">
            {expenses.length === 0 ? (
              <div className="py-20 text-center opacity-30">
                <ShoppingBag size={40} className="mx-auto mb-4" />
                <p className="font-black text-xs">لا توجد مصروفات مسجلة</p>
              </div>
            ) : (
              expenses.map((exp, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-rose-50/30 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/10 flex justify-between items-center group hover:bg-rose-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-rose-500">
                      <DollarSign size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-main leading-tight">
                        {exp.description}
                      </p>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-0.5">
                        {exp.category}
                      </p>
                    </div>
                  </div>
                  <p className="text-base font-black text-rose-600">
                    {formatCurrency(exp.amount)}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/10">
            <div className="flex justify-between items-center px-4 py-5 rounded-[1.5rem] bg-slate-900 text-white shadow-xl shadow-slate-900/20">
              <span className="text-xs font-black uppercase tracking-[0.2em] opacity-60">
                إجمالي الصرف
              </span>
              <span className="text-2xl font-black tabular-nums tracking-tighter">
                {formatCurrency(summary.total_expenses)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Footer Branding for Print */}
      <div className="hidden print:block text-center pt-20 border-t border-dashed mt-20 opacity-50">
        <p className="text-sm font-black">
          تقرير الملخص اليومي آلياً - صالون برو
        </p>
        <p className="text-[10px] font-bold mt-2 tracking-widest">
          تاريخ الاستخراج: {new Date().toLocaleString("ar-EG")}
        </p>
      </div>
    </div>
  );
};

export default DailySummaryReport;
