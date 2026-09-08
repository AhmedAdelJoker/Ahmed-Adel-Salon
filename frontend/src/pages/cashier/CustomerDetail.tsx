import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Phone,
  Mail,
  Calendar,
  Star,
  Trophy,
  TrendingUp,
  Clock,
  CreditCard,
  Edit3,
  Trash2,
  Plus,
  User,
  Award,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Receipt,
  Crown,
  AlertTriangle,
  Save,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";


import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import {
  cn,
  formatCurrency,
  getInitials,
  formatTime12h,
} from "@/lib/core/utils";
import {
  useCustomerDetail,
  useCustomerAppointments,
  useCustomerInvoices,
  useCustomerActivityLogs,
} from "@/hooks/useCustomer";
import api from "@/services/api";
import { PageHeader } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const TIER_CONFIG = {
  gold: {
    label: "ذهبي",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-400",
    icon: Crown,
  },
  silver: {
    label: "فضي",
    color: "text-slate-400",
    bg: "bg-slate-400/10",
    border: "border-slate-400",
    icon: Award,
  },
  bronze: {
    label: "برونزي",
    color: "text-orange-600",
    bg: "bg-orange-600/10",
    border: "border-orange-500",
    icon: Star,
  },
};

function getTierInfo(tier) {
  const key = String(tier || "").toLowerCase();
  if (key.includes("gold") || key.includes("ذهبي")) return TIER_CONFIG.gold;
  if (key.includes("silver") || key.includes("فضي")) return TIER_CONFIG.silver;
  return TIER_CONFIG.bronze;
}

function getStatusConfig(status) {
  const map = {
    PENDING: {
      label: "قيد الانتظار",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      icon: Clock,
    },
    CONFIRMED: {
      label: "مؤكد",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      icon: CheckCircle2,
    },
    IN_PROGRESS: {
      label: "قيد التنفيذ",
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      icon: Loader2,
    },
    COMPLETED: {
      label: "مكتمل",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      icon: CheckCircle2,
    },
    CANCELLED: {
      label: "ملغي",
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      icon: XCircle,
    },
    NO_SHOW: {
      label: "لم يحضر",
      color: "text-rose-700",
      bg: "bg-rose-700/10",
      icon: XCircle,
    },
  };
  return map[status?.toUpperCase()] || map.PENDING;
}

function getInvoiceStatusConfig(status) {
  const map = {
    PAID: {
      label: "مدفوعة",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    PENDING: { label: "معلقة", color: "text-amber-500", bg: "bg-amber-500/10" },
    OVERDUE: { label: "متأخرة", color: "text-rose-500", bg: "bg-rose-500/10" },
    CANCELLED: {
      label: "ملغاة",
      color: "text-slate-400",
      bg: "bg-slate-400/10",
    },
    PARTIAL: { label: "جزئية", color: "text-blue-500", bg: "bg-blue-500/10" },
  };
  return map[status?.toUpperCase()] || map.PENDING;
}

function InlineEmptyState({ icon: Icon, title, description }: any) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      role="status"
    >
      {Icon && (
        <div className="bg-soft p-5 rounded-[2rem] border border-border shadow-inner mb-4">
          {Icon}
        </div>
      )}
      <h3 className="text-sm font-black text-main mb-1">{title}</h3>
      <p className="text-xs font-bold text-muted max-w-xs">{description}</p>
    </div>
  );
}

