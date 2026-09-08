import { useCallback, useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  Archive,
  ArrowRight,
  FileSpreadsheet,
  Filter,
  Search,
  Eye,
} from "lucide-react";

import expenseService from "@/services/expenseService";
import exportService from "@/services/exportService";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const CATEGORIES = [
  { value: "all", label: "الكل" },
  { value: "رواتب", label: "رواتب" },
  { value: "إيجار", label: "إيجار" },
  { value: "مشتريات", label: "مشتريات" },
  { value: "كهرباء", label: "كهرباء" },
  { value: "مياه", label: "مياه" },
  { value: "إنترنت", label: "إنترنت" },
  { value: "صيانة", label: "صيانة" },
  { value: "تسويق", label: "تسويق" },
  { value: "ضيافة", label: "ضيافة" },
  { value: "أخرى", label: "أخرى" },
];

const PAYMENT_METHODS = [
  { value: "all", label: "الكل" },
  { value: "cash", label: "نقدي" },
  { value: "card", label: "بطاقة" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "wallet", label: "محفظة" },
];

const DEFAULT_FILTERS = {
  start_date: "",
  end_date: "",
  category: "all",
  payment_method: "all",
  search: "",
  page: 1,
  limit: 20,
};

function cleanParams(params) {
  return Object.entries(params).reduce((acc, [key, value]) => {
    if (value === "" || value === null || value === undefined) {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
}

function getStatusLabel(status) {
  if (status === "approved") return "معتمد";
  if (status === "recorded") return "مسجل";
  if (status === "cancelled") return "ملغي";
  return status || "غير محدد";
}

 
function getStatusVariant(status): any {
  if (status === "approved") return "success";
  if (status === "cancelled") return "destructive";
  return "outline";
}

export default function ExpensesArchive() {
   
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [openDetail, setOpenDetail] = useState(false);
   
  const [detailItem, setDetailItem] = useState<any | null>(null);

  const fetchArchive = useCallback(
    async (activeFilters = filters) => {
      setLoading(true);
      try {
        const params = cleanParams({
          ...activeFilters,
          category:
            activeFilters.category === "all"
              ? undefined
              : activeFilters.category,
          payment_method:
            activeFilters.payment_method === "all"
              ? undefined
              : activeFilters.payment_method,
        });

        const response = await expenseService.archive(params);
        const normalizedItems = Array.isArray(response?.items)
          ? response.items
          : [];

        setItems(normalizedItems);
        setTotal(Number(response?.total ?? normalizedItems.length ?? 0));
        setTotalAmount(
           
          Number((response as any)?.total_amount ?? (response as any)?.totalAmount ?? 0),
        );
      } catch (error) {
        console.error("Failed to fetch expenses archive", error);
        toast.error("فشل تحميل أرشيف المصروفات");
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    fetchArchive();
  }, [fetchArchive]);

  const totalPages = useMemo(() => {
    if (!filters.limit) return 1;
    return Math.max(1, Math.ceil(total / filters.limit));
  }, [filters.limit, total]);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextFilters = { ...filters, page: 1 };
    setFilters(nextFilters);
    await fetchArchive(nextFilters);
  };

  const handlePageChange = async (page) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    const nextFilters = { ...filters, page: nextPage };
    setFilters(nextFilters);
    await fetchArchive(nextFilters);
  };

  return (
    <div className="space-y-8 pb-10" dir="rtl">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/expenses">
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-xl border border-border bg-card"
            >
              <ArrowRight size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-main">
              أرشيف المصروفات
            </h1>
            <p className="text-sm text-muted">
              مراجعة السجلات التاريخية مع تصدير النتائج الحالية.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="h-12 rounded-xl border-border bg-card font-bold"
          onClick={() =>
            exportService.downloadExcel(
              "/exports/expenses/archive/excel",
              "expenses_archive",
              filters,
            )
          }
        >
          تصدير Excel
          <FileSpreadsheet size={18} />
        </Button>
      </div>

      <Card className="rounded-[32px] border border-border bg-card p-6 shadow-soft sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-muted">
                من تاريخ
              </label>
              <Input
                type="date"
                value={filters.start_date || ""}
                onChange={(event) =>
                  handleFilterChange("start_date", event.target.value)
                }
                className="h-12 rounded-xl border-border bg-soft font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-muted">
                إلى تاريخ
              </label>
              <Input
                type="date"
                value={filters.end_date || ""}
                onChange={(event) =>
                  handleFilterChange("end_date", event.target.value)
                }
                className="h-12 rounded-xl border-border bg-soft font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-muted">
                التصنيف
              </label>
              <Select
                value={filters.category || ""}
                onValueChange={(value) => handleFilterChange("category", value)}
              >
                <SelectTrigger className="h-12 rounded-xl border-border bg-soft font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  {CATEGORIES.map((category) => (
                    <SelectItem
                      key={category.value}
                      value={category.value || ""}
                      className="font-bold"
                    >
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-muted">
                طريقة الدفع
              </label>
              <Select
                value={filters.payment_method || ""}
                onValueChange={(value) =>
                  handleFilterChange("payment_method", value)
                }
              >
                <SelectTrigger className="h-12 rounded-xl border-border bg-soft font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem
                      key={method.value}
                      value={method.value || ""}
                      className="font-bold"
                    >
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <Input
                value={filters.search || ""}
                onChange={(event) =>
                  handleFilterChange("search", event.target.value)
                }
                placeholder="بحث في العنوان أو الوصف"
                className="h-14 rounded-2xl border-border bg-soft pr-11 font-bold"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="h-14 rounded-2xl font-black sm:w-48"
            >
              تحديث النتائج
              <Filter size={18} />
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card className="rounded-3xl border border-border bg-card p-8 shadow-soft">
          <div className="text-[11px] font-black uppercase tracking-widest text-muted">
            إجمالي إنفاق الفترة
          </div>
          <div className="mt-3 text-3xl font-black tracking-tight text-main">
            {Number(totalAmount).toLocaleString()}{" "}
            <span className="text-sm font-bold text-muted">ج.م</span>
          </div>
        </Card>

        <Card className="rounded-3xl border border-border bg-card p-8 shadow-soft">
          <div className="text-[11px] font-black uppercase tracking-widest text-muted">
            عدد العمليات
          </div>
          <div className="mt-3 text-3xl font-black tracking-tight text-main">
            {total} <span className="text-sm font-bold text-muted">عملية</span>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-[32px] border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b border-border bg-soft/50">
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-muted">
                  التاريخ
                </th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-muted">
                  المصروف
                </th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-muted">
                  التصنيف
                </th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-muted">
                  المبلغ
                </th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-muted">
                  طريقة الدفع
                </th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-muted">
                  الحالة
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-soft/30">
                  <td className="px-6 py-5 text-xs font-bold text-main">
                    {item.expense_date
                      ? new Date(item.expense_date).toLocaleDateString("ar-EG")
                      : "---"}
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-black text-main">
                      {item.title || item.name || "مصروف"}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      {item.description || "---"}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <Badge variant="outline">
                      {item.category || "غير محدد"}
                    </Badge>
                  </td>
                  <td className="px-6 py-5 text-sm font-black text-main">
                    {Number(item.amount || 0).toLocaleString()} ج.م
                  </td>
                  <td className="px-6 py-5 text-xs font-bold text-muted">
                    {PAYMENT_METHODS.find(
                      (method) => method.value === item.payment_method,
                    )?.label ||
                      item.payment_method ||
                      "---"}
                  </td>
                  <td className="px-6 py-5">
                    <Badge variant={getStatusVariant(item.status)}>
                      {getStatusLabel(item.status)}
                    </Badge>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-soft transition-colors border border-border rounded-xl"
                      onClick={() => { setDetailItem(item); setOpenDetail(true); }}
                      title="عرض التفاصيل"
                    >
                      <Eye size={16} />
                    </Button>
                  </td>
                </tr>
              ))}

              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <Archive size={48} className="mx-auto text-muted/30" />
                    <h3 className="mt-4 text-sm font-black uppercase tracking-widest text-muted">
                      لا توجد نتائج مطابقة
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      جرّب تعديل الفلاتر أو توسيع نطاق التاريخ.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {total > filters.limit ? (
          <div className="flex items-center justify-between border-t border-border p-6">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl font-bold"
              title={
                filters.page <= 1 ? "أنت في الصفحة الأولى" : "الصفحة السابقة"
              }
              aria-label="الصفحة السابقة"
              disabled={loading}
              onClick={() => handlePageChange(filters.page - 1)}
            >
              السابق
            </Button>

            <span className="text-xs font-bold text-muted">
              صفحة {filters.page} من {totalPages}
            </span>

            <Button
              type="button"
              variant="outline"
              className="rounded-xl font-bold"
              title={
                filters.page >= totalPages
                  ? "أنت في الصفحة الأخيرة"
                  : "الصفحة التالية"
              }
              aria-label="الصفحة التالية"
              disabled={loading}
              onClick={() => handlePageChange(filters.page + 1)}
            >
              التالي
            </Button>
          </div>
        ) : null}
      </Card>

      <Dialog open={openDetail} onOpenChange={setOpenDetail}>
        <DialogContent dir="rtl" className="max-w-lg rounded-[2rem] border-0 p-0 overflow-hidden bg-card shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white relative overflow-hidden">
            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/5" />
            <div className="relative flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                <Archive size={22} />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">تفاصيل المصروف</h2>
                <p className="text-xs font-bold text-slate-300">عرض قراءة فقط • الأرشيف</p>
              </div>
            </div>
          </div>
          {detailItem ? (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-soft border border-border p-4">
                  <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">التاريخ</div>
                  <div className="text-sm font-black text-main">{detailItem.expense_date ? new Date(detailItem.expense_date).toLocaleDateString("ar-EG") : "---"}</div>
                </div>
                <div className="rounded-2xl bg-soft border border-border p-4">
                  <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">المبلغ</div>
                  <div className="text-sm font-black text-slate-900">{Number(detailItem.amount || 0).toLocaleString()} ج.م</div>
                </div>
                <div className="rounded-2xl bg-soft border border-border p-4">
                  <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">التصنيف</div>
                  <div className="text-sm font-black text-main">{detailItem.category || "---"}</div>
                </div>
                <div className="rounded-2xl bg-soft border border-border p-4">
                  <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">الحالة</div>
                  <div className="text-sm font-black text-main">{getStatusLabel(detailItem.status)}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">العنوان</div>
                <p className="text-sm font-black text-main">{detailItem.title || "بدون عنوان"}</p>
                <div className="text-[10px] font-black text-muted uppercase tracking-widest mt-3 mb-1">الوصف</div>
                <p className="text-sm font-bold text-muted leading-relaxed whitespace-pre-wrap">{detailItem.description || "لا يوجد وصف"}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setOpenDetail(false)} className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-black">إغلاق</button>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-muted font-bold">جاري التحميل...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
