import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  Plus,
  Trash2,
  Calendar,
  FileText,
  TrendingDown,
  CreditCard,
  Archive,
  Eye,
  Download,
  Save,
  Image as ImageIcon,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader, PremiumCard } from "@/components/shared/PremiumUI";
import { Pagination, createPaginationState } from "@/components/shared/Pagination";
import {
  CurrencyText,
  DateText,
} from "@/components/shared/DisplayComponents";
import { cn } from "@/lib/core/utils";
import { staticURL } from "@/services/api";
import {
  useExpensesData,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  PAYMENT_METHODS,
  ExpensesSummaryCards,
  ExpensesToolbar,
  ExpenseFormSections,
  ExpenseDetailsPanel,
} from "@/features/expenses";

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
    <div className="erp-page space-y-6 pb-10">
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

      <ExpensesSummaryCards
        summary={summary}
        hasActiveFilters={hasActiveFilters}
        categoryData={categoryData}
        paymentData={paymentData}
        expenseRowsCount={expenseRows.length}
        onSystemLinkClick={(href) => navigate(href)}
      />

      <ExpensesToolbar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        paymentFilter={paymentFilter}
        setPaymentFilter={setPaymentFilter}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        setCurrentPage={setCurrentPage}
        hasActiveFilters={hasActiveFilters}
        totalCount={totalCount}
        totalAmount={totalAmount}
        expenseRowsCount={expenseRows.length}
        onRefresh={fetchData}
      />

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

      {totalPages > 1 && (() => {
        const paginator = createPaginationState({
          page: currentPage,
          size: totalCount > 0 ? Math.ceil(totalCount / totalPages) : 25,
          total: totalCount,
        });
        return (
          <PremiumCard className="p-3">
            <Pagination
              paginator={paginator}
              onPageChange={(p) => setCurrentPage(p)}
              showSizeChanger={false}
              locale="ar"
            />
            <p className="mt-1 text-center text-[10px] font-bold text-muted">
              صفحة {currentPage} من {totalPages} • {totalCount} سجل
            </p>
          </PremiumCard>
        );
      })()}

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg rounded-[2rem] border-0 p-0 overflow-hidden bg-card shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]">
          <ExpenseDetailsPanel
            viewItem={viewItem}
            isOwner={isOwner}
            onClose={() => setIsViewOpen(false)}
            onEdit={handleEdit}
            onNavigate={(href) => navigate(href)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsModalOpen(open); }}>
        <DialogContent className="max-w-lg rounded-[1.75rem] p-0 overflow-hidden border-border bg-card shadow-premium" aria-describedby="expense-dialog-desc">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-gradient-to-br from-slate-50 to-white">
            <DialogTitle className="text-base font-black flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center"><Wallet size={16} /></span>
              {isEditing ? (isOwner ? "تعديل المصروف" : "تفاصيل المصروف") : "إضافة مصروف جديد"}
            </DialogTitle>
            <DialogDescription id="expense-dialog-desc" className="sr-only">نموذج إضافة أو تعديل بيانات المصروف</DialogDescription>
            {!isOwner && isEditing && <Badge className="mt-2 bg-amber-500 text-white rounded-full w-fit">قراءة فقط - المالك فقط يمكنه التعديل</Badge>}
          </DialogHeader>
          <div className="p-6 space-y-5 max-h-[62vh] overflow-y-auto">
            <ExpenseFormSections
              formData={formData}
              setFormData={setFormData}
              isEditing={isEditing}
              isOwner={isOwner}
              uploading={uploading}
              invoiceInputRef={invoiceInputRef}
              onInvoiceUpload={handleInvoiceUpload}
            />
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
