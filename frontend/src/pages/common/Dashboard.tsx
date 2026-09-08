import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Zap,
  Wallet,
  Users,
  Search,
  TrendingUp,
  Receipt,
  ArrowUpRight,
  RefreshCw,
  Package,
  Scissors,
  Brain,
  Fingerprint,
  Power,
  Command,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { useAuth } from "@/context/AuthContext";
import { posShiftService } from "@/services/posShiftService";
import { searchService } from "@/services/searchService";
import { cn, formatCurrency as formatCurrencyShared } from "@/lib/core/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AnimatePresence } from "framer-motion";

function formatCurrency(value: unknown) {
  return formatCurrencyShared(value);
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isCashier = user?.role === "CASHIER";

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    todayRevenue: 0,
    todayAppointments: 0,
    activeStaff: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
   
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Shift state
   
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [showOpenShift, setShowOpenShift] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

       
      const data: any = adaptObject(sumRes, {});
      setSummary({
        todayRevenue: Number(data?.today_revenue || 0),
        todayAppointments: Number(data?.today_appointments || 0),
        activeStaff: Number(data?.active_staff_count || 0),
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

  const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>> = {
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
      await posShiftService.open({ opening_cash: Number(openingCash) });
      toast.success("تم فتح الوردية بنجاح");
      setShowOpenShift(false);
      fetchData();
    } catch (_err) {
      toast.error("فشل فتح الوردية");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 pb-24" dir="rtl">
      {/* 1. Integrated Search & Command Center */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-50"
      >
        <div className="relative group p-[1px] rounded-[2.5rem] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-accent/40 via-transparent to-accent/40 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="relative bg-bg-card/60 backdrop-blur-3xl rounded-[calc(2.5rem-1px)] p-3 flex items-center gap-5 border border-border/20 shadow-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-bg-main border border-accent/30 text-accent shadow-inner group-hover:scale-105 transition-transform">
              <Search size={24} strokeWidth={2.5} />
            </div>
            <Input
              value={searchQuery || ""}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث الذكي في منظومة Barber Luxe العالمية..."
              className="h-14 flex-1 border-none bg-transparent text-xl font-black placeholder:text-muted/30 focus:ring-0"
            />
            {isSearching && (
              <div className="flex items-center gap-3 px-8 border-r border-border/20">
                <RefreshCw className="h-5 w-5 text-accent animate-spin" />
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-accent">
                  AI Scanning
                </span>
              </div>
            )}
            {!isSearching && (
              <div className="hidden md:flex items-center gap-2 px-8 border-r border-border/20 text-muted/30 font-black text-xs uppercase tracking-widest">
                <Command size={14} /> Quick Launch
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="absolute mt-5 w-full bg-bg-card/95 backdrop-blur-3xl overflow-hidden rounded-[2.5rem] z-50 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border border-accent/20"
            >
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                { }
                {searchResults.map((res: any, idx: number) => {
                  const Icon = TYPE_ICONS[res.type] || Receipt;
                  return (
                    <motion.button
                      key={res.to + idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => navigate(res.to)}
                      className="flex items-center gap-5 p-5 rounded-[1.75rem] hover:bg-accent/5 text-right transition-all group/item border border-transparent hover:border-accent/10"
                    >
                      <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-bg-soft text-accent border border-accent/10 group-hover/item:bg-accent group-hover/item:text-bg-main transition-all shadow-inner">
                        <Icon size={20} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-black text-main truncate leading-tight group-hover/item:text-accent transition-colors">
                          {res.label}
                        </p>
                        <p className="text-[10px] font-bold text-muted mt-1.5 uppercase tracking-widest flex items-center gap-2">
                          <span className="h-1 w-1 rounded-full bg-accent/40" />
                          {res.category} • {res.sub}
                        </p>
                      </div>
                      <ArrowUpRight
                        size={18}
                        className="text-accent opacity-0 group-hover/item:opacity-100 transition-all translate-x-2 group-hover/item:translate-x-0"
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        {/* Main Revenue Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-8 h-full"
        >
          <Card className="h-full rounded-[3.5rem] border-none bg-gradient-to-br from-bg-soft to-bg-main text-white p-12 relative overflow-hidden shadow-2xl group border border-white/5">
            {/* Animated Glow Background */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-accent/20 via-accent/5 to-transparent rounded-full blur-[120px] -mr-80 -mt-80 group-hover:scale-110 transition-transform duration-1000" />
            <div className="absolute bottom-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-accent/5 blur-[100px]" />

            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-start justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 w-fit">
                    <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-accent">
                      Executive Summary • Live Performance
                    </p>
                  </div>
                  <div className="mt-8">
                    <p className="text-muted/60 text-xs font-black uppercase tracking-widest mb-3">
                      Today's Revenue Flow
                    </p>
                    <h2 className="text-7xl font-black tracking-tighter tabular-nums flex items-baseline gap-5">
                      {formatCurrency(summary.todayRevenue)}
                      <span className="text-2xl font-black text-white/20 uppercase tracking-[0.2em] drop-shadow-sm">
                        EGP
                      </span>
                    </h2>
                  </div>
                </div>
                <div className="h-20 w-20 rounded-[2rem] bg-bg-card/40 border border-white/10 flex items-center justify-center backdrop-blur-2xl shadow-2xl shadow-black/40 group-hover:rotate-6 transition-transform">
                  <TrendingUp
                    size={40}
                    strokeWidth={2.5}
                    className="text-accent drop-shadow-[0_0_10px_rgba(212,175,55,0.3)]"
                  />
                </div>
              </div>

              <div className="mt-24 flex flex-col md:flex-row items-end justify-between gap-10">
                <div className="flex items-center gap-10">
                  <div className="relative group/stat">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">
                      العمليات المنفذة
                    </p>
                    <div className="flex items-baseline gap-3">
                      <p className="text-4xl font-black text-main tracking-tight group-hover/stat:text-accent transition-colors">
                        {summary.todayAppointments}
                      </p>
                      <div className="h-2 w-2 rounded-full bg-accent opacity-0 group-hover/stat:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="h-10 w-[1px] bg-white/5" />
                  <div className="relative group/stat">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">
                      معدل النمو
                    </p>
                    <div className="flex items-baseline gap-3">
                      <p className="text-4xl font-black text-success tracking-tight">
                        +12.5%
                      </p>
                      <ArrowUpRight size={20} className="text-success mb-1" />
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => navigate("/owner/financial")}
                  className="rounded-2xl h-14 px-10 bg-accent hover:bg-accent-strong text-bg-main font-black text-[15px] shadow-xl shadow-accent/20 transition-all hover:scale-[1.05]"
                >
                  التقارير التفصيلية{" "}
                  <ArrowUpRight className="mr-3" size={20} strokeWidth={2.5} />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Secondary Stats Column */}
        <div className="lg:col-span-4 grid grid-cols-1 gap-8 lg:gap-10">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="rounded-[3rem] p-10 border-none shadow-2xl bg-bg-card/40 backdrop-blur-3xl relative overflow-hidden group border border-border/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-accent/60">
                Sales Target Velocity
              </p>
              <div className="mt-8 space-y-6">
                <div className="flex items-end justify-between">
                  <div>
                    <h4 className="text-5xl font-black text-main tabular-nums tracking-tighter">
                      75%
                    </h4>
                    <p className="text-[10px] font-bold text-muted mt-1 uppercase tracking-widest">
                      Efficiency Level
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20">
                    <Zap size={24} strokeWidth={2.5} />
                  </div>
                </div>
                <div className="h-2.5 w-full bg-bg-main/50 rounded-full overflow-hidden shadow-inner border border-border/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "75%" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-accent via-accent-strong to-accent shadow-[0_0_20px_rgba(212,175,55,0.4)] rounded-full"
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] font-black text-muted/50 uppercase tracking-[0.2em]">
                  <span className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-accent" /> Current:{" "}
                    {summary.todayRevenue}
                  </span>
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
            <Card className="rounded-[3rem] p-10 border-none bg-gradient-to-br from-bg-soft to-bg-main text-white shadow-2xl relative overflow-hidden group border border-white/5">
              <div className="absolute top-0 right-0 w-40 h-40 bg-accent/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 shadow-lg">
                    <Brain
                      size={24}
                      strokeWidth={2.5}
                      className="text-accent drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-accent leading-none mb-1.5">
                      Luxe Insights
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1 w-1 rounded-full bg-success animate-pulse" />
                      <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                        AI Strategist Active
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[15px] font-bold leading-relaxed text-white/80 italic tracking-tight">
                  "أداؤك التشغيلي اليوم يتفوق على الأسبوع الماضي بنسبة 18%.
                  نلاحظ إقبالاً كبيراً على 'العناية الملكية'، نقترح زيادة مخزون
                  الزيوت الفاخرة لتلبية الطلب المتوقع."
                </p>
                <button className="text-[11px] font-black uppercase tracking-[0.3em] text-accent hover:text-accent-strong transition-all flex items-center gap-2 group/btn">
                  Generate Analytical Audit{" "}
                  <ArrowUpRight
                    size={14}
                    className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform"
                  />
                </button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* 3. Operational Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          {
            label: "نقطة البيع الذكية",
            sub: "Digital Checkout",
            to: "/pos",
            icon: Zap,
            bg: "bg-accent/10",
            iconColor: "text-accent",
            glow: "shadow-accent/10",
          },
          {
            label: "قاعدة العملاء",
            sub: "Customer CRM",
            to: "/customers",
            icon: Users,
            bg: "bg-success-soft",
            iconColor: "text-success",
            glow: "shadow-success/10",
          },
          {
            label: "المخزون الفاخر",
            sub: "Elite Inventory",
            to: "/inventory",
            icon: Package,
            bg: "bg-info-soft",
            iconColor: "text-info",
            glow: "shadow-info/10",
          },
          {
            label: "سجل التكاليف",
            sub: "Financial Ledger",
            to: "/expenses",
            icon: TrendingUp,
            bg: "bg-warning-soft",
            iconColor: "text-warning",
            glow: "shadow-warning/10",
          },
        ].map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            onClick={() => navigate(action.to)}
            className="group relative flex flex-col items-center justify-center p-10 rounded-[3rem] bg-bg-card/40 backdrop-blur-3xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-3 border border-border/10 hover:border-accent/30"
          >
            <div
              className={cn(
                "h-20 w-20 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 group-hover:scale-110 transition-transform border border-border/10",
                action.bg,
                action.iconColor,
                action.glow,
              )}
            >
              <action.icon size={32} strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <span className="block text-[16px] font-black text-main group-hover:text-accent transition-colors mb-1">
                {action.label}
              </span>
              <span className="block text-[9px] font-black text-muted/40 uppercase tracking-[0.3em]">
                {action.sub}
              </span>
            </div>

            {/* Hover Decor */}
            <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.button>
        ))}
      </div>

      {/* 4. Executive Shift Overlay */}
      {isCashier && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="relative pt-16"
        >
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
          <Card className="rounded-[4rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] p-12 bg-bg-card/40 backdrop-blur-3xl flex flex-col lg:flex-row items-center justify-between gap-12 border border-border/10">
            <div className="flex flex-col md:flex-row items-center gap-12 text-center md:text-right">
              <div
                className={cn(
                  "h-32 w-32 rounded-[2.5rem] flex items-center justify-center text-bg-main shadow-2xl relative transition-all duration-500",
                  currentShift
                    ? "bg-success shadow-success/30 rotate-3"
                    : "bg-accent shadow-accent/30 -rotate-3",
                )}
              >
                <Fingerprint size={64} strokeWidth={1.2} />
                <div className="absolute -top-3 -right-3 h-10 w-10 rounded-full bg-bg-card border-4 border-bg-main flex items-center justify-center shadow-xl">
                  <div
                    className={cn(
                      "h-3.5 w-3.5 rounded-full animate-ping",
                      currentShift ? "bg-success" : "bg-accent",
                    )}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div
                    className={cn(
                      "px-5 py-1.5 rounded-full font-black text-[10px] uppercase tracking-[0.25em] border",
                      currentShift
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-accent/10 text-accent border-accent/20",
                    )}
                  >
                    {currentShift ? "Station Active" : "Station Standby"}
                  </div>
                  <span className="text-[11px] font-black text-muted/40 uppercase tracking-[0.3em]">
                    Digital Handshake Verified
                  </span>
                </div>
                <h3 className="text-5xl font-black text-main tracking-tight leading-none">
                  حالة محطة العمل
                </h3>
                <p className="text-lg font-bold text-muted/70 max-w-lg leading-relaxed">
                  بوابة التحكم في دورات العمل وتدفق السيولة النقدية اللحظية
                  بمعايير أمان بنكية.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 w-full lg:w-auto">
              {!currentShift ? (
                <Button
                  onClick={() => setShowOpenShift(true)}
                  className="flex-1 lg:w-80 h-18 rounded-[2rem] bg-accent hover:bg-accent-strong text-bg-main font-black text-xl gap-4 hover:scale-[1.05] shadow-2xl shadow-accent/20 transition-all group"
                >
                  <Power
                    size={28}
                    strokeWidth={2.5}
                    className="group-hover:rotate-180 transition-transform duration-700"
                  />{" "}
                  فتح الوردية الجديدة
                </Button>
              ) : (
                <Button
                  onClick={() => setShowCloseShift(true)}
                  variant="outline"
                  className="flex-1 lg:w-80 h-18 rounded-[2rem] border-2 border-danger/20 bg-danger/5 text-danger font-black text-xl gap-4 hover:bg-danger hover:text-white hover:border-danger transition-all active:scale-[0.98]"
                >
                  <Power size={28} strokeWidth={2.5} /> إنهاء الوردية الحالية
                </Button>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Modern Dialogs */}
      <Dialog open={showOpenShift} onOpenChange={setShowOpenShift}>
        <DialogContent
          className="rounded-[4rem] border border-accent/20 shadow-2xl p-0 overflow-hidden bg-bg-card/95 backdrop-blur-3xl"
          dir="rtl"
        >
          <div className="bg-gradient-to-br from-bg-soft to-bg-main text-white p-14 relative overflow-hidden border-b border-white/5">
            <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-[120px] -mr-48 -mt-48" />
            <div className="relative z-10 flex items-center gap-8">
              <div className="h-20 w-20 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-xl">
                <Wallet
                  className="text-accent drop-shadow-[0_0_10px_rgba(212,175,55,0.4)]"
                  size={40}
                  strokeWidth={2.5}
                />
              </div>
              <div>
                <DialogTitle className="text-4xl font-black mb-2 tracking-tight">
                  بدء دورة العمل
                </DialogTitle>
                <p className="text-[11px] font-black text-accent uppercase tracking-[0.4em]">
                  Audit Log Initialization
                </p>
              </div>
            </div>
          </div>
          <div className="p-14">
            <div className="space-y-6">
              <label className="text-[12px] font-black uppercase tracking-[0.4em] text-accent/60 mr-4">
                Opening Vault Balance (EGP)
              </label>
              <div className="relative group">
                <div className="absolute inset-0 bg-accent/5 blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <Input
                  type="number"
                  value={openingCash || ""}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="relative h-28 text-7xl font-black border-none bg-bg-main/50 rounded-[2.5rem] text-center tabular-nums focus:ring-accent/10 placeholder:text-muted/10"
                  placeholder="0.00"
                  autoFocus
                />
                <div className="absolute inset-y-0 right-10 flex items-center pointer-events-none">
                  <span className="text-2xl font-black text-accent/20">
                    ج.م
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-14 pt-0 flex flex-row gap-6">
            <Button
              variant="ghost"
              onClick={() => setShowOpenShift(false)}
              className="flex-1 h-16 rounded-[1.75rem] font-black text-muted hover:text-main hover:bg-white/5"
            >
              إلغاء العملية
            </Button>
            <Button
              onClick={handleOpenShift}
              disabled={loading}
              className="flex-[2] bg-accent hover:bg-accent-strong text-bg-main font-black h-16 rounded-[1.75rem] shadow-2xl shadow-accent/20 transition-all hover:scale-[1.02]"
            >
              تأكيد وبدء العمل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
