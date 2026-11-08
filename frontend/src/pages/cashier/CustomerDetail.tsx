import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageShell } from "@/components/shared/PageShell";
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
  FileText,
  Clock,
  MessageCircle,
  Printer,
  Send,
  Download,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "react-hot-toast";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { cn, formatCurrency, getInitials } from "@/lib/core/utils";
import { exportCustomerPDF } from "@/lib/export/customerPDF";

import {
  useCustomerDetailPage,
  CustomerOverviewTab,
  CustomerAppointmentsTab,
  CustomerInvoicesTab,
  CustomerEditDialog,
  BookingModal,
} from "@/features/customers";
import { InvoiceDetailsDialog } from "@/features/invoices";
import { printThermalReceipt } from "@/lib/print/receipt";
import { useSalon } from "@/context/SalonContext";
import { PageHeader } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";

function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isOwner = ["OWNER", "ADMIN"].includes(
    String(user?.role || "").toUpperCase(),
  );
  const customerId = Number(id);
  const { t, i18n } = useTranslation("customers");
  const dateLocale = i18n.language.startsWith("ar") ? "ar-EG" : "en-GB";
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

  // Row -> invoice details. State lives here (page level) because the dialog
  // is the invoices feature's shared component; the tab stays page-agnostic
  // and simply reports which row was opened.
  const [selectedInvoice, setSelectedInvoice] = useState<
    Record<string, unknown> | null
  >(null);
  const { settings } = useSalon();

  if (customerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" aria-busy="true" aria-label={t("page.loading")}>
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-20 w-20 rounded-2xl" aria-hidden="true" />
          <Skeleton className="h-4 w-40" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (customerError || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle size={48} className="text-rose-400" />
          <h3 className="text-lg font-black text-main">{t("customerDetail.notFound")}</h3>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="primary"
              onClick={() => navigate("/customers")}
              className="rounded-xl"
            >
              <ArrowRight size={16} className="ms-2" /> {t("customerDetail.backToCustomers")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                navigate("/customers");
                // Trigger create customer flow - the Customers page handles this
              }}
              className="rounded-xl"
            >
              <Plus size={14} className="ms-1.5" /> {t("quickActions.createCustomer")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageShell contained>
        <PageHeader
          className={undefined}
          title={`${customer.first_name} ${customer.last_name || ""}`}
          subtitle={t("details.profileSubtitle", { id: customer.customer_id })}
          badge={t(tierInfo.label)}
          icon={tierInfo.icon}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => navigate("/customers")}
                className="h-10 rounded-xl px-3 text-xs"
              >
                <ArrowRight size={14} className="ms-1.5" /> {t("customerDetail.back")}
              </Button>
              <Button
                variant="primary"
                className="h-10 rounded-xl px-3 text-xs"
                onClick={() => setIsBookingOpen(true)}
              >
                <Plus size={14} className="ms-1.5" /> {t("customerDetail.newBooking")}
              </Button>
              {customer.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const phone = customer.phone.replace(/\s/g, "");
                    const msg = encodeURIComponent(
                      `مرحباً ${customer.first_name}، نتمنى لك يوماً سعيداً من صالون برو`,
                    );
                    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
                  }}
                  className="h-8 rounded-xl px-2 text-[10px] whitespace-nowrap"
                  aria-label={t("quickActions.whatsapp")}
                  title={t("quickActions.whatsapp")}
                >
                  <MessageCircle size={12} className="ms-1" /> {t("quickActions.whatsapp")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toast(
                    t("quickActions.reminder"),
                    { icon: "📱", duration: 3000 },
                  );
                }}
                className="h-8 rounded-xl px-2 text-[10px] whitespace-nowrap"
                aria-label={t("quickActions.reminder")}
                title={t("quickActions.reminder")}
              >
                <Send size={12} className="ms-1" /> {t("quickActions.reminder")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.print();
                }}
                className="h-8 rounded-xl px-2 text-[10px] whitespace-nowrap"
                aria-label={t("quickActions.printCard")}
                title={t("quickActions.printCard")}
              >
                <Printer size={12} className="ms-1" /> {t("quickActions.printCard")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exportCustomerPDF({
                    customer,
                    appointments,
                    invoices,
                    stats,
                    tierInfo,
                    salonName: settings?.salon_name || settings?.salonName || "Salon Pro",
                  });
                }}
                className="h-8 rounded-xl px-2 text-[10px] whitespace-nowrap"
                aria-label={t("export.button")}
                title={t("export.button")}
              >
                <Download size={12} className="ms-1" /> {t("export.button")}
              </Button>
              {isOwner && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    // Transfer to POS - create a quick sale session
                    setIsBookingOpen(true);
                  }}
                  className="h-8 rounded-xl px-2 text-[10px] whitespace-nowrap"
                  aria-label={t("quickActions.transferPOS")}
                  title={t("quickActions.transferPOS")}
                >
                  <CreditCard size={12} className="ms-1" /> {t("quickActions.transferPOS")}
                </Button>
              )}
              {isOwner && (
                <>
                  <Button
                    variant="outline"
                    onClick={openEdit}
                    className="h-10 rounded-xl px-3 text-xs"
                  >
                    <Edit3 size={14} className="ms-1.5" /> {t("customerDetail.edit")}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setIsDeleteOpen(true)}
                    className="h-10 rounded-xl px-3 text-xs"
                  >
                    <Trash2 size={14} className="ms-1.5" /> {t("customerDetail.delete")}
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
                  <tierInfo.icon size={10} className="ms-1" /> {t(tierInfo.label)}
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
                {customer.second_phone && (
                  <a
                    href={`tel:${customer.second_phone}`}
                    className="flex items-center gap-1 text-muted hover:text-primary"
                  >
                    <Phone size={12} /> <span dir="ltr">{customer.second_phone}</span>
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
                    <Calendar size={12} /> {t("details.since")}{" "}
                    {new Date(customer.created_at).toLocaleDateString(dateLocale, {
                      year: "numeric",
                      month: "short",
                    })}
                  </span>
                )}
                {customer.address && (
                  <span className="flex items-center gap-1 text-muted">
                    <FileText size={12} /> {customer.address}
                  </span>
                )}
                {customer.notes && (
                  <span className="flex items-center gap-1 text-muted" title={customer.notes}>
                    <Send size={12} /> {customer.notes}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-6">
            <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" />
                <div>
                  <p className="text-[8px] font-bold uppercase text-muted sm:text-[10px]">
                    {t("overview.totalSpend")}
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
                    {t("overview.visits")}
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
                    {t("overview.points")}
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
                    {t("overview.paid")}
                  </p>
                  <p className="text-base font-black text-main sm:text-lg">
                    {formatCurrency(stats.totalPaid)}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-info" />
                <div>
                  <p className="text-[8px] font-bold uppercase text-muted sm:text-[10px]">
                    {t("overview.avgSpend")}
                  </p>
                  <p className="text-base font-black text-main sm:text-lg">
                    {formatCurrency(stats.avgSpend)}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-warning" />
                <div>
                  <p className="text-[8px] font-bold uppercase text-muted sm:text-[10px]">
                    {t("overview.noShowRate")}
                  </p>
                  <p className="text-base font-black text-main sm:text-lg">
                    {stats.noShowRate}%
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                <div>
                  <p className="text-[8px] font-bold uppercase text-muted sm:text-[10px]">
                    {t("overview.upcomingAppointments")}
                  </p>
                  <p className="text-base font-black text-main sm:text-lg">
                    {stats.upcomingCount}
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
              { key: "overview", label: t("tabs.overview"), icon: User },
              {
                key: "appointments",
                label: t("tabs.appointments"),
                icon: CalendarClock,
                count: appointments.length,
              },
              {
                key: "invoices",
                label: t("tabs.invoices"),
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
            activityLogs={activityLogs}
            activityLoading={activityLoading}
          />

          <CustomerAppointmentsTab
            appointments={appointments}
            loading={appointmentsLoading}
          />

          <CustomerInvoicesTab
            invoices={invoices}
            loading={invoicesLoading}
            onViewInvoice={(inv) => setSelectedInvoice(inv ?? null)}
          />
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
          onSuccess={async () => {
            setIsBookingOpen(false);
            await queryClient.invalidateQueries({ queryKey: ["customers"] });
          }}
        />

        {/* Invoice details (row eye button in the invoices tab) */}
        <InvoiceDetailsDialog
          selectedInvoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPrintSelected={() => {
            if (selectedInvoice) void printThermalReceipt(selectedInvoice, settings);
          }}
        />

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          title={t("customerDetail.archive")}
          description={t("customerDetail.archiveConfirm", { name: customer.first_name })}
          onConfirm={handleDelete}
          confirmText={t("customerDetail.archiveConfirmText")}
          cancelText={t("customerDetail.archiveCancel")}
          variant="danger"
        />
      </PageShell>
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




