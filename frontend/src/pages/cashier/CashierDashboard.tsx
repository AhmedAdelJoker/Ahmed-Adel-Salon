import { Boxes, RefreshCw, Wallet, Zap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { formatCurrency, cn } from "@/lib/core/utils";
import {
  PageHeader,
  PremiumCard,
  ContentPanel,
} from "@/components/shared/PremiumUI";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useCashierDashboard,
  DashboardStats,
  TodayInvoicesList,
  ViewInvoiceModal,
  AdjustmentRequestModal,
  quickActions,
} from "@/features/cashier-dashboard";

export default function CashierDashboard() {
  const {
    user,
    summary,
    filteredTodayInvoices,
    loading,
    refreshing,
    error,
    searchTerm,
    setSearchTerm,
    lastRefresh,
    viewInvoice,
    setViewInvoice,
    adjInvoice,
    setAdjInvoice,
    adjForm,
    setAdjForm,
    submittingAdj,
    loadData,
    handleViewInvoice,
    handlePrintInvoice,
    handleRequestAdjustment,
    submitAdjustment,
  } = useCashierDashboard();

  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Zap className="h-10 w-10 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
            جاري تحضير مصفوفة الكاشير...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page space-y-8 pb-12">
      <PageHeader className={undefined}
        title={`أهلاً بك، ${user?.full_name || "زميلنا"}`}
        subtitle={`آخر تحديث: ${lastRefresh.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`}
        badge="لوحة الكاشير"
        icon={Zap}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="h-9 w-9 rounded-xl"
              title="تحديث البيانات"
            >
              <RefreshCw
                size={16}
                className={cn(refreshing && "animate-spin")}
              />
            </Button>
            <Badge
              variant={summary?.has_open_shift ? "success" : "warning"}
              className="h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider"
            >
              <div
                className={cn(
                  "h-1.5 w-1.5 rounded-full ml-2",
                  summary?.has_open_shift
                    ? "bg-white animate-pulse"
                    : "bg-white",
                )}
              />
              {summary?.has_open_shift ? "الوردية نشطة" : "الوردية مغلقة"}
            </Badge>
            {!summary?.has_open_shift && (
              <Button
                onClick={() => navigate("/pos")}
                className="h-10 rounded-xl px-6 premium-button"
              >
                بدء وردية العمل
              </Button>
            )}
          </div>
        }
      />

      <DashboardStats summary={summary} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {quickActions.map((action, idx) => (
              <Link key={idx} to={action.link}>
                <PremiumCard
                  delay={idx * 0.05}
                  hoverable={false}
                  className="flex flex-col items-center gap-3 p-4 text-center group h-full"
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110",
                      action.variant === "primary"
                        ? "bg-primary-soft text-primary"
                        : action.variant === "success"
                          ? "bg-success-soft text-success"
                          : action.variant === "info"
                            ? "bg-info-soft text-info"
                            : action.variant === "warning"
                              ? "bg-warning-soft text-warning"
                              : "bg-danger-soft text-danger",
                    )}
                  >
                    <action.icon size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-main">
                      {action.title}
                    </p>
                    <p className="text-[9px] font-bold text-muted uppercase">
                      {action.desc}
                    </p>
                  </div>
                </PremiumCard>
              </Link>
            ))}
          </div>

          <TodayInvoicesList
            invoices={filteredTodayInvoices}
            searchTerm={searchTerm}
            onSearchChange={(v) => setSearchTerm(v)}
            onArchive={() => navigate("/invoices")}
            onView={handleViewInvoice}
            onPrint={handlePrintInvoice}
            onRequestAdjustment={handleRequestAdjustment}
          />
        </div>

        <div className="space-y-6">
          <PremiumCard
            className="bg-gradient-to-br from-primary to-primary-strong text-white border-none shadow-xl relative overflow-hidden group"
            hoverable={false}
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 bg-white/10 rounded-full blur-2xl transition-all group-hover:scale-150" />
            <div className="absolute -left-8 -bottom-8 h-24 w-24 bg-white/5 rounded-full blur-xl" />
            <div className="relative z-10 space-y-5">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                  <Wallet size={20} />
                </div>
                <Badge
                  variant="outline"
                  className="text-white border-white/30 text-[9px] font-black"
                >
                  تحصيل اليوم
                </Badge>
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                  إجمالي النقدية والشبكة
                </p>
                <h2 className="text-3xl font-black mt-1 tracking-tight">
                  {formatCurrency(summary?.today_sales || 0)}
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-1 border-t border-white/10 pt-4 sm:gap-2">
                <div className="min-w-0 text-center">
                  <p className="truncate text-[9px] font-bold opacity-70">الفواتير</p>
                  <p className="truncate text-sm font-black tabular-nums">
                    {summary?.invoices_count || 0}
                  </p>
                </div>
                <div className="min-w-0 text-center">
                  <p className="truncate text-[9px] font-bold opacity-70">العملاء</p>
                  <p className="truncate text-sm font-black tabular-nums">
                    {summary?.customers_count || 0}
                  </p>
                </div>
                <div className="min-w-0 text-center">
                  <p className="truncate text-[9px] font-bold opacity-70">الوردية</p>
                  <p className="truncate text-sm font-black tabular-nums">
                    #{summary?.current_shift_id || "---"}
                  </p>
                </div>
              </div>
            </div>
          </PremiumCard>

          <ContentPanel title="تنبيهات المخزون" subtitle={undefined} actions={undefined} className={undefined}>
            {summary?.low_stock_count > 0 ? (
              <div className="rounded-xl bg-warning-soft p-4 border border-warning/20">
                <p className="text-[11px] font-bold leading-relaxed text-warning-strong">
                  هناك {summary.low_stock_count} أصناف وصلت للحد الأدنى.
                </p>
                <Link to="/inventory">
                  <Button

                    variant={("link" as any)}
                    className="p-0 h-auto text-[11px] font-black text-warning-strong underline mt-2"
                  >
                    مراجعة النواقص الآن
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-4">
                <Boxes size={32} className="mx-auto text-muted/30 mb-2" />
                <p className="text-[10px] font-black text-muted uppercase tracking-widest">
                  المخزون مستقر
                </p>
              </div>
            )}
          </ContentPanel>
        </div>
      </div>

      <ViewInvoiceModal
        viewInvoice={viewInvoice}
        setViewInvoice={setViewInvoice}
        onPrint={handlePrintInvoice}
      />

      <AdjustmentRequestModal
        adjInvoice={adjInvoice}
        setAdjInvoice={setAdjInvoice}
        adjForm={adjForm}
        setAdjForm={setAdjForm}
        submittingAdj={submittingAdj}
        onSubmit={submitAdjustment}
      />
    </div>
  );
}
