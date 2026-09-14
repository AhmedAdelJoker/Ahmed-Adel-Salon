import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  FileText,
  TrendingDown,
  PieChart as PieIcon,
  Tag,
  CreditCard,
  Archive,
  Search,
  Eye,
  Download,
  Save,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  TrendingUp,
  Receipt,
  Building2,
  Users,
  Package,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { motion } from "framer-motion";
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
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader, PremiumCard } from "@/components/shared/PremiumUI";
import {
  StatCard as StatCardDisplay,
  CurrencyStatCard,
  ChartCard,
  CurrencyText,
  DateText,
} from "@/components/shared/DisplayComponents";
import { cn, formatCurrency } from "@/lib/core/utils";
import { staticURL } from "@/services/api";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AnimatePresence } from "framer-motion";
import { BarChart3, FileSpreadsheet } from "lucide-react";
import { useExpensesData, CATEGORIES, PAYMENT_METHODS, CATEGORY_COLORS } from "@/features/expenses";

const CATEGORY_ICONS: Record<string, typeof Users> = {
  رواتب: Users,
  إيجار: Building2,
  مشتريات: Package,
  كهرباء: TrendingUp,
  مياه: PieIcon,
  إنترنت: BarChart3,
  صيانة: ShieldCheck,
  تسويق: TrendingDown,
  ضيافة: Receipt,
  سلف: DollarSign,
  أخرى: FileText,
};

const SYSTEM_LINKS = [
  { label: "المخزون", icon: Package, desc: "مشتريات المخزون تُنشئ مصروف تلقائي", color: "bg-emerald-500", href: "/inventory" },
  { label: "الرواتب", icon: Users, desc: "صرف الرواتب يُنشئ مصروف رواتب", color: "bg-indigo-500", href: "/owner/payroll" },
  { label: "الصندوق", icon: Wallet, desc: "كل مصروف يخصم من رصيد الكاش", color: "bg-amber-500", href: "/owner/cashbox" },
  { label: "الفواتير", icon: Receipt, desc: "الإيرادات - المصروفات = صافي الربح", color: "bg-sky-500", href: "/invoices" },
];

const ExpensesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = ["OWNER", "ADMIN"].includes(String(user?.role || "").toUpperCase());

  const {
    loading,
    currentPage,
    setCurrentPage,
    totalPages,
    expenseRows,
    categoryData,
    paymentData,
    totalAmount,
    hasActiveFilters,
    totalCount,
    summary,
    isModalOpen,
    setIsModalOpen,
    isEditing,
    isSubmitting,
    deleteId,
    setDeleteId,
    uploading,
    viewItem,
    isViewOpen,
    setIsViewOpen,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    paymentFilter,
    setPaymentFilter,
    formData,
    setFormData,
    invoiceInputRef,
    fetchData,
    handleSubmit,
    handleDelete,
    handleEdit,
    handleView,
    handleApprove,
    handleInvoiceUpload,
    resetForm,
    exportToCSV,
  } = useExpensesData(isOwner);

  return (
    <div className="erp-page space-y-6 pb-10" dir="rtl">
      <PageHeader
        title="إدارة المصاريف"
        subtitle="مركز التحكم المالي — تتبع التدفقات النقدية وتكاليف التشغيل لحظياً"
        badge="المالية • Expenses Control"
        icon={TrendingDown}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" className="h-11 rounded-xl px-3 text-xs border-border bg-card font-black hover:border-primary/20" onClick={exportToCSV}>
              <Download size={14} className="ml-1.5" /> <span className="hidden sm:inline">تصدير CSV</span>
            </Button>
            <Button variant="outline" className="h-11 rounded-xl px-3 text-xs border-border bg-card font-black" onClick={() => navigate("/expenses/archive")}>
              <Archive size={14} className="ml-1.5" /> <span className="hidden sm:inline">الأرشيف</span>
            </Button>
            <Button className="h-11 rounded-xl px-5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-black shadow-lg" onClick={() => { resetForm(); setIsModalOpen(true); }}>
              <Plus size={14} className="ml-1.5" /> إضافة مصروف
            </Button>
          </div>
        }
      />

      <PremiumCard noPadding className="overflow-hidden border-dashed bg-gradient-to-br from-card via-card to-soft/30">
        <div className="p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <FileSpreadsheet size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-main">ترابط المصروفات مع النظام</h3>
              <p className="text-[11px] font-bold text-muted">كل مصروف هو عقدة مالية مرتبطة بباقي الوحدات</p>
            </div>
            <Badge variant="outline" className="mr-auto hidden sm:flex rounded-full bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-black">تكامل تلقائي</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {SYSTEM_LINKS.map((link) => (
              <button key={link.label} onClick={() => navigate(link.href)} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-right hover:border-slate-900 hover:shadow-md transition-all">
                <div className={cn("h-10 w-10 rounded-xl text-white flex items-center justify-center shrink-0", link.color)}>
                  <link.icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-main flex items-center gap-1">
                    {link.label} <ArrowUpRight size={12} className="text-muted group-hover:text-slate-900 transition-colors" />
                  </div>
                  <div className="text-[10px] font-bold text-muted leading-tight mt-0.5 line-clamp-2">{link.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </PremiumCard>

      <div data-stats-grid="true">
        <CurrencyStatCard label="اليوم" value={Number(summary?.today_total ?? 0)} icon={Clock} variant="danger" />
        <CurrencyStatCard label="هذا الشهر" value={Number(summary?.month_total ?? summary?.total_amount ?? 0)} icon={Calendar} variant="primary" />
        <CurrencyStatCard label="هذا العام" value={Number(summary?.year_total ?? 0)} icon={TrendingUp} variant="success" />
        <StatCardDisplay label="أعلى فئة" value={String(summary?.top_category || "—")} icon={Tag} variant="warning" />
      </div>

      {summary && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="text-muted">العدد الكلي:</span>
          <Badge className="bg-slate-900 text-white rounded-full px-3 font-black">{summary.count || 0} سجل</Badge>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span className="text-muted">الإجمالي:</span>
          <span className="font-black text-main">{formatCurrency(summary.total_amount || 0)}</span>
          {hasActiveFilters && <Badge variant="outline" className="rounded-full bg-amber-50 text-amber-700 border-amber-200 mr-2">مفلتر</Badge>}
        </div>
      )}

      {expenseRows.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 min-w-0">
          <ChartCard className="xl:col-span-3" title="توزيع الفئات" subtitle="نسب المصاريف حسب كل فئة"
            badge={<Badge variant="outline" className="rounded-full text-[10px] font-black whitespace-nowrap">{categoryData.length} فئات</Badge>}
            data={categoryData} height={300} emptyTitle="لا توجد فئات بعد" emptyHint="سجّل مصاريف متعددة لرؤية التوزيع">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart margin={{ top: 0, right: 0, bottom: 12, left: 0 }}>
                <Pie data={categoryData} cx="50%" cy="44%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value" stroke="none">
                  {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [formatCurrency(value), name]} contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", fontWeight: 800, fontSize: 12 }} />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: 8, fontSize: 11, lineHeight: "18px" }} formatter={(value) => <span className="text-[11px] font-black text-main">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard className="xl:col-span-2" title="طرق الدفع" subtitle="قيمة المصاريف لكل وسيلة دفع"
            data={paymentData} height={300} emptyTitle="لا توجد بيانات دفع" emptyHint="سجّل مصاريف بوسائل دفع مختلفة">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={paymentData} margin={{ top: 8, right: 8, left: -8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} interval={0} angle={-15} textAnchor="end" height={36} tickMargin={8} />
                <YAxis tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={36} />
                <Tooltip formatter={(value) => formatCurrency(value)} cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontWeight: 700, fontSize: 11 }} />
                <Bar dataKey="value" fill="#0f172a" radius={[8, 8, 0, 0]} barSize={28} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      <PremiumCard noPadding className="overflow-hidden">
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="بحث بالعنوان، الوصف أو الفئة..." className="h-11 w-full pr-10 rounded-xl bg-soft border-border font-bold focus:border-slate-900 focus:ring-slate-900/10 text-sm" />
              {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg bg-card border border-border flex items-center justify-center"><X size={12} /></button>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="h-11 w-[140px] rounded-xl font-black bg-soft border-border"><SelectValue placeholder="الفئة" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">كل الفئات</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="h-11 w-[140px] rounded-xl font-black bg-soft border-border"><SelectValue placeholder="الدفع" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">كل الطرق</SelectItem>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} className="h-11 w-[145px] rounded-xl font-bold bg-soft border-border text-xs" />
                <span className="text-muted font-black">—</span>
                <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} className="h-11 w-[145px] rounded-xl font-bold bg-soft border-border text-xs" />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl border border-border bg-card" onClick={() => { setCategoryFilter("all"); setPaymentFilter("all"); setDateFrom(""); setDateTo(""); setSearchTerm(""); }}>
                  <X size={16} />
                </Button>
              )}
              <Button variant="outline" className="h-11 rounded-xl font-black hidden sm:flex" onClick={fetchData}>
                <RefreshCw size={14} className="ml-1.5" /> تحديث
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold text-muted border-t border-border/40 pt-3">
            <span>يعرض <span className="text-main font-black">{expenseRows.length}</span> من <span className="text-main font-black">{totalCount}</span> • الإجمالي المعروض: <span className="text-danger font-black">{formatCurrency(totalAmount)}</span></span>
            <span className="hidden sm:flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500" /> الحذف محمي لضمان النزاهة</span>
          </div>
        </div>
      </PremiumCard>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <PremiumCard key={i} className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-soft animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-soft animate-pulse" />
                  <div className="h-2 w-1/4 rounded bg-soft animate-pulse" />
                </div>
                <div className="h-8 w-24 rounded-xl bg-soft animate-pulse" />
              </div>
            </PremiumCard>
          ))}
        </div>
      ) : expenseRows.length === 0 ? (
        <PremiumCard className="py-16 text-center border-dashed">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 rounded-2xl bg-soft border border-border flex items-center justify-center">
              <FileText size={28} className="text-muted" />
            </div>
            <p className="mt-4 text-base font-black text-main">لا توجد مصاريف</p>
            <p className="mt-1 text-sm font-bold text-muted">لم نعثر على سجلات مطابقة للفلتر الحالي</p>
            <div className="flex gap-2 mt-4">
              <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="h-11 rounded-xl px-6 bg-slate-900 text-white font-black">
                <Plus size={14} className="ml-1.5" /> إضافة مصروف
              </Button>
              {hasActiveFilters && <Button variant="outline" onClick={() => { setCategoryFilter("all"); setPaymentFilter("all"); setDateFrom(""); setDateTo(""); setSearchTerm(""); }} className="h-11 rounded-xl">مسح الفلاتر</Button>}
            </div>
          </div>
        </PremiumCard>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {expenseRows.map((exp, i) => {
              const CatIcon = CATEGORY_ICONS[exp.category ?? ""] || FileText;
              const catColor = CATEGORY_COLORS[exp.category ?? ""] || "#6b7280";
              const isPending = exp.status === "pending_audit";
              const isCancelled = exp.status === "cancelled" || exp.status === "rejected";
              return (
                <motion.div key={exp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: i * 0.02 }}>
                  <PremiumCard className="group p-4 sm:p-5 hover:shadow-premium transition-all">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/50 shadow-sm" style={{ backgroundColor: `${catColor}12`, color: catColor }}>
                        <CatIcon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[14px] font-black text-main truncate max-w-[220px] sm:max-w-[320px]">{exp.title}</h3>
                          <Badge variant="outline" className="h-6 rounded-full px-2.5 text-[10px] font-black border-0 text-white" style={{ backgroundColor: catColor }}>{exp.category}</Badge>
                          {isPending && <Badge className="h-6 rounded-full bg-amber-500 text-white border-0 text-[10px] font-black animate-pulse">بانتظار الاعتماد</Badge>}
                          {isCancelled && <Badge variant="danger" className="h-6 rounded-full text-[10px] font-black">ملغي</Badge>}
                          {exp.invoice_image_url && <a href={exp.invoice_image_url.startsWith("http") ? exp.invoice_image_url : `${staticURL}${exp.invoice_image_url}`} target="_blank" rel="noreferrer" className="h-6 inline-flex items-center gap-1 rounded-full bg-slate-900 text-white px-2.5 text-[10px] font-black"><ImageIcon size={10} /> فاتورة</a>}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[11px] font-bold text-muted">
                          <span className="flex items-center gap-1"><Calendar size={12} className="text-muted/60" /><DateText value={exp.expense_date} /></span>
                          <span className="h-1 w-1 rounded-full bg-border" />
                          <span className="flex items-center gap-1"><CreditCard size={12} className="text-muted/60" />{PAYMENT_METHODS.find((m) => m.value === exp.payment_method)?.label || exp.payment_method}</span>
                          {!!exp.recipient_name && <>
                            <span className="h-1 w-1 rounded-full bg-border" />
                            <span className="flex items-center gap-1"><Users size={12} className="text-muted/60" />{String(exp.recipient_name)}</span>
                          </>}
                        </div>
                        {exp.description && <p className="mt-2 text-xs font-bold text-muted/80 line-clamp-2 bg-soft/50 rounded-xl px-3 py-2 border border-border/30">{exp.description}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={cn("text-lg font-black tabular-nums tracking-tight", isCancelled ? "line-through opacity-40 text-muted" : "text-slate-900")}>
                          <CurrencyText value={exp.amount} tone={isCancelled ? "muted" : "primary"} />
                        </span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl bg-soft border border-border hover:bg-slate-900 hover:text-white" onClick={() => handleView(exp)} title="عرض التفاصيل">
                            <Eye size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl bg-soft border border-border hover:bg-slate-900 hover:text-white" onClick={() => handleEdit(exp)} title={isOwner ? "تعديل" : "عرض"}>
                            {isOwner ? <FileText size={14} /> : <Eye size={14} />}
                          </Button>
                          {isPending && isOwner && exp.id && (
                            <Button size="sm" className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] px-3" onClick={() => exp.id != null && handleApprove(exp.id)}>
                              <CheckCircle2 size={12} className="ml-1" /> اعتماد
                            </Button>
                          )}
                          {isOwner ? (
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200" onClick={() => setDeleteId(exp.id ?? null)} title="حذف (محمي)">
                              <Trash2 size={14} />
                            </Button>
                          ) : (
                            <span className="h-8 w-8 rounded-xl bg-soft border border-border flex items-center justify-center" title="محمي">
                              <ShieldCheck size={14} className="text-emerald-500" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </PremiumCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {totalPages > 1 && (
        <PremiumCard className="p-3 flex items-center justify-between">
          <p className="text-xs font-black text-muted">صفحة <span className="text-main">{currentPage}</span> من {totalPages}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
              <ChevronRight size={16} />
            </Button>
            <span className="text-sm font-black min-w-[40px] text-center bg-soft rounded-xl py-1.5 px-3 border border-border">{currentPage}</span>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronLeft size={16} />
            </Button>
          </div>
        </PremiumCard>
      )}

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent dir="rtl" className="max-w-lg rounded-[2rem] border-0 p-0 overflow-hidden bg-card shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white relative overflow-hidden">
            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/5" />
            <div className="absolute -right-10 -bottom-10 h-24 w-24 rounded-full bg-white/5" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                  <FileText size={22} />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-white leading-tight">{viewItem?.title || "تفاصيل المصروف"}</DialogTitle>
                  <DialogDescription className="text-xs font-bold text-slate-300">عرض قراءة فقط • غير قابل للتعديل</DialogDescription>
                </div>
              </div>
              <Badge className={cn("rounded-full px-3 py-1 text-[10px] font-black border-0 shrink-0", viewItem?.status === "approved" ? "bg-emerald-500" : viewItem?.status === "pending_audit" ? "bg-amber-500" : "bg-rose-500")}>
                {viewItem?.status === "approved" ? "معتمد" : viewItem?.status === "pending_audit" ? "بانتظار" : viewItem?.status || "مسجل"}
              </Badge>
            </div>
          </div>
          {viewItem ? (
            <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-soft border border-border p-4 min-w-0">
                  <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">المبلغ</div>
                  <div className="text-lg font-black text-slate-900 truncate"><CurrencyText value={viewItem.amount} /></div>
                  <div className="text-[11px] font-bold text-muted truncate">{PAYMENT_METHODS.find((m) => m.value === viewItem.payment_method)?.label}</div>
                </div>
                <div className="rounded-2xl bg-soft border border-border p-4">
                  <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">التصنيف</div>
                  <div className="text-sm font-black text-main flex items-center gap-2">
                    <span className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs" style={{ backgroundColor: CATEGORY_COLORS[viewItem.category ?? ""] || "#6b7280" }}>{viewItem.category?.[0]}</span>
                    {viewItem.category}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-card border border-border p-3 min-w-0">
                  <div className="text-[9px] font-black text-muted uppercase">التاريخ</div>
                  <div className="font-black text-main mt-1 flex items-center gap-1.5"><Calendar size={12} /><DateText value={viewItem.expense_date} /></div>
                </div>
                <div className="rounded-xl bg-card border border-border p-3">
                  <div className="text-[9px] font-black text-muted uppercase">طريقة الدفع</div>
                  <div className="font-black text-main mt-1">{PAYMENT_METHODS.find((m) => m.value === viewItem.payment_method)?.label || viewItem.payment_method}</div>
                </div>
              </div>
              {viewItem.description && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-muted uppercase tracking-widest">الوصف</div>
                  <div className="rounded-2xl border border-border bg-soft/50 p-4">
                    <p className="text-sm font-bold leading-relaxed text-main whitespace-pre-wrap">{viewItem.description}</p>
                  </div>
                </div>
              )}
              {viewItem.invoice_image_url && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-muted uppercase tracking-widest">صورة الفاتورة</div>
                  <a href={viewItem.invoice_image_url.startsWith("http") ? viewItem.invoice_image_url : `${staticURL}${viewItem.invoice_image_url}`} target="_blank" rel="noreferrer" className="block rounded-2xl overflow-hidden border border-border hover:opacity-90 transition-opacity">
                    <img src={viewItem.invoice_image_url.startsWith("http") ? viewItem.invoice_image_url : `${staticURL}${viewItem.invoice_image_url}`} alt="فاتورة" className="w-full max-h-64 object-contain bg-soft" />
                  </a>
                </div>
              )}
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0"><Eye size={14} /></div>
                <p className="text-[11px] font-bold leading-relaxed text-amber-800">هذا العرض للقراءة فقط. للتعديل استخدم زر <b>تعديل</b> وصلاحية المالك مطلوبة.</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 h-11 rounded-xl font-black" onClick={() => setIsViewOpen(false)}>إغلاق</Button>
                {isOwner && <Button className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-black" onClick={() => { setIsViewOpen(false); handleEdit(viewItem); }}>تعديل <FileText size={14} className="mr-2" /></Button>}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsModalOpen(open); }}>
        <DialogContent className="max-w-lg rounded-[1.75rem] p-0 overflow-hidden border-border bg-card shadow-premium" dir="rtl" aria-describedby="expense-dialog-desc">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-gradient-to-br from-slate-50 to-white">
            <DialogTitle className="text-base font-black flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center"><Wallet size={16} /></span>
              {isEditing ? (isOwner ? "تعديل المصروف" : "تفاصيل المصروف") : "إضافة مصروف جديد"}
            </DialogTitle>
            <DialogDescription id="expense-dialog-desc" className="sr-only">نموذج إضافة أو تعديل بيانات المصروف</DialogDescription>
            {!isOwner && isEditing && <Badge className="mt-2 bg-amber-500 text-white rounded-full w-fit">قراءة فقط - المالك فقط يمكنه التعديل</Badge>}
          </DialogHeader>
          <div className="p-6 space-y-4 max-h-[62vh] overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">العنوان *</label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} disabled={isEditing && !isOwner} className="h-11 rounded-xl bg-soft border-border font-bold" placeholder="مثال: فاتورة الكهرباء..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">التصنيف *</label>
                <Select disabled={isEditing && !isOwner} value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">المبلغ *</label>
                <div className="relative">
                  <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} disabled={isEditing && !isOwner} className="h-11 rounded-xl bg-soft border-border font-black pr-4 pl-12" placeholder="0.00" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted">ج.م</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">طريقة الدفع</label>
                <Select disabled={isEditing && !isOwner} value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
                  <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">{PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value} className="font-bold">{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">التاريخ</label>
                <Input type="date" value={formData.expense_date} onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })} disabled={isEditing && !isOwner} className="h-11 rounded-xl bg-soft border-border font-bold" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">الوصف</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} disabled={isEditing && !isOwner} className="w-full min-h-[84px] rounded-xl border border-border bg-soft p-3 text-sm font-bold resize-none focus:border-slate-900 focus:ring-0 outline-none" placeholder="تفاصيل إضافية..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">صورة الفاتورة</label>
              <input type="file" ref={invoiceInputRef} onChange={handleInvoiceUpload} className="hidden" accept="image/*" />
              <div onClick={() => (!isEditing || isOwner) && invoiceInputRef.current?.click()} className={cn("flex items-center gap-3 rounded-xl border-2 border-dashed p-3", (!isEditing || isOwner) ? "cursor-pointer hover:bg-soft border-border" : "cursor-default border-border/50 bg-soft/50")}>
                {formData.invoice_image_url ? (
                  <img src={formData.invoice_image_url.startsWith("http") ? formData.invoice_image_url : `${staticURL}${formData.invoice_image_url}`} alt="" className="h-16 w-16 rounded-xl object-cover border border-border" />
                ) : (
                  <div className="h-16 w-16 rounded-xl border border-border bg-soft flex items-center justify-center">
                    <ImageIcon size={20} className="text-muted/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-main">{formData.invoice_image_url ? "صورة مرفقة - اضغط للتغيير" : "اضغط لرفع صورة الفاتورة"}</div>
                  <div className="text-[10px] font-bold text-muted">JPG, PNG, WEBP • حتى 20MB • {uploading ? "جاري الرفع..." : "اختياري"}</div>
                </div>
                {formData.invoice_image_url && (!isEditing || isOwner) && (
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={(e) => { e.stopPropagation(); setFormData((p) => ({ ...p, invoice_image_url: "" })); }}>
                    <X size={14} />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="p-5 pt-4 border-t border-border bg-soft/30 gap-2 flex-row">
            <Button variant="outline" onClick={() => { resetForm(); setIsModalOpen(false); }} className="h-11 flex-1 rounded-xl font-black">إلغاء</Button>
            {(!isEditing || isOwner) && (
              <Button onClick={handleSubmit} disabled={isSubmitting || uploading} className="h-11 flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black">
                {isSubmitting ? <RefreshCw size={14} className="ml-1.5 animate-spin" /> : <Save size={14} className="ml-1.5" />} {isEditing ? "حفظ التعديل" : "إضافة"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)} title="حذف المصروف" description="حذف السجلات المالية غير مسموح به حالياً لضمان نزاهة البيانات. سيتم إلغاء الطلب." onConfirm={handleDelete} confirmText="حاول الحذف" cancelText="إغلاق" variant="danger" />
    </div>
  );
};

export default ExpensesPage;
