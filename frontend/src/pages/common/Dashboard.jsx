import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Zap,
  Clock,
  Wallet,
  Users,
  Search,
  TrendingUp,
  Receipt,
  ArrowUpRight,
  ExternalLink,
  RefreshCw,
  Package,
  Scissors,
  Brain,
  Fingerprint,
  Power,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import { adaptList, adaptObject } from "../../services/apiAdapter";
import { useAuth } from "../../context/AuthContext";
import { posShiftService } from "../../services/posShiftService";
import { searchService } from "../../services/searchService";
import { cn } from "../../lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

function formatCurrency(value) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwner = user?.role === "OWNER" || user?.role === "ADMIN";
  const isCashier = user?.role === "CASHIER";

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    todayRevenue: 0,
    todayAppointments: 0,
    activeStaff: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Shift state
  const [currentShift, setCurrentShift] = useState(null);
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [openingCash, setOpeningCash] = useState("0");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, shift] = await Promise.all([
        api.get("/dashboard/owner-summary").catch(() => ({ data: {} })),
        isCashier
          ? posShiftService.current().catch(() => null)
          : Promise.resolve(null),
      ]);

      const data = adaptObject(sumRes, {});
      setSummary({
        todayRevenue: Number(data.today_revenue || 0),
        todayAppointments: Number(data.today_appointments || 0),
        activeStaff: Number(data.active_staff_count || 0),
      });
      setCurrentShift(shift);
    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  }, [isCashier]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Quick Search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await searchService.universalSearch(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error("Dashboard quick search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  const TYPE_ICONS = {
    page: LayoutDashboard,
    customer: Users,
    employee: Users,
    invoice: Receipt,
    service: Scissors,
    product: Package,
  };

  const handleOpenShift = async () => {
    try {
      setLoading(true);
      await posShiftService.open(Number(openingCash));
      toast.success("تم فتح الوردية بنجاح");
      setShowOpenShift(false);
      fetchData();
    } catch (err) {
      toast.error("فشل فتح الوردية");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="erp-page-container space-y-10 pb-24" dir="rtl">
      {/* 1. Integrated Search & Navigation Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-50 group"
      >
        <div className="relative overflow-hidden rounded-[2.5rem] p-[1px] bg-gradient-to-r from-accent/40 via-accent/5 to-transparent shadow-2xl">
          <div className="relative bg-white/95 dark:bg-card/95 backdrop-blur-xl rounded-[2.4rem] p-2 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#17110e] text-[#d3a15c] shadow-lg">
              <Search size={20} strokeWidth={2.5} />
            </div>
            <Input
              value={searchQuery || ""}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث الذكي في منظومة Barber Luxe..."
              className="h-12 flex-1 border-none bg-transparent text-lg font-black placeholder:text-muted/40 focus:ring-0"
            />
            {isSearching && (
              <div className="flex items-center gap-2 px-6 border-r border-border">
                <RefreshCw className="h-4 w-4 text-accent animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest text-accent">
                  AI Scan
                </span>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="absolute mt-4 w-full glass-panel overflow-hidden rounded-[2rem] z-50 shadow-2xl ring-1 ring-black/5 bg-white/95 dark:bg-card/95 backdrop-blur-xl border border-accent/10"
            >
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {searchResults.map((res, idx) => {
                  const Icon = TYPE_ICONS[res.type] || Receipt;
                  return (
                    <motion.button
                      key={res.to + idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => navigate(res.to)}
                      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-accent/5 text-right transition-all group/item"
                    >
                      <div className="h-11 w-11 flex items-center justify-center rounded-xl bg-soft text-[#8a5a25] group-hover/item:bg-[#17110e] group-hover/item:text-[#d3a15c] transition-all shadow-inner">
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-main truncate leading-none">
                          {res.label}
                        </p>
                        <p className="text-[10px] font-bold text-muted mt-1 uppercase tracking-widest">
                          {res.category} • {res.sub}
                        </p>
                      </div>
                      <ArrowUpRight
                        size={16}
                        className="text-accent opacity-0 group-hover/item:opacity-100 transition-all"
                      />
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 2. Executive Dashboard Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Revenue Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-8 h-full"
        >
          <Card className="h-full rounded-[3rem] border-none bg-[#17110e] text-white p-10 relative overflow-hidden shadow-2xl group">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-[#d3a15c]/10 to-transparent rounded-full blur-[120px] -mr-64 -mt-64 group-hover:scale-110 transition-transform duration-1000" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] -ml-32 -mb-32" />

            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#d3a15c]">
                      Executive Summary • Today
                    </p>
                  </div>
                  <h2 className="text-6xl font-black tracking-tighter tabular-nums mt-4 flex items-baseline gap-4">
                    {formatCurrency(summary.todayRevenue)}
                    <span className="text-lg font-bold text-white/30 uppercase tracking-widest">
                      EGP
                    </span>
                  </h2>
                </div>
                <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-xl shadow-2xl">
                  <TrendingUp size={32} className="text-[#d3a15c]" />
                </div>
              </div>

              <div className="mt-20 flex flex-col md:flex-row items-end justify-between gap-8">
                <div className="flex items-center gap-6">
                  <div className="p-4 bg-white/5 rounded-3xl border border-white/5 backdrop-blur-md">
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">
                      العمليات المنفذة
                    </p>
                    <p className="text-2xl font-black text-white">
                      {summary.todayAppointments}
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-3xl border border-white/5 backdrop-blur-md">
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">
                      نسبة النمو
                    </p>
                    <p className="text-2xl font-black text-emerald-400">
                      +12.5%
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-2xl h-12 px-8 border-white/10 text-white hover:bg-white/5 hover:border-accent"
                >
                  التفاصيل المالية <ArrowUpRight className="mr-2" size={18} />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Secondary Stats Column */}
        <div className="lg:col-span-4 grid grid-cols-1 gap-8">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="rounded-[2.5rem] p-8 border-none shadow-xl bg-white dark:bg-card relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8a5a25]">
                Daily Sales Velocity
              </p>
              <div className="mt-4 space-y-4">
                <div className="flex items-end justify-between">
                  <h4 className="text-4xl font-black text-main tabular-nums">
                    75%
                  </h4>
                  <TrendingUp size={20} className="text-orange-500 mb-1" />
                </div>
                <div className="h-1.5 w-full bg-soft rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "75%" }}
                    className="h-full bg-linear-to-r from-orange-400 to-orange-600 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                  />
                </div>
                <div className="flex justify-between items-center text-[9px] font-bold text-muted uppercase tracking-wider">
                  <span>Current: {summary.todayRevenue}</span>
                  <span>Target: 10,000</span>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="rounded-[2.5rem] p-8 border-none bg-linear-to-br from-[#17110e] to-main text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#d3a15c]/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                    <Brain size={16} className="text-[#d3a15c]" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#d3a15c]">
                    AI Strategist
                  </h3>
                </div>
                <p className="text-xs font-bold leading-relaxed text-white/70 italic">
                  "الأداء اليوم ممتاز، نلاحظ زيادة 15% في الخدمات التجميلية.
                  نقترح تفعيل عرض 'الباقة الملكية' غداً لزيادة معدل التحصيل."
                </p>
                <button className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d3a15c] hover:opacity-80 transition-opacity">
                  Generate Full Insights →
                </button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* 3. Operational Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: "نقطة البيع الذكية",
            to: "/pos",
            icon: Zap,
            color: "bg-[#17110e]",
            iconColor: "text-[#d3a15c]",
          },
          {
            label: "إدارة العملاء",
            to: "/customers",
            icon: Users,
            color: "bg-emerald-500",
            iconColor: "text-white",
          },
          {
            label: "تتبع المخزون",
            to: "/inventory",
            icon: Package,
            color: "bg-blue-500",
            iconColor: "text-white",
          },
          {
            label: "سجل المصروفات",
            to: "/expenses",
            icon: TrendingUp,
            color: "bg-orange-500",
            iconColor: "text-white",
          },
        ].map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            onClick={() => navigate(action.to)}
            className="group relative flex flex-col items-center justify-center p-8 rounded-[2.5rem] bg-white dark:bg-card shadow-lg hover:shadow-2xl transition-all hover:-translate-y-2 border border-transparent hover:border-accent/20"
          >
            <div
              className={cn(
                "h-16 w-16 rounded-[1.5rem] flex items-center justify-center shadow-2xl mb-4 group-hover:scale-110 transition-transform",
                action.color,
                action.iconColor,
              )}
            >
              <action.icon size={28} strokeWidth={2.5} />
            </div>
            <span className="text-sm font-black text-main group-hover:text-accent transition-colors">
              {action.label}
            </span>
          </motion.button>
        ))}
      </div>

      {/* 4. Executive Shift Overlay */}
      {isCashier && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="relative pt-12"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
          <Card className="rounded-[3.5rem] border-none shadow-2xl p-10 bg-white/40 dark:bg-card/40 backdrop-blur-2xl flex flex-col lg:flex-row items-center justify-between gap-12 border border-white/20">
            <div className="flex items-center gap-10">
              <div
                className={cn(
                  "h-28 w-28 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl relative",
                  currentShift
                    ? "bg-emerald-500 shadow-emerald-500/20"
                    : "bg-orange-500 shadow-orange-500/20",
                )}
              >
                <Fingerprint size={56} strokeWidth={1.5} />
                <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white dark:bg-card flex items-center justify-center shadow-md">
                  <div
                    className={cn(
                      "h-3 w-3 rounded-full animate-ping",
                      currentShift ? "bg-emerald-500" : "bg-orange-500",
                    )}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge
                    className={cn(
                      "px-4 py-1 rounded-full font-black text-[9px] uppercase tracking-widest",
                      currentShift
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-orange-500/10 text-orange-600",
                    )}
                  >
                    System Session Status
                  </Badge>
                  <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                    {currentShift ? "Live Activity" : "Standby Mode"}
                  </span>
                </div>
                <h3 className="text-4xl font-black text-main tracking-tight">
                  حالة محطة العمل
                </h3>
                <p className="text-base font-bold text-muted max-w-md leading-relaxed">
                  تحكم في جلسة العمل الحالية وتدفق السيولة النقدية بشكل لحظي
                  وآمن.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full lg:w-auto">
              {!currentShift ? (
                <Button
                  onClick={() => setShowOpenShift(true)}
                  className="flex-1 lg:w-72 h-16 rounded-[2rem] bg-[#17110e] text-[#d3a15c] font-black text-lg gap-3 hover:scale-[1.02] shadow-2xl shadow-black/20"
                >
                  <Power size={24} strokeWidth={2.5} /> فتح الوردية الجديدة
                </Button>
              ) : (
                <Button
                  onClick={() => setShowCloseShift(true)}
                  variant="outline"
                  className="flex-1 lg:w-72 h-16 rounded-[2rem] border-2 border-red-500/20 text-red-600 font-black text-lg gap-3 hover:bg-red-50 hover:border-red-500 shadow-xl shadow-red-500/5"
                >
                  <Power size={24} strokeWidth={2.5} /> إغلاق الوردية الحالية
                </Button>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Modern Dialogs */}
      <Dialog open={showOpenShift} onOpenChange={setShowOpenShift}>
        <DialogContent
          className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-card"
          dir="rtl"
        >
          <div className="bg-[#17110e] text-white p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#d3a15c]/10 rounded-full blur-[100px] -mr-40 -mt-40" />
            <div className="relative z-10 flex items-center gap-6">
              <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Wallet className="text-[#d3a15c]" size={32} />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black mb-1">
                  فتح وردية عمل
                </DialogTitle>
                <p className="text-sm font-bold text-[#d3a15c]/60">
                  التأكد من الرصيد الافتتاحي للنظام
                </p>
              </div>
            </div>
          </div>
          <div className="p-12">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8a5a25] mr-2">
                Opening Balance Amount (EGP)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={openingCash || ""}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="h-24 text-6xl font-black border-none bg-soft rounded-3xl text-center tabular-nums focus:ring-accent/20 placeholder:text-muted/20"
                  placeholder="0.00"
                />
                <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none">
                  <span className="text-xl font-black text-muted/30">ج.م</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-12 pt-0 flex-row gap-4">
            <Button
              variant="ghost"
              onClick={() => setShowOpenShift(false)}
              className="flex-1 h-14 rounded-2xl font-black"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleOpenShift}
              disabled={loading}
              className="flex-[2] bg-[#17110e] text-[#d3a15c] font-black h-14 rounded-2xl shadow-2xl shadow-black/20"
            >
              تأكيد وبدء الوردية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
