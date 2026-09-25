import {
  Activity,
  CalendarDays,
  Clock,
  CreditCard,
  Edit3,
  Globe,
  Hash,
  History,
  Phone,
  Scissors,
  Star,
  UserPlus,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatTime12h, cn, getInitials } from "@/lib/core/utils";
import {
  customerId,
  customerName,
  getTierLabel,
  getTierVariant,
} from "@/pages/cashier/customers/useCustomers";
import { Badge } from "@/components/ui/badge";

function AppointmentStatusBadge({ status }: any) {
  const config = {
    done: { label: "مدفوع", variant: "success" },
    completed: { label: "مكتمل", variant: "success" },
    cancelled: { label: "ملغي", variant: "danger" },
    auto_cancelled: { label: "إلغاء تلقائي", variant: "danger" },
    in_progress: { label: "جاري", variant: ("accent" as any) },
    waiting: { label: "بانتظار", variant: "info" },
    confirmed: { label: "مؤكد", variant: "info" },
    pending: { label: "قيد المراجعة", variant: "outline" },
  };
  const { label, variant } = config[status] || {
    label: status,
    variant: "outline",
  };
  return (
    <Badge variant={variant} className="text-[7px] h-3.5 px-1">
      {label}
    </Badge>
  );
}

export function CustomerDetailsDialog({
  isOpen,
  onClose,
  customer,
  loading,
  appointments,
  loadingAppointments,
  invoices,
  loadingInvoices,
  activeDetailsTab,
  onTabChange,
  expandedAppointment,
  onToggleExpand,
  insights,
  onEdit,
}: any) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl rounded-[2.5rem] border-0 bg-card p-0 shadow-premium overflow-hidden"
      >
        <DialogHeader className="p-8 pb-6 bg-soft relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full -mr-24 -mt-24 blur-3xl" />
          <DialogTitle className="text-2xl font-black text-main flex items-center gap-3 relative z-10">
            <div className="h-10 w-10 rounded-xl bg-accent text-white flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            الملف الاستراتيجي للعميل
          </DialogTitle>
          <DialogDescription className="text-muted font-medium mt-1">
            مراجعة بيانات العميل وسجل التعاملات السابقة والتحليلات.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 pt-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Activity className="h-8 w-8 animate-pulse text-accent" />
                <p className="text-xs font-bold text-muted">
                  جاري تحميل البيانات...
                </p>
              </div>
            </div>
          ) : customer ? (
            <>
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-soft p-5 border border-border/40">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent text-2xl font-black text-white shadow-lg shadow-accent/20">
                    {getInitials(customerName(customer))}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-xl font-black text-main truncate">
                      {customerName(customer)}
                    </h3>
                    <div
                      className="flex items-center gap-2 text-accent font-black text-sm"
                      dir="ltr"
                    >
                      <Phone size={14} /> {customer.phone || "---"}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={getTierVariant(customer)}
                        className="text-[10px]"
                      >
                        {getTierLabel(customer)}
                      </Badge>
                      <span className="text-[10px] font-bold text-muted flex items-center gap-1">
                        <Hash size={10} /> #{customerId(customer)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col text-right shrink-0">
                  <span className="text-[10px] font-bold text-muted">
                    آخر زيارة
                  </span>
                  <span className="text-xs font-black text-main flex items-center gap-1.5 justify-end">
                    <Clock size={12} className="text-accent" />
                    {customer.last_visit
                      ? new Date(customer.last_visit).toLocaleDateString(
                          "ar-EG",
                        )
                      : "لا توجد زيارات سابقة"}
                  </span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatBox
                  icon={<History size={12} className="text-accent" />}
                  label="الزيارات"
                  value={customer.visits_count || 0}
                />
                <StatBox
                  icon={<CreditCard size={12} className="text-emerald-500" />}
                  label="الإنفاق"
                  value={formatCurrency(customer.lifetime_spend || 0)}
                  valueClass="text-emerald-600"
                />
                <StatBox
                  icon={<Star size={12} className="text-amber-500" />}
                  label="النقاط"
                  value={Number(customer.loyalty_points || 0).toFixed(0)}
                  valueClass="text-amber-600"
                />
                <StatBox
                  icon={<CalendarDays size={12} className="text-sky-500" />}
                  label="تاريخ الانضمام"
                  value={
                    customer.created_at
                      ? new Date(customer.created_at).toLocaleDateString(
                          "ar-EG",
                        )
                      : "---"
                  }
                />
              </div>

              {/* Notes */}
              {customer.notes && (
                <div className="rounded-xl border border-border/60 bg-white p-4 space-y-1.5">
                  <div className="text-muted font-black text-[9px] uppercase">
                    ملاحظات
                  </div>
                  <p className="text-sm font-bold text-main">
                    {customer.notes}
                  </p>
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-border/60">
                {[
                  {
                    id: "appointments",
                    label: "المواعيد",
                    count: appointments.length,
                  },
                  { id: "invoices", label: "الفواتير", count: invoices.length },
                  { id: "insights", label: "تحليلات العميل" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      "flex-1 pb-3 text-xs font-black text-center border-b-2 transition-all relative",
                      activeDetailsTab === tab.id
                        ? "border-accent text-accent"
                        : "border-transparent text-muted hover:text-main",
                    )}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      {tab.label}
                      {tab.count !== undefined && (
                        <span className="rounded-full bg-soft px-1.5 py-0.5 text-[9px] font-bold text-muted">
                          {tab.count}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Appointments Tab */}
              {activeDetailsTab === "appointments" && (
                <AppointmentsTab
                  appointments={appointments}
                  loading={loadingAppointments}
                  expandedId={expandedAppointment}
                  onToggle={onToggleExpand}
                />
              )}

              {/* Invoices Tab */}
              {activeDetailsTab === "invoices" && (
                <InvoicesTab invoices={invoices} loading={loadingInvoices} />
              )}

              {/* Insights Tab */}
              {activeDetailsTab === "insights" && insights && (
                <InsightsTab insights={insights} customer={customer} />
              )}
            </>
          ) : null}
        </div>

        <DialogFooter className="p-8 border-t border-border bg-soft/20 gap-3">
          {customer?.phone && (
            <a
              href={`https://wa.me/${String(customer.phone).replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="h-12 rounded-xl px-6 font-black uppercase text-xs tracking-widest inline-flex items-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <Globe size={14} /> واتساب
            </a>
          )}
          <Button
            variant="outline"
            className="h-12 rounded-xl px-6 font-black uppercase text-xs tracking-widest"
            onClick={() => customer && onEdit(customer)}
          >
            <Edit3 size={14} className="ml-2" /> تعديل
          </Button>
          <Button
            variant="outline"
            className="h-12 rounded-xl px-6 font-black uppercase text-xs tracking-widest"
            onClick={() => onClose(false)}
          >
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ icon, label, value, valueClass = "text-main" }: any) {
  return (
    <div className="rounded-xl border border-border/60 bg-white p-4 space-y-1.5">
      <div className="flex items-center gap-1.5 text-muted font-black text-[9px] uppercase">
        {icon} {label}
      </div>
      <div className={`text-lg font-black ${valueClass}`}>{value}</div>
    </div>
  );
}

function AppointmentsTab({ appointments, loading, expandedId, onToggle }: any) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Activity className="h-6 w-6 animate-pulse text-accent" />
      </div>
    );
  }
  if (appointments.length === 0) {
    return (
      <div className="text-center py-8 text-muted/50">
        <History size={24} className="mx-auto mb-2 text-muted/30" />
        <p className="text-[11px] font-bold">لا توجد مواعيد سابقة</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
      <div className="space-y-2">
        {appointments.map((apt) => {
          const isExpanded = expandedId === apt.id;
          const services = apt.services || apt.appointment_services || [];
          return (
            <div
              key={apt.id}
              className="rounded-xl border border-border/30 overflow-hidden transition-all hover:border-accent/20"
            >
               <div
                 role="button"
                 tabIndex={0}
                 className="flex items-center justify-between p-3 cursor-pointer bg-soft/40 hover:bg-soft/60 transition-colors"
                 onClick={() => onToggle(isExpanded ? null : apt.id)}
                 onKeyDown={(event) => {
                   if (event.key === "Enter" || event.key === " ") {
                     event.preventDefault();
                     onToggle(isExpanded ? null : apt.id);
                   }
                 }}
               >

                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-xl bg-accent/10 flex items-center justify-center">
                    <CalendarDays size={15} className="text-accent" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-black text-main">
                        {apt.appointment_date}
                      </p>
                      <AppointmentStatusBadge status={apt.status} />
                    </div>
                    <p className="text-[9px] font-bold text-muted flex items-center gap-1.5 mt-0.5">
                      <Clock size={9} />
                      {formatTime12h(
                        String(apt.appointment_time || "").slice(0, 5),
                      )}
                      <span className="text-border mx-0.5">|</span>
                      {apt.barber_name || "غير محدد"}
                      {services.length > 0 && (
                        <>
                          <span className="text-border mx-0.5">|</span>
                          <Scissors size={9} className="text-accent" />
                          {services.length} خدمة
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {apt.total_estimated_price > 0 && (
                    <span className="text-[10px] font-black text-emerald-600 tabular-nums">
                      {formatCurrency(apt.total_estimated_price)}
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    className={cn(
                      "text-muted transition-transform duration-200",
                      isExpanded && "rotate-180",
                    )}
                  />
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 bg-white border-t border-border/20 space-y-2.5">
                  {services.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[8px] font-black text-muted uppercase tracking-widest">
                        الخدمات
                      </p>
                      {services.map((svc, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex items-center justify-between p-2 rounded-lg bg-soft/50 border border-border/20"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-md bg-accent/10 flex items-center justify-center">
                              <Scissors size={10} className="text-accent" />
                            </div>
                            <span className="text-[10px] font-bold text-main">
                              {svc.service_name_snapshot ||
                                svc.service_name ||
                                svc.name ||
                                "خدمة"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {svc.duration_snapshot_minutes && (
                              <span className="text-[8px] font-bold text-muted">
                                {svc.duration_snapshot_minutes} دقيقة
                              </span>
                            )}
                            <span className="text-[10px] font-black text-emerald-600 tabular-nums">
                              {formatCurrency(
                                svc.price_snapshot ||
                                  svc.unit_price ||
                                  svc.price ||
                                  0,
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {apt.notes && (
                      <div className="col-span-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <p className="text-[8px] font-black text-amber-700 uppercase mb-0.5">
                          ملاحظات
                        </p>
                        <p className="text-[10px] font-bold text-amber-900/80">
                          {apt.notes}
                        </p>
                      </div>
                    )}
                    <div className="p-2 rounded-lg bg-soft/30 border border-border/20">
                      <p className="text-[8px] font-black text-muted uppercase">
                        المدة
                      </p>
                      <p className="text-[10px] font-black text-main">
                        {apt.total_estimated_duration_minutes || "---"} دقيقة
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-soft/30 border border-border/20">
                      <p className="text-[8px] font-black text-muted uppercase">
                        المصدر
                      </p>
                      <p className="text-[10px] font-black text-main">
                        {apt.booking_source === "online" ? "أونلاين" : "المحل"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InvoicesTab({ invoices, loading }: any) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Activity className="h-6 w-6 animate-pulse text-accent" />
      </div>
    );
  }
  if (invoices.length === 0) {
    return (
      <div className="text-center py-8 text-muted/50">
        <CreditCard size={24} className="mx-auto mb-2 text-muted/30" />
        <p className="text-[11px] font-bold">لا توجد فواتير صادرة</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
      <div className="space-y-2">
        {invoices.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between p-3 rounded-xl bg-soft/40 border border-border/30 hover:border-accent/15 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CreditCard size={14} className="text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-main">
                  {inv.invoice_no}
                </p>
                <p className="text-[9px] font-bold text-muted truncate">
                  {inv.created_at
                    ? new Date(inv.created_at).toLocaleDateString("ar-EG")
                    : "---"}{" "}
                  -{" "}
                  {inv.payment_method === "cash"
                    ? "نقدي"
                    : inv.payment_method === "card"
                      ? "بطاقة"
                      : inv.payment_method}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-emerald-600">
                {formatCurrency(inv.total_amount)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[9px] font-bold text-accent"
                onClick={() =>
                  window.open(
                    `/api/v1/invoices/${inv.id}/pdf?inline=true`,
                    "_blank",
                  )
                }
              >
                عرض PDF
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsTab({ insights, customer }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/60 bg-white p-3.5 space-y-1">
          <span className="text-[9px] font-black text-muted uppercase">
            الخبير المفضل
          </span>
          <div className="font-black text-main text-sm">
            {insights.topBarber}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-white p-3.5 space-y-1">
          <span className="text-[9px] font-black text-muted uppercase">
            معدل الإلغاء
          </span>
          <div className="font-black text-rose-600 text-sm">
            {insights.cancellationRate}%
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-white p-3.5 space-y-1">
          <span className="text-[9px] font-black text-muted uppercase">
            متوسط قيمة الفاتورة
          </span>
          <div className="font-black text-emerald-600 text-sm">
            {formatCurrency(insights.avgSpend)}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-white p-3.5 space-y-1">
          <span className="text-[9px] font-black text-muted uppercase">
            قناة الحجز المفضلة
          </span>
          <div className="font-black text-main text-sm">
            {insights.topSource}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4 space-y-2">
        <div className="flex items-center gap-1.5 text-amber-800 text-xs font-black">
          <Sparkles size={14} className="text-amber-500" />
          رؤية ذكية عن العميل
        </div>
        <p className="text-xs font-bold text-amber-900/80 leading-relaxed">
          {customer.visits_count > 10
            ? "هذا العميل من فئة VIP ويمثل ركيزة أساسية للصالون. يُنصح بتقديم خدمات إضافية مجانية أو خصومات حصرية لتعزيز الولاء."
            : customer.visits_count >= 2
              ? "عميل متكرر وواعد. احرص على تذكيره ببرنامج النقاط وتقديم خدمات مخصصة تناسب تفضيلاته."
              : "عميل جديد في فترة التجربة والتقييم. الانطباع الأول مهم جداً لضمان عودته مرة أخرى."}
        </p>
      </div>
    </div>
  );
}
