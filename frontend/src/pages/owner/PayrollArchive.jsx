import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useState } from "react";



import { Link } from "react-router-dom";
import payrollService from "../../services/payrollService";
import { adaptApiResponse } from "../../services/apiAdapter";
import toast from "react-hot-toast";
import exportService from "../../services/exportService";
import {
  AlertCircle,
  ArrowRight,
  FileSpreadsheet,
  Filter,
  Search,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

const MONTHS = [
  { value: "all", label: "كل الشهور" },
  { value: 1, label: "يناير" },
  { value: 2, label: "فبراير" },
  { value: 3, label: "مارس" },
  { value: 4, label: "أبريل" },
  { value: 5, label: "مايو" },
  { value: 6, label: "يونيو" },
  { value: 7, label: "يوليو" },
  { value: 8, label: "أغسطس" },
  { value: 9, label: "سبتمبر" },
  { value: 10, label: "أكتوبر" },
  { value: 11, label: "نوفمبر" },
  { value: 12, label: "ديسمبر" },
];

const YEARS = [2024, 2025, 2026, 2027];
const money = (value) => `${Number(value || 0).toLocaleString("ar-EG")} ج.م`;

function cleanParams(params) {
  const cleaned = {};
  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== "" &&
      value !== null &&
      value !== undefined &&
      value !== "all"
    ) {
      cleaned[key] = value;
    }
  });
  return cleaned;
}

