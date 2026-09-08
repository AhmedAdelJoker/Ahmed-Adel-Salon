import React, { useEffect, useMemo, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileText,
  Printer,
  RefreshCw,
  Search,
  FileDown,
  Activity,
  CreditCard,
  Zap,
  Receipt,
  Download,
  ArrowRight,
  Filter,
  Clock,
  User,
  Wallet,
  TrendingUp,
  MessageCircle,
  Scissors,
  XCircle,
  Banknote,
  X,
  BarChart3,
  PieChart as PieChartIcon,
  Eye,
} from "lucide-react";
import { toast } from "react-hot-toast";
import ExcelJS from "exceljs";
import { useSalon } from "@/context/SalonContext";
import { printThermalReceipt } from "@/lib/print/receipt";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/core/utils";
import { AnimatePresence } from "framer-motion";

/* ───────── Constants ───────── */
const PAY = {
  cash: "نقدي",
  card: "شبكة",
  wallet: "محفظة",
  instapay: "انستا باي",
  split: "مقسم",
};
const PAY_ICON = {
  cash: Banknote,
  card: CreditCard,
  wallet: Wallet,
  instapay: Zap,
  split: Receipt,
};
const STATUS = {
  paid: "مدفوعة",
  completed: "مكتملة",
  cancelled: "ملغاة",
  voided: "ملغاة",
  refunded: "مرتجعة",
};
const STATUS_STYLE = {
  paid: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-800",
  completed:
    "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-800",
  cancelled:
    "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-800",
  voided:
    "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-800",
  refunded:
    "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-800",
};
const CHART_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

const TIME_PRESETS = [
  { k: "today", l: "اليوم" },
  { k: "yesterday", l: "أمس" },
  { k: "week", l: "هذا الأسبوع" },
  { k: "month", l: "هذا الشهر" },
  { k: "last_month", l: "الشهر الماضي" },
  { k: "year", l: "هذا العام" },
  { k: "all", l: "الكل" },
  { k: "custom", l: "مخصص" },
];

/* ───────── Helpers ───────── */
const fmt = (v) => {
  const n = Number(v ?? 0);
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
};
const fmtNum = (v) => {
  const n = Number(v ?? 0);
  return new Intl.NumberFormat("ar-EG").format(Number.isFinite(n) ? n : 0);
};
const fmtDate = (v) => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("ar-EG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (err) {
    return String(v);
  }
};
const fmtDateShort = (v) => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("ar-EG", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (err) {
    return String(v);
  }
};
const getId = (i) => i?.id || i?.invoice_id;
const getNo = (i) => i?.invoice_no || getId(i) || "—";
const getCust = (i) => i?.customer_name || "عميل نقدي";
const getPay = (i) => String(i?.payment_method || "").toLowerCase();
const getStatus = (i) => String(i?.status || "paid").toLowerCase();
const getTotal = (i) => {
  const n = Number(i?.total_amount ?? i?.total ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const getDate = (i) => i?.created_at || i?.createdAt;
const getItems = (i) =>
  Array.isArray(i?.items)
    ? i.items
    : Array.isArray(i?.invoice_items)
      ? i.invoice_items
      : [];
const getItemName = (it) => it?.service_name || it?.name || "بند";
const getBarber = (inv) => {
  if (inv?.barber_name) return inv.barber_name;
  const items = getItems(inv);
  const names = [
    ...new Set(
      items.map((i) => i.barber_name || i.employee_name).filter(Boolean),
    ),
  ];
  return names.length === 1 ? names[0] : names.length > 1 ? "متعدد" : "—";
};
const getCashier = (inv) => inv?.cashier_name || "غير محدد";
const getSubtotal = (i) => {
  const n = Number(i?.subtotal_amount ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const getDiscount = (i) => {
  const n = Number(i?.discount_amount ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function timeRange(f) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (d) => d.toISOString().split("T")[0];
  switch (f) {
    case "today":
      return { from: iso(today), to: iso(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: iso(y), to: iso(y) };
    }
    case "week": {
      const s = new Date(today);
      s.setDate(s.getDate() - s.getDay());
      return { from: iso(s), to: iso(today) };
    }
    case "month":
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: iso(today),
      };
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: iso(s), to: iso(e) };
    }
    case "year":
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(today) };
    default:
      return { from: "", to: "" };
  }
}

/* ───────── Skeleton Loader ───────── */
function Skeleton({ className }: any) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700/50",
        className,
      )}
    />
  );
}

