import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Phone,
  Mail,
  Calendar,
  Trophy,
  TrendingUp,
  CreditCard,
  Edit3,
  Trash2,
  Plus,
  User,
  AlertCircle,
  CalendarClock,
  Receipt,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { cn, formatCurrency, getInitials } from "@/lib/core/utils";

import {
  useCustomerDetailPage,
  CustomerOverviewTab,
  CustomerAppointmentsTab,
  CustomerInvoicesTab,
  CustomerEditDialog,
  BookingModal,
} from "@/features/customers";
import { PageHeader } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";

function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = ["OWNER", "ADMIN"].includes(
    String(user?.role || "").toUpperCase(),
  );
  const customerId = Number(id);
  const {
    customer,
    appointments,
    invoices,
    activityLogs,
    customerLoading,
    appointmentsLoading,
    invoicesLoading,
    activityLoading,
    customerError,
    tierInfo,
    stats,
    isEditOpen,
    setIsEditOpen,
    isDeleteOpen,
    setIsDeleteOpen,
    isBookingOpen,
    setIsBookingOpen,
    editForm,
    setEditForm,
    isSaving,
    openEdit,
    handleSaveEdit,
    handleDelete,
  } = useCustomerDetailPage(customerId);

  const [activeTab, setActiveTab] = useState("overview");

  if (customerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-20 w-20 rounded-2xl" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  if (customerError || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen pb-12">
      <div className="mx-auto max-w-7xl space-y-4 px-3 pt-4 sm:space-y-5 sm:px-4 lg:px-6">
        <PageHeader
          className={undefined}
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

          <CustomerOverviewTab
            customer={customer}
            stats={stats}
            tierInfo={tierInfo}
            appointments={appointments}
            appointmentsLoading={appointmentsLoading}
            invoices={invoices}
            invoicesLoading={invoicesLoading}
          />

          <CustomerAppointmentsTab
            appointments={appointments}
            loading={appointmentsLoading}
          />

          <CustomerInvoicesTab invoices={invoices} loading={invoicesLoading} />
        </Tabs>

        {/* Edit Dialog */}
        <CustomerEditDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          form={editForm}
          setForm={setEditForm}
          isSaving={isSaving}
          onSave={handleSaveEdit}
        />

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

export default function CustomerDetail() {
  return (
    <ErrorBoundary>
      <CustomerDetailPage />
    </ErrorBoundary>
  );
}
