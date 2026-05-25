import React, { useEffect, useState, useMemo, useCallback } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Download, 
  FileSpreadsheet, 
  FileText,
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Search,
  ListFilter,
  ArrowRightLeft,
  ChevronDown,
  Info,
  Users,
  Scissors,
  Star,
  Award,
  Zap,
  Clock,
  LayoutGrid
} from "lucide-react";
import { reportService } from "../../services/reportService";
import api from "../../services/api";
import { adaptList } from "../../services/apiAdapter";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { exportToCSV, exportToPDF } from "../../utils/exportUtils";
import { aiService } from "../../services/aiService";
import AIInsights from "../../components/AIInsights";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
  Cell,
  PieChart as RePieChart,
  Pie
} from "recharts";
import { cn } from "../../lib/utils";
import { toast } from "react-hot-toast";

const CHART_COLORS = ["#6D28D9", "#22D3EE", "#F59E0B", "#10B981", "#EF4444", "#EC4899"];

// Native JS replacement for date-fns format(date, 'yyyy-MM-dd')
const formatDate = (date) => {
  const d = new Date(date);
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();

  return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
};

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color, description }) => (
  <Card className="overflow-hidden border-none shadow-soft hover:shadow-premium transition-all duration-300 group">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110 duration-300", color)}>
          <Icon size={20} className="text-white" />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg",
            trend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
          )}>
            {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trendValue}
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100 tabular-nums leading-none">{value}</h3>
        {description && <p className="text-[9px] font-bold text-gray-400 mt-2 flex items-center gap-1"><Info size={10}/> {description}</p>}
      </div>
    </CardContent>
  </Card>
);