function SkeletonPage() {
  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 lg:p-6 space-y-5"
      dir="rtl"
    >
      <div className="flex justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Skeleton className="h-[500px] rounded-xl lg:col-span-4" />
        <Skeleton className="h-[500px] rounded-xl lg:col-span-8" />
      </div>
    </div>
  );
}

/* ───────── Animated Counter ───────── */
function AnimatedNumber({ value, format = "number" }: any) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target =
      typeof value === "string"
        ? parseFloat(value.replace(/[^0-9.-]/g, "")) || 0
        : Number(value) || 0;
    const duration = 600;
    const start = performance.now();
    const from = display;
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round((from + (target - from) * ease) * 100) / 100);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);
  if (format === "currency") return <>{fmt(display)}</>;
  return <>{fmtNum(display)}</>;
}

/* ───────── KPI Card ───────── */
const KpiCard = memo(function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  suffix,
  format,
}: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-white dark:bg-slate-800 p-3.5 lg:p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 group",
        color,
      )}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
        style={{ backgroundColor: "currentColor", opacity: 0.6 }}
      />
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] lg:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className="text-lg lg:text-xl font-extrabold text-slate-900 dark:text-white tabular-nums leading-tight">
            {typeof value === "number" ? (
              <AnimatedNumber value={value} format={format} />
            ) : (
              value
            )}
          </p>
          {suffix && (
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
              {suffix}
            </p>
          )}
        </div>
        <div
          className={cn(
            "h-9 w-9 lg:h-10 lg:w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110",
            "bg-opacity-10",
          )}
        >
          <Icon size={18} className="text-current opacity-70" />
        </div>
      </div>
    </motion.div>
  );
});

