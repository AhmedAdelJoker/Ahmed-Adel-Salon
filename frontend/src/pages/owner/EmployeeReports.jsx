import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useMemo, useState } from "react";



import {
  BadgeDollarSign,
  Briefcase,
  CalendarDays,
  Medal,
  RefreshCw,
  Search,
  UserCheck,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import { adaptList } from "../../services/apiAdapter";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card } from "../../components/ui/card";

function asNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(asNumber(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(
    asNumber(value),
  );
}

function apiErrorMessage(error, fallback = "حدث خطأ غير متوقع") {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail))
    return detail
      .map((item) => item?.msg || item?.message || String(item))
      .join(" - ");
  if (detail && typeof detail === "object")
    return detail.msg || detail.message || JSON.stringify(detail);
  return detail || error?.response?.data?.message || error?.message || fallback;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function dateKey(value) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return String(value).slice(0, 10);
  }
}

function invoiceDate(invoice) {
  return (
    invoice?.created_at ||
    invoice?.createdAt ||
    invoice?.date ||
    invoice?.invoice_date ||
    invoice?.invoiceDate
  );
}

function invoiceStatus(invoice) {
  return String(
    invoice?.status ||
      invoice?.invoice_status ||
      invoice?.invoiceStatus ||
      "paid",
  ).toLowerCase();
}

function isRevenueInvoice(invoice) {
  return !["cancelled", "voided", "refunded", "deleted"].includes(
    invoiceStatus(invoice),
  );
}

function invoiceItems(invoice) {
  if (Array.isArray(invoice?.items)) return invoice.items;
  if (Array.isArray(invoice?.invoice_items)) return invoice.invoice_items;
  if (Array.isArray(invoice?.lines)) return invoice.lines;
  if (Array.isArray(invoice?.services)) return invoice.services;
  return [];
}

function invoiceTotal(invoice) {
  return asNumber(
    invoice?.total_amount ??
      invoice?.totalAmount ??
      invoice?.total ??
      invoice?.net_total ??
      invoice?.netTotal,
  );
}

function itemTotal(item) {
  const qty = asNumber(item?.quantity ?? item?.qty ?? 1) || 1;
  const unit = asNumber(
    item?.unit_price ?? item?.unitPrice ?? item?.price ?? item?.amount ?? 0,
  );
  return asNumber(
    item?.total_price ??
      item?.totalPrice ??
      item?.line_total ??
      item?.lineTotal ??
      unit * qty,
  );
}

function itemName(item) {
  return (
    item?.service_name ||
    item?.serviceName ||
    item?.product_name ||
    item?.productName ||
    item?.name ||
    item?.description ||
    "بند"
  );
}

function employeeIdFromInvoice(invoice, item) {
  return (
    item?.employee_id ||
    item?.employeeId ||
    item?.barber_id ||
    item?.barberId ||
    item?.staff_id ||
    item?.staffId ||
    invoice?.employee_id ||
    invoice?.employeeId ||
    invoice?.barber_id ||
    invoice?.barberId ||
    invoice?.staff_id ||
    invoice?.staffId ||
    "unknown"
  );
}

function employeeNameFromInvoice(invoice, item) {
  return (
    item?.employee_name ||
    item?.employeeName ||
    item?.barber_name ||
    item?.barberName ||
    item?.staff_name ||
    item?.staffName ||
    invoice?.employee_name ||
    invoice?.employeeName ||
    invoice?.barber_name ||
    invoice?.barberName ||
    invoice?.staff_name ||
    invoice?.staffName ||
    "غير محدد"
  );
}

function commissionRateFor(employee, item) {
  const raw =
    item?.commission_rate ??
    item?.commissionRate ??
    employee?.commission_rate ??
    employee?.commissionRate ??
    employee?.service_commission_rate ??
    employee?.serviceCommissionRate ??
    0;
  const rate = asNumber(raw);
  if (rate > 1) return rate / 100;
  return rate;
}

function employeeDisplayName(employee) {
  return (
    employee?.full_name ||
    employee?.fullName ||
    employee?.name ||
    `${employee?.first_name || employee?.firstName || ""} ${employee?.last_name || employee?.lastName || ""}`.trim() ||
    "موظف"
  );
}

function employeeId(employee) {
  return (
    employee?.id ||
    employee?.employee_id ||
    employee?.employeeId ||
    employee?.user_id ||
    employee?.userId
  );
}