function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = ["OWNER", "ADMIN"].includes(
    String(user?.role || "").toUpperCase(),
  );
  const customerId = Number(id);

  const [activeTab, setActiveTab] = useState("overview");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
   
  const [editForm, setEditForm] = useState<any>({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    phone2: "",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const {
    data: customer,
    isLoading: customerLoading,
    error: customerError,
  } = useCustomerDetail(customerId);
  const { data: appointments = [], isLoading: appointmentsLoading } =
    useCustomerAppointments(customerId);
  const { data: invoices = [], isLoading: invoicesLoading } =
    useCustomerInvoices(customerId);
  const { data: activityLogs = [], isLoading: activityLoading } =
    useCustomerActivityLogs(customerId);

  const tierInfo = getTierInfo(customer?.current_tier);

  const stats = useMemo(() => {
    if (!customer) return null;
    const totalSpend = Number(customer.lifetime_spend || 0);
    const visits = Number(customer.visits_count || 0);
    const points = Number(customer.loyalty_points || 0);
    const cancellations = Number(customer.cancellation_count || 0);
    const avgSpend = visits > 0 ? totalSpend / visits : 0;
    const noShowRate =
      visits > 0 ? Math.round((cancellations / visits) * 100) : 0;
    const paidInvoices = invoices.filter(
      (i) => i.status?.toUpperCase() === "PAID",
    );
    const totalPaid = paidInvoices.reduce(
      (sum, i) => sum + Number(i.total_amount || i.amount || 0),
      0,
    );
    const upcomingAppts = appointments.filter((a) =>
      ["PENDING", "CONFIRMED"].includes(a.status?.toUpperCase()),
    );
    return {
      totalSpend,
      visits,
      points,
      avgSpend,
      noShowRate,
      totalPaid,
      upcomingCount: upcomingAppts.length,
    };
  }, [customer, appointments, invoices]);

  function openEdit() {
    setEditForm({
      first_name: customer?.first_name || "",
      last_name: customer?.last_name || "",
      phone: customer?.phone || "",
      email: customer?.email || "",
      phone2: customer?.phone2 || customer?.alternate_phone || "",
      notes: customer?.notes || "",
    });
    setIsEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editForm.first_name.trim() || !editForm.phone.trim()) {
      toast.error("الاسم والهاتف مطلوبان");
      return;
    }
    try {
      setIsSaving(true);
      const payload = { ...editForm };
      if (!payload.phone2?.trim()) delete payload.phone2;
      await api.put(`/customers/${customerId}`, payload);
      toast.success("تم تحديث بيانات العميل بنجاح");
      setIsEditOpen(false);
      window.location.reload();
    } catch (err) {
       
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr.response?.data?.detail as string) || "فشل تحديث البيانات");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/customers/${customerId}`);
      toast.success("تم حذف العميل بنجاح");
      navigate("/customers");
    } catch (err) {
      toast.error("فشل حذف العميل");
    }
  }

  if (customerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-20 w-20 rounded-2xl" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  if (customerError || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle size={48} className="text-rose-400" />
          <h3 className="text-lg font-black text-main">العميل غير موجود</h3>
          <Button
            variant="primary"
            onClick={() => navigate("/customers")}
            className="rounded-xl"
          >
            <ArrowRight size={16} className="ml-2" /> العودة للعملاء
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-4 px-3 pt-4 sm:space-y-5 sm:px-4 lg:px-6">
        <PageHeader className={undefined}
          title={`${customer.first_name} ${customer.last_name || ""}`}
          subtitle={`ملف العميل الكامل • رقم #${customer.customer_id}`}
          badge={tierInfo.label}
          icon={tierInfo.icon}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => navigate("/customers")}
                className="h-10 rounded-xl px-3 text-xs"
              >
                <ArrowRight size={14} className="ml-1.5" /> العودة
              </Button>
              <Button
                variant="primary"
                className="h-10 rounded-xl px-3 text-xs"
                onClick={() => setIsBookingOpen(true)}
              >
                <Plus size={14} className="ml-1.5" /> حجز جديد
              </Button>
              {isOwner && (
                <>
                  <Button
                    variant="outline"
                    onClick={openEdit}
                    className="h-10 rounded-xl px-3 text-xs"
                  >
                    <Edit3 size={14} className="ml-1.5" /> تعديل
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setIsDeleteOpen(true)}
                    className="h-10 rounded-xl px-3 text-xs"
                  >
                    <Trash2 size={14} className="ml-1.5" /> حذف
                  </Button>
                </>
              )}
            </div>
          }
        />

        {/* Customer Info Card */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "h-14 w-14 rounded-xl flex items-center justify-center text-lg font-black shrink-0",
                tierInfo.bg,
                tierInfo.color,
              )}
            >
              {getInitials(
                `${customer.first_name} ${customer.last_name || ""}`,
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-main">
                  {customer.first_name} {customer.last_name}
                </h2>
                <Badge
                  className={cn(
                    "text-[9px] px-2 h-5 font-black rounded-lg",
                    tierInfo.color,
                    tierInfo.bg,
                  )}
                >
                  <tierInfo.icon size={10} className="ml-1" /> {tierInfo.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs">
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="flex items-center gap-1 text-muted hover:text-primary"
                  >
                    <Phone size={12} /> <span dir="ltr">{customer.phone}</span>
                  </a>
                )}
                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="flex items-center gap-1 text-muted hover:text-primary"
                  >
                    <Mail size={12} /> <span dir="ltr">{customer.email}</span>
                  </a>
                )}
                {customer.created_at && (
                  <span className="flex items-center gap-1 text-muted">
                    <Calendar size={12} /> منذ{" "}
                    {new Date(customer.created_at).toLocaleDateString("ar-EG", {
                      year: "numeric",
                      month: "short",
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" />
                <div>
                  <p className="text-[8px] font-bold uppercase text-muted sm:text-[10px]">
                    إجمالي الإنفاق
                  </p>
                  <p className="text-base font-black text-main sm:text-lg">
                    {formatCurrency(stats.totalSpend)}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <CalendarClock size={16} className="text-info" />
                <div>
                  <p className="text-[8px] font-bold uppercase text-muted sm:text-[10px]">
                    الزيارات
                  </p>
                  <p className="text-base font-black text-main sm:text-lg">
                    {stats.visits}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-warning" />
                <div>
                  <p className="text-[8px] font-bold uppercase text-muted sm:text-[10px]">
                    نقاط الولاء
                  </p>
                  <p className="text-base font-black text-main sm:text-lg">
                    {stats.points}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-success" />
                <div>
                  <p className="text-[8px] font-bold uppercase text-muted sm:text-[10px]">
                    المدفوع
                  </p>
                  <p className="text-base font-black text-main sm:text-lg">
                    {formatCurrency(stats.totalPaid)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-10 px-1 rounded-xl bg-soft border border-border gap-1 w-full flex-wrap justify-start">
            {[
              { key: "overview", label: "نظرة عامة", icon: User },
              {
                key: "appointments",
                label: "المواعيد",
                icon: CalendarClock,
                count: appointments.length,
              },
              {
                key: "invoices",
                label: "الفواتير",
                icon: Receipt,
                count: invoices.length,
              },
            ].map(({ key, label, icon: Icon, count }: any) => (
              <TabsTrigger
                key={key}
                value={key}
                className="h-8 px-3 rounded-lg text-[10px] font-black gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <Icon size={12} /> {label}
                {count != null && (
                  <span className="bg-primary/10 text-primary text-[8px] font-black px-1.5 py-0.5 rounded-md">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Recent Appointments */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
                  <CalendarClock size={14} className="text-primary" /> آخر
                  المواعيد
                </h3>
                {appointmentsLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-12 rounded-lg" />
                    ))}
                  </div>
                ) : appointments.length === 0 ? (
                  <p className="text-xs font-bold text-muted text-center py-6">
                    لا توجد مواعيد
                  </p>
                ) : (
                  <div className="space-y-2">
                    {appointments.slice(0, 5).map((appt) => {
                      const conf = getStatusConfig(appt.status);
                      return (
                        <div
                          key={appt.id}
                          className={cn(
                            "flex items-center justify-between rounded-lg border p-2.5",
                            conf.bg,
                            conf.border,
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <conf.icon size={12} className={conf.color} />
                            <div>
                              <p className="text-xs font-black text-main">
                                {new Date(
                                  appt.appointment_date,
                                ).toLocaleDateString("ar-EG", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })}
                              </p>
                              <p className="text-[9px] font-bold text-muted">
                                {formatTime12h(
                                  String(
                                    appt.appointment_time ||
                                      appt.appointmentTime ||
                                      "",
                                  ).slice(0, 5),
                                )}{" "}
                                ?{" "}
                                {appt.barber_name || appt.employee_name || "?"}
                              </p>
                            </div>
                          </div>
                          <span
                            className={cn("text-[9px] font-black", conf.color)}
                          >
                            {conf.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Invoices */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
                  <Receipt size={14} className="text-primary" /> آخر الفواتير
                </h3>
                {invoicesLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-12 rounded-lg" />
                    ))}
                  </div>
                ) : invoices.length === 0 ? (
                  <p className="text-xs font-bold text-muted text-center py-6">
                    لا توجد فواتير
                  </p>
                ) : (
                  <div className="space-y-2">
                    {invoices.slice(0, 5).map((inv) => {
                      const conf = getInvoiceStatusConfig(inv.status);
                      return (
                        <div
                          key={inv.id}
                          className={cn(
                            "flex items-center justify-between rounded-lg border p-2.5",
                            conf.bg,
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Receipt size={12} className={conf.color} />
                            <div>
                              <p className="text-xs font-black text-main">
                                {inv.invoice_no || `#${inv.id}`}
                              </p>
                              <p className="text-[9px] font-bold text-muted">
                                {new Date(inv.created_at).toLocaleDateString(
                                  "ar-EG",
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-emerald-600">
                              {formatCurrency(inv.total_amount)}
                            </p>
                            <span
                              className={cn(
                                "text-[8px] font-black",
                                conf.color,
                              )}
                            >
                              {conf.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="appointments" className="mt-4">
            {appointmentsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : appointments.length === 0 ? (
              <InlineEmptyState
                icon={CalendarClock}
                title="لا توجد مواعيد"
                description="لم يتم تسجيل أي مواعيد لهذا العميل"
              />
            ) : (
              <div className="space-y-2">
                {appointments.map((appt) => {
                  const conf = getStatusConfig(appt.status);
                  return (
                    <div
                      key={appt.id}
                      className={cn(
                        "rounded-xl border bg-card p-3 shadow-soft sm:p-4",
                        conf.border,
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-9 w-9 rounded-lg flex items-center justify-center",
                              conf.bg,
                            )}
                          >
                            <conf.icon size={14} className={conf.color} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-main">
                              {new Date(
                                appt.appointment_date,
                              ).toLocaleDateString("ar-EG", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}
                            </p>
                            <p className="text-[9px] font-bold text-muted">
                              {formatTime12h(
                                String(
                                  appt.appointment_time ||
                                    appt.appointmentTime ||
                                    "",
                                ).slice(0, 5),
                              )}{" "}
                              • {appt.barber_name || appt.employee_name || "?"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-black px-2 py-1 rounded-lg",
                            conf.bg,
                            conf.color,
                          )}
                        >
                          {conf.label}
                        </span>
                      </div>
                      {appt.services && appt.services.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {appt.services.map((s, i) => (
                            <span
                              key={i}
                              className="text-[8px] font-bold bg-soft px-1.5 py-0.5 rounded"
                            >
                              {s.service_name_snapshot ||
                                s.service_name ||
                                s.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            {invoicesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <InlineEmptyState
                icon={Receipt}
                title="لا توجد فواتير"
                description="لم يتم إصدار أي فواتير لهذا العميل"
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[500px] text-right">
                  <thead>
                    <tr className="border-b border-border bg-soft/50">
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-muted">
                        الفاتورة
                      </th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-muted">
                        التاريخ
                      </th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-muted">
                        المبلغ
                      </th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-muted">
                        الحالة
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {invoices.map((inv) => {
                      const conf = getInvoiceStatusConfig(inv.status);
                      return (
                        <tr key={inv.id} className="hover:bg-soft/30">
                          <td className="px-3 py-2 text-xs font-black text-main">
                            {inv.invoice_no || `#${inv.id}`}
                          </td>
                          <td className="px-3 py-2 text-xs font-bold text-muted">
                            {new Date(inv.created_at).toLocaleDateString(
                              "ar-EG",
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs font-black text-emerald-600">
                            {formatCurrency(inv.total_amount)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "text-[9px] font-black px-2 py-1 rounded-lg",
                                conf.bg,
                                conf.color,
                              )}
                            >
                              {conf.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-lg rounded-2xl" dir="rtl">
            <DialogHeader className="p-5 pb-3 border-b border-border/40">
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <Edit3 size={16} className="text-primary" /> تعديل بيانات العميل
              </DialogTitle>
            </DialogHeader>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    الاسم الأول *
                  </label>
                  <Input
                    value={editForm.first_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, first_name: e.target.value })
                    }
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    اسم العائلة
                  </label>
                  <Input
                    value={editForm.last_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, last_name: e.target.value })
                    }
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  الهاتف *
                </label>
                <Input
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  className="h-10 rounded-xl"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  هاتف بديل
                </label>
                <Input
                  value={editForm.phone2}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone2: e.target.value })
                  }
                  className="h-10 rounded-xl"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  البريد الإلكتروني
                </label>
                <Input
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  className="h-10 rounded-xl"
                  dir="ltr"
                  type="email"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  ملاحظات
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm({ ...editForm, notes: e.target.value })
                  }
                  className="w-full h-20 rounded-xl border border-border bg-soft p-3 text-sm font-bold resize-none focus:border-primary focus:ring-0"
                />
              </div>
            </div>
            <DialogFooter className="p-5 pt-3 border-t border-border/40 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="h-10 flex-1 rounded-xl text-xs"
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveEdit}
                loading={isSaving}
                className="h-10 flex-1 rounded-xl text-xs"
              >
                <Save size={14} className="ml-1.5" /> حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Booking Modal */}
        <BookingModal
          open={isBookingOpen}
          onOpenChange={setIsBookingOpen}
          customer={customer}
          onSuccess={() => {
            setIsBookingOpen(false);
            window.location.reload();
          }}
        />

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          title="حذف العميل"
          description={`هل أنت متأكد من حذف ${customer.first_name}؟ سيتم حذفه نهائياً من النظام.`}
          onConfirm={handleDelete}
          confirmText="نعم، احذف"
          cancelText="إلغاء"
          variant="danger"
        />
      </div>
    </div>
  );
}

function BookingModal({ open, onOpenChange, customer, onSuccess }: any) {
   
  const [serviceIds, setServiceIds] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState("none");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
   
  const [services, setServices] = useState<any[]>([]);
   
  const [barbers, setBarbers] = useState<any[]>([]);
   
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [conflictMsg, setConflictMsg] = useState("");
  const [isToday, setIsToday] = useState(true);

  useEffect(() => {
    if (!open) {
      setServiceIds([]);
      setEmployeeId("none");
      setDate(new Date().toISOString().split("T")[0]);
      setTime("");
      setNotes("");
      setConflictMsg("");
      setExistingBookings([]);
      return;
    }
    Promise.all([api.get("/services"), api.get("/employees")])
      .then(([s, b]) => {
        setServices(s.data || []);
        setBarbers(b.data || []);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!date || !time) {
      setConflictMsg("");
      return;
    }
    checkConflict();
  }, [date, time, employeeId]);

  useEffect(() => {
    if (!date || !customer?.customer_id) {
      setExistingBookings([]);
      return;
    }
    api
      .get("/appointments", {
        params: {
          customer_id: customer.customer_id,
          date_from: date,
          date_to: date,
        },
      })
      .then((res) => setExistingBookings(res.data || []))
      .catch(() => setExistingBookings([]));
  }, [date, customer?.customer_id]);

  const toggleService = (id) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const totalPrice = serviceIds.reduce((sum, id) => {
    const s = services.find((srv) => srv.id === id);
    return sum + (s ? Number(s.price || s.base_price || 0) : 0);
  }, 0);

  const totalDuration = serviceIds.reduce((sum, id) => {
    const s = services.find((srv) => srv.id === id);
    return sum + (s ? s.duration_minutes || 30 : 0);
  }, 0);

  const checkConflict = async () => {
    const duration = totalDuration || 30;
    try {
      const res = await api.get("/appointments/check-conflict", {
        params: {
          barber_id: employeeId === "none" ? null : employeeId,
          date,
          time,
          duration_minutes: duration,
        },
      });
      setConflictMsg(
        res.data?.has_conflict
          ? res.data?.message || "يوجد تعارض في الموعد"
          : "",
      );
    } catch (err) {
      setConflictMsg("");
    }
  };

  const handleDateChange = (newDate) => {
    setDate(newDate);
    setIsToday(newDate === new Date().toISOString().split("T")[0]);
    setTime("");
  };

  const isTimeInPast = (timeValue: string) => {
    if (!isToday) return false;
    const now = new Date();
    const [h, m] = timeValue.split(":").map(Number);
    const timeDate = new Date();
    timeDate.setHours(h, m, 0);
    return timeDate <= now;
  };

  const handleSubmit = async () => {
    if (serviceIds.length === 0)
      return toast.error("اختر خدمة واحدة على الأقل");
    if (!time) return toast.error("يرجى اختيار الوقت");
    if (isTimeInPast(time)) return toast.error("لا يمكن الحجز في وقت مضى");
    if (conflictMsg) return toast.error(conflictMsg);
    if (existingBookings.length > 0)
      return toast.error(
        "هذا العميل لديه حجز بالفعل في هذا اليوم. يرجى اختيار يوم آخر.",
      );

    try {
      setSubmitting(true);
      await api.post("/appointments/fast-walkin", {
        customer_id: customer?.customer_id,
        service_ids: serviceIds,
        employee_id: employeeId === "none" ? null : employeeId,
        appointment_date: date,
        appointment_time: time,
        notes,
        booking_source: "shop",
      });
      toast.success("تم حجز الموعد بنجاح");
      onSuccess?.();
    } catch (err) {
       
      const apiErr2 = err as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr2?.response?.data?.detail as string) || "فشل الحجز");
    } finally {
      setSubmitting(false);
    }
  };

  const generateTimeSlots = () => {
     
    const slots: any[] = [];
    for (let hour = 9; hour < 22; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const timeValue = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
        if (isTimeInPast(timeValue)) continue;
        slots.push(timeValue);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto"
        dir="rtl"
      >
        <DialogHeader className="p-5 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-black flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarClock size={14} className="text-primary" />
            </div>
            حجز جديد للعميل
          </DialogTitle>
          <DialogDescription className="text-[10px] text-muted">
            {customer?.first_name} {customer?.last_name}
          </DialogDescription>
        </DialogHeader>
        <div className="p-5 space-y-4">
          {/* Services */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              اختر الخدمات *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
              {services.map((srv) => (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => toggleService(srv.id)}
                  className={cn(
                    "p-2.5 rounded-xl border-2 cursor-pointer transition-all text-xs text-right",
                    serviceIds.includes(srv.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30",
                  )}
                >
                  <div className="font-black text-main truncate">
                    {srv.name}
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-primary font-black">
                      {formatCurrency(srv.price || srv.base_price || 0)}
                    </span>
                    <span className="text-muted">
                      {srv.duration_minutes || 30} د
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                التاريخ *
              </label>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full h-10 rounded-xl bg-soft border border-border px-3 text-sm font-bold focus:border-primary focus:ring-0"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                الوقت *
              </label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-10 rounded-xl bg-soft border border-border px-3 text-sm font-bold focus:border-primary focus:ring-0"
              >
                <option value="">اختر الوقت</option>
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Barber */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              الخبير
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full h-10 rounded-xl bg-soft border border-border px-3 text-sm font-bold focus:border-primary focus:ring-0"
            >
              <option value="none">توزيع تلقائي</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.display_name || b.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
              ملاحظات
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات..."
              className="w-full h-10 rounded-xl bg-soft border border-border px-3 text-sm font-bold focus:border-primary focus:ring-0"
            />
          </div>

          {/* Warnings */}
          {conflictMsg && (
            <div className="rounded-lg bg-danger/5 border border-danger/20 p-2.5">
              <p className="text-[10px] font-black text-danger flex items-center gap-1.5">
                <AlertTriangle size={12} /> {conflictMsg}
              </p>
            </div>
          )}
          {existingBookings.length > 0 && (
            <div className="rounded-lg bg-warning/5 border border-warning/20 p-2.5">
              <p className="text-[10px] font-black text-warning flex items-center gap-1.5">
                <AlertTriangle size={12} /> هذا العميل لديه حجز في هذا اليوم
                بالفعل
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="rounded-xl bg-success/5 border border-success/20 p-3">
            <div className="text-[10px] font-bold text-muted">
              الإجمالي ({serviceIds.length} خدمات • {totalDuration} دقيقة)
            </div>
            <div className="text-xl font-black text-success">
              {formatCurrency(totalPrice)}
            </div>
          </div>
        </div>
        <DialogFooter className="p-5 pt-3 border-t border-border/40 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 flex-1 rounded-xl text-xs"
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            className="h-10 flex-1 rounded-xl text-xs"
            disabled={
              serviceIds.length === 0 ||
              !time ||
              !!conflictMsg ||
              existingBookings.length > 0
            }
          >
            <Plus size={14} className="ml-1.5" /> تأكيد الحجز
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CustomerDetail() {
  return (
    <ErrorBoundary>
      <CustomerDetailPage />
    </ErrorBoundary>
  );
}