/* ───────── Charts Section ───────── */
const AnalyticsCharts = memo(function AnalyticsCharts({ invoices }: any) {
  const payData = useMemo(() => {
    if (!invoices?.length) return [];
     
    const c: Record<string, any> = {};
    invoices.forEach((inv) => {
      const m = getPay(inv) || "unknown";
      c[m] = (c[m] || 0) + 1;
    });
    return Object.entries(c).map(([name, value]) => ({
      name: PAY[name] || name,
      value,
    }));
  }, [invoices]);

  const trend = useMemo(() => {
    if (!invoices?.length) return [];
     
    const t: Record<string, any> = {};
    invoices.forEach((inv) => {
      const d = getDate(inv)?.split("T")[0];
      if (d) t[d] = (t[d] || 0) + getTotal(inv);
    });
    return Object.entries(t)
      .map(([date, amount]) => ({ date, amount: Math.round(amount) }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  }, [invoices]);

  const topBarbers = useMemo(() => {
    if (!invoices?.length) return [];
     
    const b: Record<string, any> = {};
    invoices.forEach((inv) => {
      const name = getBarber(inv);
      if (name && name !== "—" && name !== "متعدد") {
        b[name] = (b[name] || 0) + getTotal(inv);
      }
    });
    return Object.entries(b)
      .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [invoices]);

  const topServices = useMemo(() => {
    if (!invoices?.length) return [];
     
    const s: Record<string, any> = {};
    invoices.forEach((inv) => {
      getItems(inv).forEach((item) => {
        const name = getItemName(item);
        s[name] =
          (s[name] || 0) + Number(item?.total_price || item?.unit_price || 0);
      });
    });
    return Object.entries(s)
      .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [invoices]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-xl text-xs">
        <p className="font-bold text-slate-600 dark:text-slate-300 mb-1">
          {label}
        </p>
        {payload.map((p, i) => (
          <p key={i} className="font-black" style={{ color: p.color }}>
            {fmt(p.value)}
          </p>
        ))}
      </div>
    );
  };

  if (!invoices?.length) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Donut */}
      {payData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-white">
                توزيع الدفع
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                حسب عدد الفواتير
              </p>
            </div>
            <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <PieChartIcon size={13} className="text-indigo-500" />
            </div>
          </div>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={payData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {payData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            {payData.map((e, i) => (
              <div key={i} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">
                  {e.name}
                </span>
                <span className="text-[9px] font-black text-slate-700 dark:text-slate-200">
                  {e.value}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Sales Trend */}
      {trend.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={cn(
            "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm",
            payData.length > 0 ? "lg:col-span-2" : "lg:col-span-3",
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-white">
                منحنى المبيعات
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                آخر {trend.length} يوم
              </p>
            </div>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <Activity size={13} className="text-emerald-500" />
            </div>
          </div>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trend}
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                  className="dark:stroke-slate-700"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                  tickFormatter={(v) => v.toLocaleString("ar-EG")}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorAmount)"
                  dot={{
                    r: 3,
                    fill: "#10b981",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Top Barbers */}
      {topBarbers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-white">
                أفضل الخبراء
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                حسب الإيراد
              </p>
            </div>
            <div className="h-7 w-7 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
              <Scissors size={13} className="text-violet-500" />
            </div>
          </div>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topBarbers}
                layout="vertical"
                margin={{ top: 0, right: 5, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.toLocaleString("ar-EG")}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 9, fill: "#64748b", fontWeight: "bold" }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="revenue"
                  fill="#8b5cf6"
                  radius={[0, 4, 4, 0]}
                  barSize={14}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Top Services */}
      {topServices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-white">
                أكثر الخدمات
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                حسب الإيراد
              </p>
            </div>
            <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
              <BarChart3 size={13} className="text-amber-500" />
            </div>
          </div>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topServices}
                margin={{ top: 0, right: 5, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 8, fill: "#64748b", fontWeight: "bold" }}
                  axisLine={false}
                  tickLine={false}
                  angle={-20}
                  textAnchor="end"
                  height={40}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                  tickFormatter={(v) => v.toLocaleString("ar-EG")}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="revenue"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Daily Invoice Count */}
      {trend.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-white">
                عدد الفواتير اليومية
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                آخر {trend.length} يوم
              </p>
            </div>
            <div className="h-7 w-7 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center">
              <Receipt size={13} className="text-cyan-500" />
            </div>
          </div>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trend}
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="amount"
                  fill="#06b6d4"
                  radius={[3, 3, 0, 0]}
                  barSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </div>
  );
});

/* ───────── Filter Bar ───────── */
const FilterBar = memo(function FilterBar({
  timeF,
  setTimeF,
  query,
  setQuery,
  from,
  setFrom,
  to,
  setTo,
  payF,
  setPayF,
  statusF,
  setStatusF,
  onReset,
  activeCount,
}: any) {
  const [searchFocused, setSearchFocused] = useState(false);

  const handleDateFrom = (val) => {
    setFrom(val);
    setTimeF("custom");
  };
  const handleDateTo = (val) => {
    setTo(val);
    setTimeF("custom");
  };
  const handleTimePreset = (k) => {
    setTimeF(k);
    if (k !== "custom") {
      const r = timeRange(k);
      setFrom(r.from);
      setTo(r.to);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-3 lg:p-4 shadow-sm"
    >
      {/* Period Presets */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100 dark:border-slate-700/50 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          <Filter size={12} className="text-slate-400" />
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            الفترة
          </span>
        </div>
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />
        {TIME_PRESETS.map(({ k, l }: any) => (
          <button
            key={k}
            onClick={() => handleTimePreset(k)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] lg:text-[11px] font-bold whitespace-nowrap transition-all duration-200 shrink-0",
              timeF === k
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600",
            )}
          >
            {l}
          </button>
        ))}
        {activeCount > 0 && (
          <>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />
            <button
              onClick={onReset}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
            >
              <X size={11} /> مسح الفلاتر ({activeCount})
            </button>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-5 lg:gap-2.5">
        {/* Search */}
        <div
          className={cn(
            "relative lg:col-span-2 rounded-lg border transition-all duration-200",
            searchFocused
              ? "border-primary ring-2 ring-primary/10"
              : "border-slate-200 dark:border-slate-700",
          )}
        >
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={14}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="بحث بالرقم، العميل، الخبير، الكاشير..."
            className="w-full pr-9 pl-8 py-2.5 text-xs font-bold bg-transparent focus:outline-none text-slate-800 dark:text-white placeholder:text-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
            >
              <X size={10} className="text-slate-500 dark:text-slate-300" />
            </button>
          )}
        </div>

        {/* Dates */}
        <div className="flex gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => handleDateFrom(e.target.value)}
            className="flex-1 font-bold h-[38px] text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-700 dark:text-slate-200 [color-scheme:light] dark:[color-scheme:dark]"
            style={{ direction: "ltr", textAlign: "left" }}
          />
          <input
            type="date"
            value={to}
            onChange={(e) => handleDateTo(e.target.value)}
            className="flex-1 font-bold h-[38px] text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-700 dark:text-slate-200 [color-scheme:light] dark:[color-scheme:dark]"
            style={{ direction: "ltr", textAlign: "left" }}
          />
        </div>

        {/* Payment & Status */}
        <select
          value={payF}
          onChange={(e) => setPayF(e.target.value)}
          className="font-bold h-[38px] text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary px-3 text-slate-700 dark:text-slate-200"
        >
          <option value="all">كل الدفع</option>
          <option value="cash">نقدي</option>
          <option value="card">شبكة</option>
          <option value="wallet">محفظة</option>
          <option value="instapay">انستا باي</option>
          <option value="split">مقسم</option>
        </select>
        <select
          value={statusF}
          onChange={(e) => setStatusF(e.target.value)}
          className="font-bold h-[38px] text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary px-3 text-slate-700 dark:text-slate-200"
        >
          <option value="all">الكل</option>
          <option value="paid">مدفوعة</option>
          <option value="completed">مكتملة</option>
          <option value="cancelled">ملغاة</option>
          <option value="voided">ملغاة</option>
          <option value="refunded">مرتجعة</option>
        </select>
      </div>
    </motion.div>
  );
});

/* ───────── Invoice List Item ───────── */
const InvoiceListItem = memo(function InvoiceListItem({
  inv,
  isSelected,
  onSelect,
}: any) {
  const status = getStatus(inv);
  return (
    <button
      onClick={() => onSelect(inv)}
      className={cn(
        "w-full px-3 py-2.5 text-right transition-all duration-150 flex items-center gap-2.5 border-r-[3px]",
        isSelected
          ? "bg-primary/5 dark:bg-primary/10 border-primary"
          : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50 active:bg-slate-100 dark:active:bg-slate-700",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-black",
          isSelected
            ? "bg-primary text-white"
            : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
        )}
      >
        {getCust(inv).charAt(0)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className={cn(
              "text-[11px] font-black tabular-nums truncate",
              isSelected
                ? "text-primary"
                : "text-slate-800 dark:text-slate-100",
            )}
          >
            #{getNo(inv)}
          </span>
          <span
            className={cn(
              "text-[8px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap",
              STATUS_STYLE[status] || "bg-slate-100 text-slate-500",
            )}
          >
            {STATUS[status] || status}
          </span>
        </div>
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
          {getCust(inv)}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[8px] text-slate-400 dark:text-slate-500">
            {fmtDateShort(getDate(inv))}
          </span>
          <span className="text-[8px] text-slate-300 dark:text-slate-600">
            ·
          </span>
          <span className="text-[8px] text-slate-400 dark:text-slate-500">
            {PAY[getPay(inv)] || getPay(inv)}
          </span>
        </div>
      </div>

      {/* Amount */}
      <div className="text-left shrink-0">
        <span
          className={cn(
            "text-[11px] font-black tabular-nums block",
            isSelected ? "text-primary" : "text-slate-800 dark:text-slate-100",
          )}
        >
          {fmt(getTotal(inv))}
        </span>
      </div>
    </button>
  );
});

/* ───────── Detail Panel ───────── */
function DetailPanel({ sel, settings, onPrint, onPdf, onWhatsApp, busyPdf }: any) {
  if (!sel) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center p-8 min-h-[400px]">
        <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
          <Eye size={28} className="text-slate-300 dark:text-slate-600" />
        </div>
        <p className="text-sm font-black text-slate-400 dark:text-slate-500 mb-0.5">
          اختر فاتورة من القائمة
        </p>
        <p className="text-[10px] text-slate-300 dark:text-slate-600">
          اضغط على أي فاتورة لعرض التفاصيل
        </p>
      </div>
    );
  }

  const status = getStatus(sel);

  return (
    <motion.div
      key={getId(sel)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-full flex flex-col"
    >
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 p-3.5 lg:p-4 border-b border-slate-100 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
              <Receipt size={16} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm lg:text-base font-black text-slate-900 dark:text-white">
                  فاتورة #{getNo(sel)}
                </h2>
                <span
                  className={cn(
                    "text-[8px] font-bold px-1.5 py-0.5 rounded-md",
                    STATUS_STYLE[status],
                  )}
                >
                  {STATUS[status] || status}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                <Clock size={9} /> {fmtDate(getDate(sel))}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={onPrint}
              className="h-8 px-2.5 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
            >
              <Printer size={12} /> طباعة
            </button>
            <button
              onClick={onPdf}
              disabled={busyPdf === getId(sel)}
              className="h-8 px-2.5 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <FileDown size={12} /> PDF
            </button>
            <button
              onClick={onWhatsApp}
              className="h-8 px-2.5 rounded-lg text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center gap-1"
            >
              <MessageCircle size={12} /> واتساب
            </button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            {
              icon: User,
              label: "العميل",
              value: getCust(sel),
              bg: "bg-slate-50 dark:bg-slate-700/50",
              text: "text-slate-700 dark:text-slate-200",
            },
            {
              icon: Scissors,
              label: "الخبير",
              value: getBarber(sel),
              bg: "bg-blue-50 dark:bg-blue-900/20",
              text: "text-blue-700 dark:text-blue-400",
            },
            {
              icon: Receipt,
              label: "الكاشير",
              value: getCashier(sel),
              bg: "bg-violet-50 dark:bg-violet-900/20",
              text: "text-violet-700 dark:text-violet-400",
            },
            {
              icon: CreditCard,
              label: "الدفع",
              value: PAY[getPay(sel)] || getPay(sel),
              bg: "bg-amber-50 dark:bg-amber-900/20",
              text: "text-amber-700 dark:text-amber-400",
            },
          ].map((c, i) => (
            <div key={i} className={cn("rounded-lg p-2.5", c.bg)}>
              <div className="flex items-center gap-1 mb-1">
                <c.icon size={10} className={c.text} />
                <span
                  className={cn(
                    "text-[8px] font-bold uppercase tracking-wider",
                    c.text,
                    "opacity-70",
                  )}
                >
                  {c.label}
                </span>
              </div>
              <p className={cn("text-[11px] font-black truncate", c.text)}>
                {c.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3.5 lg:p-4">
        {/* Items */}
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            البنود
          </h4>
          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
            {getItems(sel).length}
          </span>
        </div>

        {getItems(sel).length > 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="text-right p-2 font-black text-slate-500 dark:text-slate-400 text-[9px] uppercase w-7">
                    #
                  </th>
                  <th className="text-right p-2 font-black text-slate-500 dark:text-slate-400 text-[9px] uppercase">
                    البند
                  </th>
                  <th className="text-right p-2 font-black text-slate-500 dark:text-slate-400 text-[9px] uppercase hidden sm:table-cell">
                    الخبير
                  </th>
                  <th className="text-center p-2 font-black text-slate-500 dark:text-slate-400 text-[9px] uppercase w-12">
                    الكمية
                  </th>
                  <th className="text-left p-2 font-black text-slate-500 dark:text-slate-400 text-[9px] uppercase w-20">
                    السعر
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {getItems(sel).map((it, idx) => (
                  <tr
                    key={idx}
                    className={cn(
                      "transition-colors",
                      idx % 2 === 0
                        ? "bg-white dark:bg-transparent"
                        : "bg-slate-50/50 dark:bg-slate-700/20",
                      "hover:bg-primary/5 dark:hover:bg-primary/10",
                    )}
                  >
                    <td className="p-2 text-slate-400 font-bold">{idx + 1}</td>
                    <td className="p-2 font-bold text-slate-800 dark:text-slate-100">
                      {getItemName(it)}
                    </td>
                    <td className="p-2 hidden sm:table-cell">
                      <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-md">
                        {it.barber_name || getBarber(sel)}
                      </span>
                    </td>
                    <td className="p-2 text-center font-black text-slate-700 dark:text-slate-200">
                      {it?.quantity || 1}
                    </td>
                    <td className="p-2 text-left font-black text-slate-800 dark:text-slate-100 tabular-nums">
                      {fmt(it?.total_price || it?.unit_price || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              لا توجد بنود
            </p>
          </div>
        )}

        {/* Financial Summary */}
        {getItems(sel).length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 p-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  المجموع الفرعي
                </span>
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 tabular-nums">
                  {fmt(getSubtotal(sel))}
                </span>
              </div>
              {getDiscount(sel) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    الخصم
                  </span>
                  <span className="text-[11px] font-black text-red-500 tabular-nums">
                    -{fmt(getDiscount(sel))}
                  </span>
                </div>
              )}
              <div className="h-px bg-slate-200 dark:bg-slate-600" />
              <div className="flex justify-between items-center pt-0.5">
                <span className="text-xs font-black text-slate-800 dark:text-white">
                  الإجمالي
                </span>
                <span className="text-base font-black text-primary tabular-nums">
                  {fmt(getTotal(sel))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
export default function InvoiceArchive() {
  const { settings } = useSalon();
  const navigate = useNavigate();
   
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [payF, setPayF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [timeF, setTimeF] = useState("month");
   
  const [sel, setSel] = useState<any>(null);
   
  const [busyPdf, setBusyPdf] = useState<any>(null);
   
  const [exportProgress, setExportProgress] = useState<any>(null);

  /* Init date range */
  useEffect(() => {
    const r = timeRange("month");
    setFrom(r.from);
    setTo(r.to);
  }, []);

  /* Debounced search */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  /* Load data */
  const load = useCallback(async () => {
    try {
      setLoading(true);
       
      const p: Record<string, any> = {};
      if (from) p.from_date = from;
      if (to) p.to_date = to;
      if (payF !== "all") p.payment_method = payF;
      if (statusF !== "all") p.status = statusF;
      const res = await api.get("/invoices", { params: p });
      const data = res.data;
       
      let list: any[] = [];
      if (Array.isArray(data)) list = data;
      else if (data?.items) list = data.items;
      else list = adaptList(res);
      setInvoices(list);
    } catch (err) {
      console.error("Load error:", err);
      toast.error("فشل تحميل الأرشيف");
      setInvoices([]);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [from, to, payF, statusF]);

  useEffect(() => {
    load();
  }, [load]);

  /* Auto-select first */
  useEffect(() => {
    if (filtered.length > 0 && !sel) {
      setSel(filtered[0]);
    }
  }, [invoices, debouncedQuery]);

  /* Filtered list */
  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const f = [
        getNo(inv),
        getCust(inv),
        getBarber(inv),
        getCashier(inv),
        ...getItems(inv).map(getItemName),
      ];
      return f.filter(Boolean).some((x) => String(x).toLowerCase().includes(q));
    });
  }, [invoices, debouncedQuery]);

  /* Stats */
  const stats = useMemo(() => {
    return filtered.reduce(
      (a, inv) => {
        a.count++;
        a.total += getTotal(inv);
        const s = getStatus(inv);
        if (s === "paid" || s === "completed") a.paid++;
        if (s === "cancelled" || s === "voided") a.cancelled++;
        return a;
      },
      { count: 0, total: 0, paid: 0, cancelled: 0 },
    );
  }, [filtered]);
  const avg = stats.count ? stats.total / stats.count : 0;

  /* Active filter count */
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (timeF !== "month") c++;
    if (payF !== "all") c++;
    if (statusF !== "all") c++;
    if (from) c++;
    if (to) c++;
    if (query) c++;
    return c;
  }, [timeF, payF, statusF, from, to, query]);

  const resetFilters = useCallback(() => {
    setTimeF("month");
    setPayF("all");
    setStatusF("all");
    setQuery("");
    const r = timeRange("month");
    setFrom(r.from);
    setTo(r.to);
  }, []);

  /* ─── Export Excel ─── */
  const exportExcel = useCallback(async () => {
    const data = filtered.length > 0 ? filtered : invoices;
    if (!data.length) {
      toast.error("لا توجد بيانات");
      return;
    }
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Invoices");
      ws.columns = [
        { header: "رقم الفاتورة", key: "no", width: 22 },
        { header: "العميل", key: "c", width: 22 },
        { header: "التاريخ", key: "d", width: 22 },
        { header: "الخبير", key: "b", width: 18 },
        { header: "الكاشير", key: "ca", width: 18 },
        { header: "طريقة الدفع", key: "p", width: 14 },
        { header: "الحالة", key: "s", width: 14 },
        { header: "المجموع", key: "sub", width: 16 },
        { header: "الخصم", key: "disc", width: 14 },
        { header: "الإجمالي", key: "t", width: 16 },
      ];
      const hr = ws.getRow(1);
      hr.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      hr.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1e293b" },
      };
      hr.alignment = { horizontal: "center", vertical: "middle" };
      hr.height = 28;
      data.forEach((inv, idx) => {
        const row = ws.addRow({
          no: getNo(inv),
          c: getCust(inv),
          d: fmtDate(getDate(inv)),
          b: getBarber(inv),
          ca: getCashier(inv),
          p: PAY[getPay(inv)] || getPay(inv),
          s: STATUS[getStatus(inv)] || getStatus(inv),
          sub: getSubtotal(inv),
          disc: getDiscount(inv),
          t: getTotal(inv),
        });
        if (idx % 2 === 0)
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
      });
      ws.autoFilter = { from: "A1", to: `J${data.length + 1}` };
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `archive_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`تم تصدير ${data.length} فاتورة بنجاح`);
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("فشل التصدير");
    }
  }, [filtered, invoices]);

  /* ─── Export PDFs ─── */
  const exportPdfs = useCallback(async () => {
    const data = filtered.length > 0 ? filtered : invoices;
    if (!data.length) {
      toast.error("لا توجد فواتير");
      return;
    }
    setExportProgress({ current: 0, total: data.length });
    let ok = 0;
    const token = localStorage.getItem("token");
    for (let i = 0; i < data.length; i++) {
      const inv = data[i];
      const id = getId(inv);
      if (!id) {
        setExportProgress({ current: i + 1, total: data.length });
        continue;
      }
      try {
        const url = `/api/v1/invoices/${id}/pdf`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `${getNo(inv)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        ok++;
        await new Promise((r) => setTimeout(r, 500));
        URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error("PDF export error:", id, err);
      }
      setExportProgress({ current: i + 1, total: data.length });
    }
    setExportProgress(null);
    if (ok > 0) {
      toast.success(`تم تصدير ${ok} من ${data.length} فاتورة PDF`);
    } else {
      toast.error("فشل تصدير PDF");
    }
  }, [filtered, invoices]);

  /* ─── Open PDF ─── */
  const openPdf = useCallback(async (inv) => {
    const id = getId(inv);
    if (!id) return;
    try {
      setBusyPdf(id);
      const token = localStorage.getItem("token");
      const url = `/api/v1/invoices/${id}/pdf?inline=true`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const u = URL.createObjectURL(blob);
      window.open(u, "_blank");
      setTimeout(() => URL.revokeObjectURL(u), 60000);
    } catch (err) {
      toast.error("تعذر فتح PDF");
    } finally {
      setBusyPdf(null);
    }
  }, []);

  /* ─── WhatsApp ─── */
  const sendWhatsApp = useCallback(async (inv) => {
    const id = getId(inv);
    if (!id) return;
    try {
      await api.post(`/invoices/${id}/send-whatsapp-pdf`);
      toast.success("تم الإرسال عبر واتساب");
    } catch (err) {
      toast.error("فشل الإرسال عبر واتساب");
    }
  }, []);

  /* ─── Print ─── */
  const handlePrint = useCallback(
    (inv) => {
      printThermalReceipt(inv, settings);
    },
    [settings],
  );

  /* Initial loading */
  if (initialLoad) return <SkeletonPage />;

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors"
      dir="rtl"
    >
      <div className="max-w-[1800px] mx-auto p-3 lg:p-5 space-y-4">
        {/* ─── Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
              <FileText size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg lg:text-xl font-extrabold text-slate-900 dark:text-white">
                  أرشيف الفواتير
                </h1>
                <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                  {fmtNum(stats.count)}
                </span>
              </div>
              <p className="text-[10px] lg:text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {from && to ? `${from} → ${to}` : "جميع الفواتير"}
                {payF !== "all" && ` · ${PAY[payF]}`}
                {statusF !== "all" && ` · ${STATUS[statusF]}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => navigate("/invoices")}
              className="h-9 px-3 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <ArrowRight size={13} /> فواتير الشهر
            </button>
            <button
              onClick={exportExcel}
              className="h-9 px-3 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
            >
              <Download size={13} /> Excel
            </button>
            <button
              onClick={exportPdfs}
              className="h-9 px-3 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <FileDown size={13} /> PDF
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="h-9 px-3 rounded-lg text-[11px] font-bold bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={13} className={cn(loading && "animate-spin")} />{" "}
              تحديث
            </button>
          </div>
        </motion.div>

        {/* ─── KPI Stats ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 lg:gap-3">
          <KpiCard
            label="الفواتير"
            value={stats.count}
            icon={FileText}
            color="text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
          />
          <KpiCard
            label="المبيعات"
            value={stats.total}
            icon={Zap}
            color="text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
            format="currency"
          />
          <KpiCard
            label="المتوسط"
            value={avg}
            icon={CreditCard}
            color="text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800"
            format="currency"
          />
          <KpiCard
            label="مدفوعة"
            value={stats.paid}
            icon={TrendingUp}
            color="text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
            suffix={
              stats.count
                ? `${Math.round((stats.paid / stats.count) * 100)}%`
                : "0%"
            }
          />
          <KpiCard
            label="ملغاة"
            value={stats.cancelled}
            icon={XCircle}
            color="text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
            suffix={
              stats.count
                ? `${Math.round((stats.cancelled / stats.count) * 100)}%`
                : "0%"
            }
          />
        </div>

        {/* ─── Charts ─── */}
        <AnalyticsCharts invoices={filtered} />

        {/* ─── Export Progress ─── */}
        <AnimatePresence>
          {exportProgress && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <RefreshCw
                      size={16}
                      className="animate-spin text-primary"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        جاري التصدير...
                      </span>
                      <span className="text-xs font-black text-primary">
                        {exportProgress.current} / {exportProgress.total} (
                        {Math.round(
                          (exportProgress.current / exportProgress.total) * 100,
                        )}
                        %)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(exportProgress.current / exportProgress.total) * 100}%`,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Filters ─── */}
        <FilterBar
          timeF={timeF}
          setTimeF={setTimeF}
          query={query}
          setQuery={setQuery}
          from={from}
          setFrom={setFrom}
          to={to}
          setTo={setTo}
          payF={payF}
          setPayF={setPayF}
          statusF={statusF}
          setStatusF={setStatusF}
          onReset={resetFilters}
          activeCount={activeFilterCount}
        />

        {/* ─── Split View ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[400px]">
          {/* List */}
          <div className="lg:col-span-4 flex flex-col order-2 lg:order-1">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-full shadow-sm">
              <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-700/30">
                <div className="flex items-center gap-2">
                  <Receipt size={12} className="text-primary" />
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">
                    سجل الفواتير
                  </span>
                </div>
                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                  {filtered.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-3 space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2.5 p-2.5">
                        <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-2.5 w-16" />
                        </div>
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center px-4">
                    <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                      <FileText
                        size={26}
                        className="text-slate-300 dark:text-slate-600"
                      />
                    </div>
                    <p className="text-sm font-black text-slate-400 dark:text-slate-500">
                      لا توجد فواتير
                    </p>
                    <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">
                      جرّب تغيير الفلاتر
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filtered.map((inv) => (
                      <InvoiceListItem
                        key={getId(inv)}
                        inv={inv}
                        isSelected={sel && getId(sel) === getId(inv)}
                        onSelect={setSel}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detail */}
          <div className="lg:col-span-8 order-1 lg:order-2">
            <DetailPanel
              sel={sel}
              settings={settings}
              onPrint={() => handlePrint(sel)}
              onPdf={() => openPdf(sel)}
              onWhatsApp={() => sendWhatsApp(sel)}
              busyPdf={busyPdf}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