function buildEmployeeRows(invoices, employees) {
  const employeeMap = new Map();
  employees.forEach((employee) => {
    const id = String(employeeId(employee) || employeeDisplayName(employee));
    employeeMap.set(id, employee);
  });

  const rows = new Map();
  invoices.filter(isRevenueInvoice).forEach((invoice) => {
    const items = invoiceItems(invoice);
    const effectiveItems = items.length
      ? items
      : [{ name: "فاتورة", total_price: invoiceTotal(invoice) }];
    effectiveItems.forEach((item) => {
      const id = String(employeeIdFromInvoice(invoice, item));
      const employee =
        employeeMap.get(id) ||
        employeeMap.get(String(employeeNameFromInvoice(invoice, item))) ||
        null;
      const name = employee
        ? employeeDisplayName(employee)
        : employeeNameFromInvoice(invoice, item);
      const rowKey = id === "unknown" ? name : id;
      const row = rows.get(rowKey) || {
        id: rowKey,
        name,
        invoices: new Set(),
        serviceCount: 0,
        sales: 0,
        commission: 0,
        avgTicket: 0,
        topService: new Map(),
      };
      const total = itemTotal(item);
      const rate = commissionRateFor(employee, item);
      row.invoices.add(
        invoice?.id ||
          invoice?.invoice_id ||
          invoice?.invoiceNo ||
          invoice?.invoice_no ||
          Math.random(),
      );
      row.serviceCount += 1;
      row.sales += total;
      row.commission += total * rate;
      const serviceName = itemName(item);
      row.topService.set(
        serviceName,
        (row.topService.get(serviceName) || 0) + 1,
      );
      rows.set(rowKey, row);
    });
  });

  return [...rows.values()]
    .map((row) => {
      const top = [...row.topService.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        ...row,
        invoiceCount: row.invoices.size,
        avgTicket: row.invoices.size ? row.sales / row.invoices.size : 0,
        topServiceName: top?.[0] || "-",
      };
    })
    .sort((a, b) => b.sales - a.sales);
}

