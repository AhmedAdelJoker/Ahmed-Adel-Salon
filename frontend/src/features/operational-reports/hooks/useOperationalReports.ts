import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-hot-toast";
import { reportService } from "@/services/reportService";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import { aiService } from "@/lib/aiService";

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function useOperationalReports() {
  const [activeTab, setActiveTab] = useState("finance");
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [startDate, setStartDate] = useState(
    fmtDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [endDate, setEndDate] = useState(fmtDate(new Date()));
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [transRes, invRes] = await Promise.all([
        reportService.getCashTransactions({ from_date: startDate, to_date: endDate }),
        api.get("/invoices", { params: { from_date: startDate, to_date: endDate } }),
      ]);
      setTransactions(transRes.data || transRes || []);
      setInvoices(adaptList(invRes) || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching operational data:", error);
      toast.error("فشل تحميل البيانات التشغيلية");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const financialMetrics = useMemo(() => {
    let income = 0;
    let expenses = 0;
    const timeline: Record<string, { date: string; income: number; expenses: number }> = {};
    const categories: Record<string, number> = {};
    transactions.forEach((t) => {
      if (Number(t.is_voided) === 1) return;
      const amount = Number(t.amount || 0);
      const date = (t.transaction_date || t.created_at || "").slice(0, 10);
      const cat = t.category || "عام";
      if (t.direction === "in") income += amount; else expenses += amount;
      if (!timeline[date]) timeline[date] = { date, income: 0, expenses: 0 };
      if (t.direction === "in") timeline[date].income += amount; else timeline[date].expenses += amount;
      if (!categories[cat]) categories[cat] = 0;
      categories[cat] += amount;
    });
    return {
      income, expenses, net: income - expenses,
      timeline: Object.values(timeline).sort((a, b) => a.date.localeCompare(b.date)),
      categories: Object.entries(categories).map(([name, value]) => ({ name, value })),
    };
  }, [transactions]);

  const operationalMetrics = useMemo(() => {
    const serviceMap = new Map();
    const barberMap = new Map();
    const hourMap = new Map();
    const customerIds = new Set();
    invoices.forEach((inv) => {
      customerIds.add(inv.customer_id);
      const hour = new Date(inv.created_at).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      (inv.items || []).forEach((item) => {
        const sName = item.service_name || item.name || "خدمة أخرى";
        const currentS = serviceMap.get(sName) || { name: sName, count: 0, revenue: 0 };
        serviceMap.set(sName, { ...currentS, count: currentS.count + 1, revenue: currentS.revenue + Number(item.price || 0) });
        const bName = item.barber_name || "غير محدد";
        const currentB = barberMap.get(bName) || { name: bName, count: 0, rating: 4.5 + Math.random() * 0.5 };
        barberMap.set(bName, { ...currentB, count: currentB.count + 1 });
      });
    });
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: hourMap.get(i) || 0 }));
    return {
      totalCustomers: customerIds.size,
      totalServices: Array.from(serviceMap.values()).reduce((acc, s) => acc + s.count, 0),
      topServices: Array.from(serviceMap.values()).sort((a, b) => b.count - a.count).slice(0, 6),
      topBarbers: Array.from(barberMap.values()).sort((a, b) => b.count - a.count).slice(0, 5),
      hourlyData,
    };
  }, [invoices]);

  const aiInsights = useMemo(() => aiService.generateInsights(transactions), [transactions]);

  const filteredHistory = useMemo(() => {
    return transactions.filter((t) => {
      if (Number(t.is_voided) === 1) return false;
      const search = searchQuery.toLowerCase();
      return (t.note || "").toLowerCase().includes(search) || (t.category || "").toLowerCase().includes(search);
    });
  }, [transactions, searchQuery]);

  return {
    activeTab, setActiveTab, loading, lastUpdated,
    startDate, setStartDate, endDate, setEndDate,
    searchQuery, setSearchQuery,
    financialMetrics, operationalMetrics, aiInsights, filteredHistory,
    transactions, fetchData,
  };
}