const PayrollArchive = () => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    start_year: new Date().getFullYear(),
    period_month: "all",
    status: "all",
    search: "",
    page: 1,
    limit: 20,
  });

  const fetchArchive = async (nextFilters = filters) => {
    try {
      setLoading(true);
      const res = await payrollService.archive(cleanParams(nextFilters));
      const adapted = adaptApiResponse(res);
      setItems(adapted.items || []);
      setTotal(adapted.total || adapted.items?.length || 0);
    } catch (err) {
      console.error("Payroll archive load error:", err);
      toast.error("فشل تحميل أرشيف الرواتب");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {

    fetchArchive();
  }, [filters.page]);

  const archiveRows = Array.isArray(items) ? items : [];

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    const next = { ...filters, page: 1 };
    setFilters(next);
    fetchArchive(next);
  };

  return (
    <div className="space-y-8 pb-10" dir="rtl">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Link to="/owner/payroll">
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-xl border border-border bg-card hover:bg-soft"
            >
              <ArrowRight size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-main">
              أرشيف الرواتب
            </h1>
            <p className="text-sm text-muted">
              السجل التاريخي لمدفوعات الموظفين
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            exportService.downloadExcel(
              "/exports/payroll/archive/excel",
              "payroll_archive",
              cleanParams(filters),
            )
          }
          className="h-14 rounded-xl border-border bg-card px-6 font-bold"
        >
          تصدير Excel <FileSpreadsheet className="mr-2" size={18} />
        </Button>
      </div>

      <Card className="rounded-[32px] border-border bg-card p-6 shadow-soft sm:p-8">
        <form onSubmit={handleFilterSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="السنة">
              <Select
                value={String(filters.start_year) || ""}
                onValueChange={(val) =>
                  setFilters({ ...filters, start_year: Number(val) })
                }
              >
                <SelectTrigger className="h-12 rounded-xl border-border bg-soft font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  {YEARS.map((year) => (
                    <SelectItem
                      key={year}
                      value={String(year) || ""}
                      className="font-bold"
                    >
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="الشهر">
              <Select
                value={String(filters.period_month) || ""}
                onValueChange={(val) =>
                  setFilters({
                    ...filters,
                    period_month: val === "all" ? "all" : Number(val),
                  })
                }
              >
                <SelectTrigger className="h-12 rounded-xl border-border bg-soft font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  {MONTHS.map((month) => (
                    <SelectItem
                      key={month.value}
                      value={String(month.value) || ""}
                      className="font-bold"
                    >
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="الحالة">
              <Select
                value={filters.status || ""}
                onValueChange={(val) => setFilters({ ...filters, status: val })}
              >
                <SelectTrigger className="h-12 rounded-xl border-border bg-soft font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  <SelectItem value="all" className="font-bold">
                    الكل
                  </SelectItem>
                  <SelectItem value="paid" className="font-bold">
                    مدفوع
                  </SelectItem>
                  <SelectItem value="calculated" className="font-bold">
                    غير مدفوع
                  </SelectItem>
                  <SelectItem value="cancelled" className="font-bold">
                    ملغي
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="بحث عن موظف">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
                />
                <Input
                  placeholder="اسم الموظف..."
                  className="h-12 rounded-xl border-border bg-soft pr-12 font-bold"
                  value={filters.search || ""}
                  onChange={(event) =>
                    setFilters({ ...filters, search: event.target.value })
                  }
                />
              </div>
            </Field>
          </div>
          <Button
            type="submit"
            className="h-14 w-full rounded-2xl font-black shadow-soft"
          >
            تحديث النتائج <Filter className="mr-2" size={18} />
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden rounded-[32px] border-border bg-card p-0 shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-border bg-soft/30">
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-muted">
                  الموظف
                </th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-muted">
                  الشهر/السنة
                </th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-muted">
                  إجمالي المستحق
                </th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-muted">
                  طريقة الصرف
                </th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-muted">
                  تاريخ الصرف
                </th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-muted">
                  الحالة
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {archiveRows.map((item) => (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-soft/20"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-soft text-xs font-black text-accent">
                        {(item.employee_name_snapshot || "U").charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-black text-main">
                          {item.employee_name_snapshot || "غير محدد"}
                        </div>
                        <div className="text-[10px] font-bold text-muted">
                          {item.role_snapshot || "---"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-xs font-bold text-main">
                    {MONTHS.find((month) => month.value === item.period_month)
                      ?.label || item.period_month}{" "}
                    {item.period_year}
                  </td>
                  <td className="px-6 py-5 text-sm font-black text-main">
                    {money(item.net_salary)}
                  </td>
                  <td className="px-6 py-5 text-xs font-bold uppercase text-muted">
                    {item.payment_method || "---"}
                  </td>
                  <td className="px-6 py-5 text-xs font-bold text-muted">
                    {item.payment_date
                      ? new Date(item.payment_date).toLocaleDateString("ar-EG")
                      : "---"}
                  </td>
                  <td className="px-6 py-5">
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
              {archiveRows.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="py-24 text-center">
                    <AlertCircle
                      size={48}
                      className="mx-auto mb-4 text-muted/20"
                    />
                    <h4 className="text-sm font-black uppercase tracking-widest text-muted">
                      لا توجد نتائج
                    </h4>
                    <p className="mt-1 text-[10px] font-bold text-muted/60">
                      جرب تغيير فلاتر البحث
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {total > filters.limit && (
          <div className="flex items-center justify-between border-t border-border p-6">
            <Button
              type="button"
              variant="outline"
              disabled={filters.page === 1}
              title={
                filters.page === 1 ? "أنت في الصفحة الأولى" : "الصفحة السابقة"
              }
              aria-label="الصفحة السابقة"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: current.page - 1,
                }))
              }
              className="rounded-xl font-bold"
            >
              السابق
            </Button>
            <span className="text-xs font-bold text-muted">
              صفحة {filters.page}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={filters.page >= Math.ceil(total / filters.limit)}
              title={
                filters.page >= Math.ceil(total / filters.limit)
                  ? "أنت في الصفحة الأخيرة"
                  : "الصفحة التالية"
              }
              aria-label="الصفحة التالية"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: current.page + 1,
                }))
              }
              className="rounded-xl font-bold"
            >
              التالي
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <label className="mr-1 text-[11px] font-black uppercase tracking-widest text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    paid: { label: "مدفوع", className: "bg-success/10 text-success" },
    cancelled: { label: "ملغي", className: "bg-danger/10 text-danger" },
    calculated: { label: "غير مدفوع", className: "bg-soft text-muted" },
  };
  const current = config[status] || {
    label: "مسودة",
    className: "bg-soft text-muted",
  };
  return (
    <Badge
      className={`rounded-lg border-none px-2 py-0.5 text-[9px] font-black ${current.className}`}
    >
      {current.label}
    </Badge>
  );
}

export default PayrollArchive;