function TopBar({ rows }) {
  const max = Math.max(...rows.map((row) => row.sales), 1);
  if (!rows.length)
    return (
      <div className="rounded-3xl border border-dashed p-8 text-center text-sm font-bold text-gray-400">
        لا توجد بيانات موظفين في النطاق الحالي
      </div>
    );

  

  return (
    <div className="space-y-3">
      {rows.slice(0, 10).map((row, index) => (
        <div
          key={row.id}
          className="grid grid-cols-[40px_160px_1fr_140px] items-center gap-3 text-sm"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 font-black text-amber-700">
            {index + 1}
          </div>
          <div className="truncate font-black text-gray-700 dark:text-gray-100">
            {row.name}
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-600"
              style={{ width: `${Math.max((row.sales / max) * 100, 4)}%` }}
            />
          </div>
          <div className="text-left font-black">
            {formatCurrency(row.sales)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EmployeeReports() {
  const [invoices, setInvoices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayKey());

  async function fetchData() {
    try {
      setLoading(true);
      const [invoiceResponse, employeeResponse] = await Promise.allSettled([
        api.get("/invoices", {
          params: { from_date: fromDate, to_date: toDate },
        }),
        api.get("/employees"),
      ]);
      if (invoiceResponse.status === "fulfilled")
        setInvoices(adaptList(invoiceResponse.value));
      else throw invoiceResponse.reason;
      if (employeeResponse.status === "fulfilled")
        setEmployees(adaptList(employeeResponse.value));
      else setEmployees([]);
    } catch (error) {
      console.error(
        "Employee reports load error:",
        error?.response?.data || error,
      );
      toast.error(apiErrorMessage(error, "فشل تحميل تقارير الموظفين"));
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const key = dateKey(invoiceDate(invoice));
      if (fromDate && key && key < fromDate) return false;
      if (toDate && key && key > toDate) return false;
      return true;
    });
  }, [invoices, fromDate, toDate]);

  const rows = useMemo(
    () => buildEmployeeRows(filteredInvoices, employees),
    [filteredInvoices, employees],
  );
  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row) =>
      [row.name, row.topServiceName].join(" ").toLowerCase().includes(text),
    );
  }, [rows, query]);

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.sales += row.sales;
        acc.commission += row.commission;
        acc.services += row.serviceCount;
        acc.invoices += row.invoiceCount;
        return acc;
      },
      { sales: 0, commission: 0, services: 0, invoices: 0 },
    );
  }, [filteredRows]);

  return (
    <div className="erp-page-container space-y-6 pb-24" dir="rtl">
      <Card className="overflow-hidden border-amber-100 bg-linear-to-r from-white via-amber-50/60 to-emerald-50 p-7 shadow-sm dark:border-white/10 dark:from-[#171717] dark:via-amber-500/10 dark:to-emerald-500/5">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-700 dark:bg-cyan-400/10 dark:text-cyan-300">
              <BadgeDollarSign size={34} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-950 dark:text-gray-50">
                تقارير الموظفين والعمولات
              </h1>
              <p className="mt-1 text-sm font-bold text-gray-500">
                تحليل مبيعات كل موظف وعدد الخدمات والعمولات داخل نطاق زمني محدد
              </p>
            </div>
          </div>
          <Button
            disabled={loading}
            onClick={fetchData}
            disabled={loading}
            className="h-12 rounded-2xl px-6 font-black"
          >
            <RefreshCw
              size={18}
              className={loading ? "ml-2 animate-spin" : "ml-2"}
            />{" "}
            تحديث التقرير
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-black text-gray-500">
          <CalendarDays size={18} /> نطاق التقرير والبحث
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1.5fr_160px]">
          <Input
            type="date"
            value={fromDate || ""}
            onChange={(event) => setFromDate(event.target.value)}
            className="h-12"
          />
          <Input
            type="date"
            value={toDate || ""}
            onChange={(event) => setToDate(event.target.value)}
            className="h-12"
          />
          <div className="relative">
            <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query || ""}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="بحث باسم الموظف أو الخدمة الأكثر تكراراً..."
              className="h-12 pr-11"
            />
          </div>
          <Button
            disabled={loading}
            onClick={fetchData}
            className="h-12 rounded-2xl font-black"
          >
            تطبيق
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-black text-gray-500">
            إجمالي مبيعات الموظفين
          </p>
          <p className="mt-2 text-2xl font-black text-emerald-600">
            {formatCurrency(summary.sales)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black text-gray-500">إجمالي العمولات</p>
          <p className="mt-2 text-2xl font-black text-amber-600">
            {formatCurrency(summary.commission)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black text-gray-500">عدد الخدمات</p>
          <p className="mt-2 text-3xl font-black">
            {formatNumber(summary.services)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black text-gray-500">
            عدد الفواتير المرتبطة
          </p>
          <p className="mt-2 text-3xl font-black text-blue-600">
            {formatNumber(summary.invoices)}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-black">أفضل الموظفين حسب المبيعات</h2>
            <Medal size={22} className="text-amber-600" />
          </div>
          <TopBar rows={filteredRows} />
        </Card>
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-black">ملخص سريع</h2>
            <Briefcase size={22} className="text-emerald-600" />
          </div>
          <div className="space-y-4">
            <div className="rounded-3xl bg-gray-50 p-5 dark:bg-white/5">
              <p className="text-xs font-black text-gray-500">
                أعلى موظف مبيعات
              </p>
              <p className="mt-2 text-xl font-black">
                {filteredRows[0]?.name || "-"}
              </p>
              <p className="mt-1 text-sm font-bold text-emerald-600">
                {filteredRows[0]
                  ? formatCurrency(filteredRows[0].sales)
                  : formatCurrency(0)}
              </p>
            </div>
            <div className="rounded-3xl bg-gray-50 p-5 dark:bg-white/5">
              <p className="text-xs font-black text-gray-500">
                أكثر خدمة تكراراً عند الأعلى
              </p>
              <p className="mt-2 text-xl font-black">
                {filteredRows[0]?.topServiceName || "-"}
              </p>
            </div>
            <div className="rounded-3xl bg-gray-50 p-5 dark:bg-white/5">
              <p className="text-xs font-black text-gray-500">
                متوسط مبيعات الموظف
              </p>
              <p className="mt-2 text-xl font-black">
                {formatCurrency(
                  filteredRows.length ? summary.sales / filteredRows.length : 0,
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b bg-gray-50 p-5 dark:bg-white/5">
          <h2 className="text-lg font-black">تفاصيل الموظفين والعمولات</h2>
        </div>
        {loading ? (
          <div className="flex min-h-52 items-center justify-center text-gray-500">
            <RefreshCw className="ml-2 h-5 w-5 animate-spin" /> جاري تحميل
            التقرير...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center text-center text-gray-400">
            <UserCheck size={48} className="mb-3 opacity-40" />
            <p className="font-black">لا توجد بيانات موظفين مطابقة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-right text-sm">
              <thead className="bg-gray-50 text-xs font-black text-gray-500 dark:bg-white/5">
                <tr>
                  <th className="px-5 py-4">الموظف</th>
                  <th className="px-5 py-4">المبيعات</th>
                  <th className="px-5 py-4">العمولة</th>
                  <th className="px-5 py-4">عدد الخدمات</th>
                  <th className="px-5 py-4">عدد الفواتير</th>
                  <th className="px-5 py-4">متوسط الفاتورة</th>
                  <th className="px-5 py-4">أكثر خدمة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50/70 dark:hover:bg-white/5"
                  >
                    <td className="px-5 py-4 font-black">{row.name}</td>
                    <td className="px-5 py-4 font-black text-emerald-600">
                      {formatCurrency(row.sales)}
                    </td>
                    <td className="px-5 py-4 font-black text-amber-600">
                      {formatCurrency(row.commission)}
                    </td>
                    <td className="px-5 py-4">
                      {formatNumber(row.serviceCount)}
                    </td>
                    <td className="px-5 py-4">
                      {formatNumber(row.invoiceCount)}
                    </td>
                    <td className="px-5 py-4">
                      {formatCurrency(row.avgTicket)}
                    </td>
                    <td className="px-5 py-4">{row.topServiceName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