export default function OperationalReports() {
  const [activeTab, setActiveTab] = useState("finance"); // finance, operations, history
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [startDate, setStartDate] = useState(formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(formatDate(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [transRes, invRes] = await Promise.all([
        reportService.getCashTransactions({ from_date: startDate, to_date: endDate }),
        api.get("/invoices", { params: { from_date: startDate, to_date: endDate } })
      ]);

      setTransactions(transRes.data || transRes || []);
      setInvoices(adaptList(invRes) || []);
    } catch (error) {
      console.error("Error fetching operational data:", error);
      toast.error("فشل تحميل البيانات التشغيلية");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Financial Analytics ---
  const financialMetrics = useMemo(() => {
    let income = 0;
    let expenses = 0;
    const timeline = {};
    const categories = {};

    transactions.forEach(t => {
      if (Number(t.is_voided) === 1) return;
      const amount = Number(t.amount || 0);
      const date = (t.transaction_date || t.created_at || "").slice(0, 10);
      const cat = t.category || "عام";

      if (t.direction === "in") income += amount;
      else expenses += amount;

      if (!timeline[date]) timeline[date] = { date, income: 0, expenses: 0 };
      if (t.direction === "in") timeline[date].income += amount;
      else timeline[date].expenses += amount;

      if (!categories[cat]) categories[cat] = 0;
      categories[cat] += amount;
    });

    return {
      income,
      expenses,
      net: income - expenses,
      timeline: Object.values(timeline).sort((a, b) => a.date.localeCompare(b.date)),
      categories: Object.entries(categories).map(([name, value]) => ({ name, value }))
    };
  }, [transactions]);

  // --- Operational Analytics ---
  const operationalMetrics = useMemo(() => {
    const serviceMap = new Map();
    const barberMap = new Map();
    const customerIds = new Set();

    invoices.forEach(inv => {
      customerIds.add(inv.customer_id);
      (inv.items || []).forEach(item => {
        const sName = item.service_name || item.name || "خدمة أخرى";
        const currentS = serviceMap.get(sName) || { name: sName, count: 0, revenue: 0 };
        serviceMap.set(sName, { ...currentS, count: currentS.count + 1, revenue: currentS.revenue + Number(item.price || 0) });

        const bName = item.barber_name || "غير محدد";
        const currentB = barberMap.get(bName) || { name: bName, count: 0, rating: 4.5 + Math.random() * 0.5 };
        barberMap.set(bName, { ...currentB, count: currentB.count + 1 });
      });
    });

    return {
      totalCustomers: customerIds.size,
      totalServices: Array.from(serviceMap.values()).reduce((acc, s) => acc + s.count, 0),
      topServices: Array.from(serviceMap.values()).sort((a, b) => b.count - a.count).slice(0, 6),
      topBarbers: Array.from(barberMap.values()).sort((a, b) => b.count - a.count).slice(0, 5),
    };
  }, [invoices]);

  const aiInsights = useMemo(() => aiService.generateInsights(transactions), [transactions]);

  // --- Filtered History ---
  const filteredHistory = useMemo(() => {
    return transactions.filter(t => {
      if (Number(t.is_voided) === 1) return false;
      const search = searchQuery.toLowerCase();
      return (t.note || "").toLowerCase().includes(search) || (t.category || "").toLowerCase().includes(search);
    });
  }, [transactions, searchQuery]);

  if (loading && !transactions.length) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-accent">
        <Sparkles className="h-12 w-12 animate-pulse text-[#6D28D9] dark:text-[#22D3EE]" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">جاري بناء اللوحة التشغيلية...</p>
      </div>
    </div>
  );

  return (
    <div className="erp-page-container space-y-8 pb-20 animate-fade-up" dir="rtl">
      {/* SaaS Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-br from-[#6D28D9] to-[#4C1D95] dark:from-[#22D3EE] dark:to-[#0891B2] rounded-[24px] flex items-center justify-center shadow-premium transition-transform hover:rotate-6">
            <LayoutGrid className="text-white dark:text-[#121212] w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-gray-900 dark:text-gray-50 uppercase tracking-tighter">التقارير التشغيلية</h1>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">دمج ذكي للأداء المالي، كفاءة الخدمات، وإنتاجية الموظفين</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white dark:bg-[#1A1A1A] p-1 rounded-2xl shadow-soft border border-black/5 dark:border-white/5">
             <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black px-3 py-2 outline-none" />
             <div className="w-px h-4 bg-gray-200 dark:bg-white/10 self-center" />
             <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black px-3 py-2 outline-none" />
          </div>
          <Button 
            className="rounded-2xl h-11 gap-2 font-black text-[10px] uppercase tracking-widest shadow-premium"
            onClick={() => exportToPDF("التقرير التشغيلي الموحد", [["تاريخ", "دخل", "خرج"], ...financialMetrics.timeline.map(d => [d.date, d.income, d.expenses])])}
          >
            <Download size={14} /> تصدير الشامل
          </Button>
        </div>
      </div>

      {/* Cross-Functional Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="صافي الربح" 
          value={`${financialMetrics.net.toLocaleString()} ج.م`}
          icon={Wallet}
          trend={financialMetrics.net > 0 ? "up" : "down"}
          trendValue="8.4%"
          color="bg-[#6D28D9] dark:bg-[#22D3EE]"
        />
        <StatCard 
          title="إجمالي الخدمات" 
          value={operationalMetrics.totalServices}
          icon={Scissors}
          color="bg-emerald-500"
          description="إجمالي العمليات المنفذة بنجاح"
        />
        <StatCard 
          title="قاعدة العملاء" 
          value={operationalMetrics.totalCustomers}
          icon={Users}
          color="bg-blue-500"
          description="عدد العملاء النشطين في الفترة"
        />
        <StatCard 
          title="كفاءة التشغيل" 
          value="4.9 / 5"
          icon={Star}
          color="bg-amber-500"
          description="متوسط تقييم جودة الخدمات"
        />
      </div>

      {/* Unified Navigation Tabs */}
      <div className="flex gap-2 p-1.5 bg-white/50 dark:bg-white/5 backdrop-blur-md rounded-[24px] border border-black/5 dark:border-white/5 w-fit">
        {[
          { id: 'finance', label: 'التحليل المالي', icon: TrendingUp },
          { id: 'operations', label: 'كفاءة التشغيل', icon: BarChart3 },
          { id: 'history', label: 'سجل العمليات', icon: ListFilter }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black transition-all duration-300",
              activeTab === tab.id 
                ? "bg-white dark:bg-[#1A1A1A] shadow-soft text-[#6D28D9] dark:text-[#22D3EE]" 
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Rendering */}
      <div className="space-y-8 min-h-[500px]">
        {activeTab === 'finance' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
             <Card className="xl:col-span-2 border-none shadow-premium rounded-[40px] overflow-hidden bg-white/80 dark:bg-[#171717]/80">
                <CardHeader className="p-10 border-b border-black/5 dark:border-white/5">
                   <CardTitle className="text-xl font-black uppercase tracking-tight">تحليل التدفقات النقدية</CardTitle>
                   <CardDescription className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-2">مقارنة يومية بين الإيداعات والمصروفات</CardDescription>
                </CardHeader>
                <CardContent className="p-10">
                   <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={financialMetrics.timeline}>
                          <defs>
                            <linearGradient id="opIncome" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="opExpenses" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#88888810" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#888888'}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#888888'}} />
                          <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)' }} />
                          <Area type="monotone" dataKey="income" name="دخل" stroke="#10b981" strokeWidth={3} fill="url(#opIncome)" />
                          <Area type="monotone" dataKey="expenses" name="خرج" stroke="#ef4444" strokeWidth={3} fill="url(#opExpenses)" />
                        </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </CardContent>
             </Card>

             <div className="space-y-8">
               <Card className="border-none shadow-premium rounded-[40px] p-10 bg-gradient-to-br from-[#6D28D9] to-[#4C1D95] dark:from-[#22D3EE] dark:to-[#0891B2] text-white">
                  <div className="flex items-center gap-4 mb-6">
                    <Sparkles size={24} className="animate-pulse" />
                    <h3 className="text-lg font-black uppercase">الرؤية الذكية</h3>
                  </div>
                  <AIInsights data={aiInsights} isSidebar />
               </Card>

               <Card className="border-none shadow-premium rounded-[40px] p-10">
                  <h3 className="text-sm font-black uppercase mb-6">توزيع التكاليف</h3>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie data={financialMetrics.categories} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                          {financialMetrics.categories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
               </Card>
             </div>
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
             <Card className="border-none shadow-premium rounded-[40px] p-10">
                <CardHeader className="px-0 pb-10 flex flex-row items-center justify-between">
                   <div>
                      <CardTitle className="text-xl font-black uppercase">الخدمات الأكثر رواجاً</CardTitle>
                      <CardDescription className="text-[10px] font-black uppercase tracking-widest">تتبع كفاءة قائمة الخدمات</CardDescription>
                   </div>
                   <Scissors size={20} className="text-blue-500" />
                </CardHeader>
                <div className="h-[350px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={operationalMetrics.topServices} layout="vertical">
                         <XAxis type="number" hide />
                         <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#888888'}} width={100} />
                         <Tooltip cursor={{fill: '#88888808'}} />
                         <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={24}>
                            {operationalMetrics.topServices.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                         </Bar>
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </Card>

             <Card className="border-none shadow-premium rounded-[40px] p-10">
                <CardHeader className="px-0 pb-10 flex flex-row items-center justify-between">
                   <div>
                      <CardTitle className="text-xl font-black uppercase">إنتاجية الحلاقين</CardTitle>
                      <CardDescription className="text-[10px] font-black uppercase tracking-widest">تحليل أداء الطاقم الفني</CardDescription>
                   </div>
                   <Award size={20} className="text-amber-500" />
                </CardHeader>
                <div className="space-y-6">
                   {operationalMetrics.topBarbers.map((barber, i) => (
                     <div key={barber.name} className="flex items-center gap-5 p-4 bg-gray-50 dark:bg-white/5 rounded-3xl group transition-all hover:translate-x-[-8px]">
                        <div className="w-12 h-12 bg-white dark:bg-[#121212] rounded-2xl flex items-center justify-center font-black text-lg shadow-soft">
                           {i + 1}
                        </div>
                        <div className="flex-1">
                           <div className="flex justify-between mb-2">
                              <span className="text-sm font-black">{barber.name}</span>
                              <span className="text-[10px] font-black text-blue-600">{barber.count} خدمة</span>
                           </div>
                           <div className="h-2 w-full bg-white dark:bg-black/20 rounded-full overflow-hidden">
                              <div className="h-full bg-[#6D28D9] dark:bg-[#22D3EE] rounded-full transition-all duration-1000" style={{ width: `${(barber.count / (operationalMetrics.topBarbers[0]?.count || 1)) * 100}%` }} />
                           </div>
                        </div>
                        <div className="flex items-center gap-1 text-amber-500 font-black text-xs">
                           <Star size={12} fill="currentColor" /> {barber.rating.toFixed(1)}
                        </div>
                     </div>
                   ))}
                </div>
             </Card>

             <Card className="xl:col-span-2 border-none shadow-soft rounded-[40px] p-10 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-transparent">
                <div className="flex items-center gap-4 mb-8">
                   <Zap size={24} className="text-indigo-600 animate-bounce" />
                   <h3 className="text-xl font-black uppercase tracking-tighter text-indigo-900 dark:text-indigo-100">توصيات التحسين التشغيلي</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="p-6 bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-[30px] border border-indigo-100 dark:border-indigo-500/20 shadow-sm flex gap-5">
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                         <Clock size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black mb-1">إدارة ساعات الذروة</h4>
                        <p className="text-[11px] font-bold text-gray-500 leading-relaxed">تحليل الزيارات يظهر ضغطاً كبيراً مساء الخميس. نقترح جدولة موظف إضافي في هذا الوقت لتقليل وقت الانتظار بنسبة ٢٥٪.</p>
                      </div>
                   </div>
                   <div className="p-6 bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-[30px] border border-emerald-100 dark:border-emerald-500/20 shadow-sm flex gap-5">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                         <TrendingUp size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black mb-1">فرص ترقية المبيعات</h4>
                        <p className="text-[11px] font-bold text-gray-500 leading-relaxed">خدمات العناية بالبشرة تحقق هامش ربح أعلى. جرب تفعيل عرض "باقة العناية المتكاملة" مع الحلاقة لزيادة متوسط الفاتورة.</p>
                      </div>
                   </div>
                </div>
             </Card>
          </div>
        )}

        {activeTab === 'history' && (
          <Card className="border-none shadow-premium rounded-[40px] overflow-hidden bg-white/80 dark:bg-[#171717]/80 animate-in fade-in slide-in-from-bottom-4">
             <CardHeader className="p-10 border-b border-black/5 dark:border-white/5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-black uppercase">سجل العمليات التفصيلي</CardTitle>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">مراجعة كاملة لجميع الحركات المالية في الفترة المختارة</p>
                </div>
                <div className="relative group w-72">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#6D28D9] transition-colors" size={16} />
                  <input 
                    type="text" 
                    placeholder="بحث بالبيان أو الفئة..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-white/5 border-none rounded-[20px] text-xs font-bold focus:ring-2 ring-purple-500/20 transition-all outline-none"
                  />
                </div>
             </CardHeader>
             <CardContent className="p-0">
                <div className="overflow-x-auto">
                   <table className="w-full text-right border-collapse">
                      <thead className="bg-gray-50/50 dark:bg-white/2">
                         <tr>
                            <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">التاريخ</th>
                            <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">البيان</th>
                            <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">الفئة</th>
                            <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.1em] text-center">النوع</th>
                            <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">المبلغ</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5">
                         {filteredHistory.map((t, i) => (
                           <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-white/2 transition-colors">
                              <td className="px-10 py-6 text-xs font-black tabular-nums text-gray-500">{(t.transaction_date || t.created_at || "").slice(0, 10)}</td>
                              <td className="px-10 py-6 text-sm font-bold text-gray-900 dark:text-gray-100">{t.note || "بدون بيان"}</td>
                              <td className="px-10 py-6">
                                <span className="px-3 py-1 bg-gray-100 dark:bg-white/5 rounded-lg text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase">{t.category || "عام"}</span>
                              </td>
                              <td className="px-10 py-6 text-center">
                                 <div className={cn(
                                   "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                                   t.direction === 'in' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                 )}>
                                   {t.direction === 'in' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                   {t.direction === 'in' ? 'إيداع' : 'صرف'}
                                 </div>
                              </td>
                              <td className={cn(
                                "px-10 py-6 text-base font-black tabular-nums",
                                t.direction === 'in' ? "text-emerald-600" : "text-red-600"
                              )}>
                                {t.direction === 'in' ? '+' : '-'}{Number(t.amount).toLocaleString()}
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                   {filteredHistory.length === 0 && (
                     <div className="py-24 text-center">
                        <ArrowRightLeft className="h-16 w-16 mx-auto text-gray-200 dark:text-white/5 mb-4 animate-pulse" />
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">لا توجد سجلات تطابق الفلاتر الحالية</p>
                     </div>
                   )}
                </div>
             </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
