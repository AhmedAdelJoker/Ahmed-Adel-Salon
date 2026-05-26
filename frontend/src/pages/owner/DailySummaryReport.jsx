import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { 
  Calendar, 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  Clock, 
  DollarSign, 
  FileText, 
  Printer, 
  RefreshCw,
  Zap,
  Activity,
  UserCheck
} from "lucide-react";
import { formatCurrency, cn } from "../../lib/utils";
import { toast } from "react-hot-toast";

const DailySummaryReport = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/pos-shifts/daily-summary?date_str=${date}`);
      setData(response.data);
    } catch (error) {
      toast.error("فشل تحميل ملخص اليوم");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [date]);

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

  const { summary, shifts, expenses } = data || {};

  return (
    <div className="space-y-8 animate-in fade-in duration-700" dir="rtl">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/50 dark:bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/20 backdrop-blur-md sticky top-0 z-10 shadow-xl shadow-slate-200/20 dark:shadow-none print:hidden">
        <div>
          <h2 className="text-2xl font-black text-main flex items-center gap-3">
            <Activity className="text-primary" size={28} />
            الملخص التشغيلي لليوم
          </h2>
          <p className="text-sm font-bold text-muted mt-1">مراجعة شاملة لكافة الورديات والمصروفات والمبيعات.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-12 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-sm outline-none focus:ring-2 ring-primary/20 transition-all"
          />
          <Button onClick={handlePrint} variant="outline" className="h-12 px-6 rounded-2xl font-black gap-2 border-slate-200">
            <Printer size={18} />
            طباعة
          </Button>
          <Button onClick={fetchData} className="h-12 w-12 rounded-2xl p-0">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "إجمالي الإيرادات", value: formatCurrency(summary.total_sales), icon: TrendingUp, color: "primary", trend: "+12%" },
          { label: "عدد الفواتير", value: summary.invoice_count, icon: FileText, color: "blue", trend: "اليوم" },
          { label: "إجمالي المصروفات", value: formatCurrency(summary.total_expenses), icon: ShoppingBag, color: "rose", trend: "-5%" },
          { label: "الورديات المنفذة", value: summary.shift_count, icon: Clock, color: "amber", trend: "مكتملة" },
        ].map((stat, i) => (
          <Card key={i} className="p-6 border-none bg-white dark:bg-white/5 shadow-soft hover:shadow-2xl transition-all group overflow-hidden relative">
            <div className={`absolute top-0 right-0 w-2 h-full bg-${stat.color}-500 opacity-20 group-hover:opacity-100 transition-opacity`} />
            <div className="flex justify-between items-start mb-4">
              <div className={`h-12 w-12 rounded-2xl bg-${stat.color}-500/10 flex items-center justify-center text-${stat.color}-500`}>
                <stat.icon size={24} />
              </div>
              <Badge className={`bg-${stat.color}-500/10 text-${stat.color}-500 border-none text-[10px] font-black`}>
                {stat.trend}
              </Badge>
            </div>
            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1">{stat.label}</p>
            <p className="text-3xl font-black text-main tabular-nums tracking-tighter">{stat.value}</p>
          </Card>
        ))}
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
                <div key={i} className="group relative pr-8 pb-8 border-r-2 border-slate-100 dark:border-white/5 last:pb-0 last:border-0">
                  <div className="absolute top-0 -right-2 w-4 h-4 rounded-full bg-primary border-4 border-white dark:border-slate-900 shadow-lg group-hover:scale-125 transition-transform" />
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-white/5 p-6 rounded-[2rem] border border-slate-100 dark:border-white/10 hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-primary font-black text-xl">
                        {shift.user?.full_name?.[0] || shift.user?.username?.[0] || "U"}
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-main leading-tight">{shift.user?.full_name || shift.user?.username}</h4>
                        <div className="flex items-center gap-3 mt-1 text-xs font-bold text-muted">
                          <span className="flex items-center gap-1"><Clock size={12}/> {new Date(shift.opened_at).toLocaleTimeString('ar-EG')}</span>
                          {shift.closed_at && <span className="flex items-center gap-1 text-emerald-500"><UserCheck size={12}/> {new Date(shift.closed_at).toLocaleTimeString('ar-EG')}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 w-full md:w-auto">
                      <div className="px-5 py-3 rounded-2xl bg-white dark:bg-white/5 shadow-sm border border-slate-50 dark:border-white/5">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">المبيعات</p>
                        <p className="text-lg font-black text-emerald-600">{formatCurrency(shift.total_sales)}</p>
                      </div>
                      <div className="px-5 py-3 rounded-2xl bg-white dark:bg-white/5 shadow-sm border border-slate-50 dark:border-white/5">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">الفواتير</p>
                        <p className="text-lg font-black text-main">{shift.invoice_count}</p>
                      </div>
                      <Badge variant={shift.status === 'open' ? 'success' : 'outline'} className="h-fit py-2 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest">
                        {shift.status === 'open' ? 'نشط الآن' : 'مكتمل'}
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
                <div key={i} className="p-4 rounded-2xl bg-rose-50/30 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/10 flex justify-between items-center group hover:bg-rose-50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-rose-500">
                      <DollarSign size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-main leading-tight">{exp.description}</p>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-0.5">{exp.category}</p>
                    </div>
                  </div>
                  <p className="text-base font-black text-rose-600">{formatCurrency(exp.amount)}</p>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/10">
            <div className="flex justify-between items-center px-4 py-5 rounded-[1.5rem] bg-slate-900 text-white shadow-xl shadow-slate-900/20">
              <span className="text-xs font-black uppercase tracking-[0.2em] opacity-60">إجمالي الصرف</span>
              <span className="text-2xl font-black tabular-nums tracking-tighter">{formatCurrency(summary.total_expenses)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Footer Branding for Print */}
      <div className="hidden print:block text-center pt-20 border-t border-dashed mt-20 opacity-50">
        <p className="text-sm font-black">تقرير الملخص اليومي آلياً - صالون برو</p>
        <p className="text-[10px] font-bold mt-2 tracking-widest">تاريخ الاستخراج: {new Date().toLocaleString('ar-EG')}</p>
      </div>
    </div>
  );
};

export default DailySummaryReport;
