import { useAuth } from "@/context/AuthContext";
import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useHrData, useEmployeeDocuments, useEmployeeForm } from "@/features/hr";
import { useUI } from "@/context/UIContext";
import { Pagination, createPaginationState } from "@/components/shared/Pagination";
import {
  User,
  Phone,
  Plus,
  Pencil,
  CheckCircle2,
  UserPlus,
  X,
  Archive,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Building2,
  Wallet,
  Clock,
  BarChart3,
  Info,
  Save,
  FileClock,
  Users,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";




import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  PageHeader,
  PremiumCard,
} from "@/components/shared/PremiumUI";
import { cn } from "@/lib/core/utils";
import { staticURL } from "@/services/api";

import {
  PersonalTab,
  WorkTab,
  SkillsTab,
  FinancialTab,
  AssistantTab,
  SystemTab,
  DocumentsTab,
  ReviewTab,
  HrStatsGrid,
  HrToolbar,
  ExpiringDocsAlert,
  EmployeeCardGrid,
  EmployeeTable,
  ArchiveEmployeeDialog,
  formatEmployeeMoney,
  blueprintText,
} from "@/features/hr";
import { describeDraftAge } from "@/features/hr/utils/draft";
import { useTranslation } from "react-i18next";
import { getIntlLocale } from "@/lib/format/locale";
import { issuesForStep } from "@/features/hr/utils/formIssues";

const HRManagement = () => {
  const { t, i18n } = useTranslation("owner");
  const locale = getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar");

  const navigate = useNavigate();
  const { user: _user } = useAuth();
  const { openEmployeeQuickView } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledEmployeeIdRef = useRef<string | null>(null);
  const handledEditRef = useRef<string | null>(null);
  void _user;

  const {
    employees,
    allServices,
    loading,
    isInitialLoading,
    loadError,
    searchPending,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    activeView,
    setActiveView,
    filteredEmployees,
    stats,
    fetchEmployees,
    page,
    setPage,
    size,
    totalCount,
  } = useHrData();
  const {
    employeeDocs,
    expiringDocs,
    docLoading,
    setDocLoading,
    fetchDocuments,
    fetchExpiringDocs,
  } = useEmployeeDocuments();
  const {
    activeTab,
    setActiveTab,
    isModalOpen,
    setIsModalOpen,
    editingEmp,
    deleteTarget,
    setDeleteTarget,
    archiveTarget,
    setArchiveTarget,
    archiveImpact,
    archiveForm,
    setArchiveForm,
    openArchive,
    formData,
    setFormData,
    imagePreview,
    setImagePreview,
    uploading,
    isActionLoading,
    customJobTitle,
    setCustomJobTitle,
    DYNAMIC_TABS,
    hiddenSteps,
    stepIssues,
    goNext,
    draftOffer,
    draftSavedAt,
    saveDraft,
    resumeDraft,
    dismissDraft,
    keepDraftOnClose,
    currentBlueprint,
    handleImageChange,
    applyJobTitleDefaults,
    openCreate,
    openEdit,
    handleSubmit,
    handleToggleStatus,
    handleArchiveEmployee,
  } = useEmployeeForm(fetchEmployees);
  useEffect(() => {
    if (editingEmp && activeTab === "documents") {
      fetchDocuments(editingEmp.id);
    }
  }, [editingEmp, activeTab, fetchDocuments]);

  // The blueprint is prose, so it follows the reader's language; the colours
  // and the icon stay as they are.
  const blueprint = blueprintText(formData.jobTitle, t);

  // Deep links: /manager/hr?employeeId=ID opens the employee file,
  // /manager/hr?edit=ID opens the edit form. Consume each param once.
  useEffect(() => {
    const employeeId = searchParams.get("employeeId");
    if (!employeeId || handledEmployeeIdRef.current === employeeId) return;
    handledEmployeeIdRef.current = employeeId;
    openEmployeeQuickView(employeeId);
    const next = new URLSearchParams(searchParams);
    next.delete("employeeId");
    setSearchParams(next, { replace: true });
  }, [openEmployeeQuickView, searchParams, setSearchParams]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || handledEditRef.current === editId) return;
    handledEditRef.current = editId;
    void openEdit({ id: editId });
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }, [openEdit, searchParams, setSearchParams]);



  const renderTabContent = () => {
    switch (activeTab) {
      case "personal":
        return (
          <PersonalTab
            formData={formData}
            setFormData={setFormData}
            imagePreview={imagePreview}
            setImagePreview={setImagePreview}
            uploading={uploading}
            onImageChange={handleImageChange}
            blueprint={{ title: blueprint.title }}
          />
        );
      case "work":
        return (
<WorkTab
              formData={formData}
              setFormData={setFormData}
              customJobTitle={customJobTitle}
              setCustomJobTitle={setCustomJobTitle}
              applyJobTitleDefaults={applyJobTitleDefaults}
              hiddenSteps={hiddenSteps}
            />
        );
      case "skills":
        return (
          <SkillsTab
            allServices={allServices}
            formData={formData}
            setFormData={setFormData}
          />
        );
      case "financial":
        return (
          <FinancialTab formData={formData} setFormData={setFormData} />
        );
      case "assistant":
        return (
          <AssistantTab
            formData={formData}
            setFormData={setFormData}
            employees={employees}
          />
        );
      case "system":
        return (
          <SystemTab
            formData={formData}
            setFormData={setFormData}
            editingEmp={editingEmp}
          />
        );
      case "documents":
        return (
          <DocumentsTab
            editingEmp={editingEmp}
            employeeDocs={employeeDocs}
            docLoading={docLoading}
            setDocLoading={setDocLoading}
            onRefreshDocs={(id) => fetchDocuments(id)}
          />
        );
      case "review":
        return (
          <ReviewTab
            formData={formData}
            blueprint={{ title: blueprint.title }}
            onSubmit={handleSubmit}
            isActionLoading={isActionLoading}
            isEditing={!!editingEmp}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="erp-page space-y-5 pb-16">
      {/* Vacation is not a punishment: info tone, and the employee stays. */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="info"
        title={
          deleteTarget?.status === "active"
            ? t("hr.leaveTitle")
            : t("hr.returnTitle")
        }
        confirmText={
          deleteTarget?.status === "active" ? t("hr.leaveConfirm") : t("hr.returnConfirm")
        }
        description={
          deleteTarget?.status === "active"
            ? t("hr.leaveDesc", { name: deleteTarget?.fullName })
            : t("hr.returnDesc", { name: deleteTarget?.fullName })
        }
        onConfirm={handleToggleStatus}
        loading={isActionLoading}
      />

      {/* Archive is the heavier decision: the employee actually left the salon,
          and what that strands is shown before the button, not after. */}
      <ArchiveEmployeeDialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        targetName={archiveTarget?.fullName}
        impact={archiveImpact}
        form={archiveForm}
        setForm={setArchiveForm}
        onConfirm={handleArchiveEmployee}
        loading={isActionLoading}
      />

      {/* ═══ HEADER SECTION ═══ */}
      <PageHeader
        title={t("hr.title")}
        subtitle={t("hr.subtitle")}
        badge={t("hr.badge")}
        icon={Users}
        actions={
          <>
            <Button
              onClick={openCreate}
              className="h-11 rounded-xl bg-accent px-6 text-sm font-semibold text-content-on-accent shadow-sm transition-all active:scale-[0.98]"
            >
              <Plus size={18} className="ms-1.5" strokeWidth={2.5} /> {t("hr.addEmployee")}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/manager/hr/archive")}
              className="h-11 gap-2 rounded-xl border-line bg-raised px-4 text-xs font-semibold text-content-secondary transition-colors hover:border-accent hover:text-content"
            >
              <Archive size={16} />
              {t("hr.archiveButton")}
              {/* The count is why the button is worth clicking: it says whether
                  anyone has left since the last time the owner looked. */}
              <span className="rounded-md bg-sunken px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-content-tertiary">
                {stats.resigned}
              </span>
            </Button>
          </>
        }
      />

      <ExpiringDocsAlert expiringDocs={expiringDocs} />

      <HrStatsGrid stats={stats} loading={isInitialLoading} />

      {/* ═══ RELATED NAV ═══ */}
      <PremiumCard className="p-0 overflow-hidden" hoverable={false} animate={false}>
        <div className="flex flex-wrap items-center gap-2 p-2.5">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-content-tertiary ms-1.5">
            <Sparkles size={12} className="text-accent" /> {t("hr.quickNav")}
          </span>
          {[
            { label: t("hr.navPayroll"), desc: t("hr.navPayrollDesc"), icon: Wallet, href: "/owner/payroll", tone: "text-warning" },
            { label: t("hr.navAttendance"), desc: t("hr.navAttendanceDesc"), icon: Clock, href: "/attendance", tone: "text-info" },
            { label: t("hr.navReports"), desc: t("hr.navReportsDesc"), icon: BarChart3, href: "/owner/employee-reports", tone: "text-accent" },
          ].map((l) => (
            <button
              key={l.href}
              onClick={() => navigate(l.href)}
              className="inline-flex items-center gap-2.5 rounded-lg border border-line bg-raised px-3 py-2 text-start transition-colors hover:border-accent hover:bg-sunken group"
            >
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-md border border-line bg-sunken shrink-0", l.tone)}>
                <l.icon size={14} />
              </span>
              <span className="text-start">
                <span className="block text-xs font-semibold text-content group-hover:text-accent transition-colors">{l.label}</span>
                <span className="block text-[10px] font-medium text-content-tertiary leading-none">{l.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </PremiumCard>

      {/* ═══ FILTER & SEARCH ═══ */}
      <HrToolbar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        activeView={activeView}
        setActiveView={setActiveView}
        resultCount={filteredEmployees.length}
        totalCount={totalCount}
        page={page}
        size={size}
        counts={
          isInitialLoading
            ? undefined
            : {
                all: Math.max(stats.total - stats.resigned, 0),
                active: stats.active,
                suspended: stats.suspended,
              }
        }
        onRefresh={() => void fetchEmployees()}
        refreshing={loading && !isInitialLoading}
        searchPending={searchPending}
      />

      {/* ═══ EMPLOYEE CONTENT ═══ */}
      {isInitialLoading ? (
        <HrBoardSkeleton label={t("hr.syncing")} />
      ) : (
        <>
          {loadError && (
            <div className="flex flex-col gap-3 rounded-xl border border-warning-line bg-warning-bg p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0 text-warning"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-bold text-content">
                    {t("hr.loadFailed")}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-content-secondary">
                    {t("hr.loadFailedHint")}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => void fetchEmployees()}
                className="h-9 shrink-0 rounded-lg border-line bg-raised px-3 text-xs font-semibold"
              >
                {t("hr.refresh")}
              </Button>
            </div>
          )}

          {!(loadError && employees.length === 0) && (
            <AnimatePresence mode="wait" initial={false}>
              {activeView === "cards" ? (
                <EmployeeCardGrid
                  key="cards"
                  employees={filteredEmployees}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                  onArchive={openArchive}
                  onCreate={openCreate}
                  hasActiveFilters={
                    Boolean(searchTerm.trim()) || statusFilter !== "all"
                  }
                  onClearFilters={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                />
              ) : (
                <EmployeeTable
                  key="table"
                  employees={filteredEmployees}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                  onArchive={openArchive}
                  onCreate={openCreate}
                  hasActiveFilters={
                    Boolean(searchTerm.trim()) || statusFilter !== "all"
                  }
                  onClearFilters={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                />
              )}
            </AnimatePresence>
          )}
        </>
      )}

      {totalCount > size && (() => {
        const paginator = createPaginationState({
          page,
          size,
          total: totalCount,
        });
        return (
          <div className="card-surface rounded-xl px-2 py-2">
            <Pagination
              paginator={paginator}
              onPageChange={setPage}
              showSizeChanger={false}
              locale={locale.startsWith("ar") ? "ar" : "en"}
            />
          </div>
        );
      })()}

      {/* ═══ EMPLOYEE WIZARD MODAL ═══ */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
            // Only on the way shut, and only for a half-filled new hire: an
            // edit has the saved row, so nothing would be lost.
            if (!open) keepDraftOnClose();
            setIsModalOpen(open);
          }}>
        <DialogContent
          className="flex h-[100dvh] sm:h-[94vh] w-[100vw] sm:w-[96vw] max-w-350 flex-col overflow-hidden rounded-none sm:rounded-[2rem] border-0 bg-card p-0 shadow-[0_50px_150px_-30px_rgba(0,0,0,0.4)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 sm:px-8 py-4 sm:py-6 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-xl shadow-accent/20">
                {editingEmp ? (
                  <Pencil size={24} strokeWidth={3} />
                ) : (
                  <UserPlus size={24} strokeWidth={3} />
                )}
              </div>
              {/*
                Close the form halfway through and everything typed is gone:
                name, phone, salary, commission, a password. Offer the way back
                in rather than making the owner remember and retype it.
              */}
              {draftOffer && (
                <div className="rounded-2xl border border-primary/25 bg-primary-soft/60 p-4">
                  <div className="flex items-start gap-3">
                    <FileClock size={20} className="mt-0.5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-main">
                        {t("hr.draftFound")}
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold leading-relaxed text-muted">
                        {draftOffer.formData.fullName
                          ? t("hr.draftOffer", { name: String(draftOffer.formData.fullName) })
                          : t("hr.draftOfferFallback")}
                        {t("hr.draftAge", { age: describeDraftAge(draftOffer.savedAt, t) })}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={resumeDraft}
                          className="rounded-xl font-black"
                        >
                          {t("hr.resumeDraft")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={dismissDraft}
                          className="rounded-xl font-black"
                        >
                          {t("hr.discardDraft")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <DialogTitle className="text-2xl font-black text-main tracking-tight">
                  {editingEmp ? t("hr.editEmployee") : t("hr.newEmployee")}
                </DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">
                  {editingEmp ? formData.fullName : t("hr.newEmployeeDesc")}
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              aria-label={t("hr.close")}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-soft text-muted transition-all hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <X size={24} strokeWidth={3} aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* LEFT: Live Preview - Professional & Responsive */}
            <aside className="hidden w-[380px] xl:flex flex-col border-e border-border bg-gradient-to-b from-card to-soft/30 p-6 lg:p-8 backdrop-blur-md overflow-y-auto custom-scrollbar">
              <div className="mb-6 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/15 px-3 py-1">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="text-[9px] font-black text-accent uppercase tracking-[0.2em]">{t("hr.livePreview")}</span>
                </div>
                <p className="mt-3 text-[11px] font-bold text-muted">{t("hr.livePreviewDesc")}</p>
              </div>

              <div className={cn("relative overflow-hidden rounded-[2rem] border bg-card shadow-xl", currentBlueprint.cardBg)}>
                <div className={cn("absolute inset-x-0 top-0 h-1", currentBlueprint.accent)} />
                <div className={cn("absolute -end-12 -top-12 h-40 w-40 rounded-full opacity-[0.07]", currentBlueprint.accent)} />
                <div className="relative z-10 flex flex-col items-center gap-5 p-7">
                  <div className="relative">
                    {/* Decorative ring */}
                    <div className="absolute inset-0 rounded-[1.7rem] bg-gradient-to-br from-accent/20 to-transparent blur-xl" />
                    <div className="relative rounded-[1.6rem] p-1.5 bg-card shadow-xl ring-1 ring-border/50">
                      <div className="h-28 w-28 rounded-[1.3rem] overflow-hidden bg-soft flex items-center justify-center">
                        {imagePreview || formData.profileImageUrl ? (
                          <img src={imagePreview || (formData.profileImageUrl?.startsWith("http") ? formData.profileImageUrl : `${staticURL}${formData.profileImageUrl}`)} alt={formData.fullName || t("hr.employeeImage")} className="h-full w-full object-cover" onError={(e)=> { e.currentTarget.style.display='none'; setImagePreview(null); }} />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-muted/40">
                            <User size={32} strokeWidth={1.5} />
                            <span className="text-[8px] font-black uppercase">{t("hr.noImage")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={cn("absolute -bottom-1.5 -end-1.5 h-7 w-7 rounded-full border-[3px] border-card shadow-md flex items-center justify-center text-white", formData.status === "active" ? "bg-success" : formData.status === "suspended" ? "bg-warning" : "bg-danger") }>
                      {formData.status === "active" ? <CheckCircle2 size={14} strokeWidth={3} /> : formData.status === "suspended" ? <Clock size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                    </div>
                  </div>
                  <div className="text-center space-y-2 w-full">
                    <h4 className="text-[18px] font-black text-main tracking-tight line-clamp-1 px-2">
                      {formData.fullName || t("hr.employeeName")}
                    </h4>
                    <div className="flex items-center justify-center">
                      <Badge className={cn("rounded-full px-3.5 py-1 text-[10px] font-black tracking-widest border shadow-sm", currentBlueprint.badgeClass)}>
                        {blueprint.title}
                      </Badge>
                    </div>
                    {formData.phonePrimary && (
                      <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-muted" dir="ltr">
                        <Phone size={12} className="text-accent" /> {formData.phonePrimary}
                      </div>
                    )}
                  </div>

                  <div className="w-full grid grid-cols-2 gap-2.5 pt-5 border-t border-border/60">
                    <div className="rounded-2xl bg-soft border border-border/50 p-3 text-center">
                      <div className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">{t("hr.statusLabel")}</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className={cn("h-2 w-2 rounded-full", formData.status==="active"?"bg-success animate-pulse":formData.status==="suspended"?"bg-warning":"bg-danger")} />
                        <span className="text-[11px] font-black text-main">{formData.status==="active"?t("hr.statusActive"):formData.status==="suspended"?t("hr.statusSuspended"):t("hr.statusArchived")}</span>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-soft border border-border/50 p-3 text-center">
                      <div className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">{t("hr.salaryLabel")}</div>
                      <div className="text-[11px] font-black tabular-nums text-main">
                        {formatEmployeeMoney(
                          formData.baseSalary || 0,
                          locale,
                          i18n.resolvedLanguage || i18n.language,
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="w-full grid grid-cols-3 gap-1.5">
                    {[
                      {k:"POS", v:formData.showInPos, label:t("hr.rolePos")},
                      {k:"Booking", v:formData.showInBooking, label:t("hr.roleBooking")},
                      {k:"Login", v:formData.hasLoginAccount, label:t("hr.roleLogin")},
                    ].map((f) => (
                      <div key={f.k} className={cn("flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[8px] font-black transition-all", f.v ? "bg-accent border-accent text-white shadow-md" : "bg-soft border-border text-muted/50")}>
                        <span className="tracking-widest">{f.k}</span>
                        {f.v ? <CheckCircle2 size={12} strokeWidth={2.5} /> : <X size={12} strokeWidth={2.5} />}
                        <span className="text-[7px] opacity-80">{f.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest">
                    <div className="h-6 w-6 rounded-lg bg-accent/10 flex items-center justify-center text-accent"><Sparkles size={12} /></div> {t("hr.rolePriorities")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {blueprint.focus.map((f) => (
                      <span key={f} className="inline-flex items-center gap-1 rounded-full bg-card border border-border px-2.5 py-1 text-[10px] font-bold text-main shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {f}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-soft p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute -end-6 -top-6 h-20 w-20 rounded-full bg-accent/5" />
                  <div className="relative flex items-center gap-2.5 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><Building2 size={14} /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">{t("hr.roleSummary")}</span>
                  </div>
                  <p className="relative text-[11px] font-medium leading-relaxed text-main line-clamp-3">{blueprint.summary}</p>
                </div>
                {formData.bioAr && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">{t("hr.professionalBio")}</div>
                    <p className="text-xs font-bold leading-relaxed text-main line-clamp-3">“{formData.bioAr}”</p>
                  </div>
                )}
              </div>
            </aside>

            {/* CENTER: Form Content */}
            <main className="flex-1 overflow-y-auto bg-card/50 p-4 sm:p-8 lg:p-10 custom-scrollbar relative flex flex-col">
              {/* Mobile Stepper */}
              <div className="xl:hidden mb-6 -mx-1">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
                  {DYNAMIC_TABS.map((tab, idx) => {
                    const isActive = activeTab === tab.id;
                    const isPast = DYNAMIC_TABS.findIndex((t) => t.id === activeTab) > idx;
                    const problems = issuesForStep(stepIssues, tab.id);
                    return (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)} title={problems[0]} className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-black whitespace-nowrap transition-all shrink-0", isActive ? "bg-accent text-white border-accent shadow-md" : isPast ? "bg-success-soft text-success border-success/20" : "bg-card text-muted border-border")}>
                        {isPast ? <CheckCircle2 size={14} /> : <tab.icon size={14} />} {tab.label}
                        {problems.length > 0 && (
                          <span className={cn("h-2 w-2 rounded-full", isActive ? "bg-white" : "bg-danger")} aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Mobile Live Preview collapsed */}
                <div className="mt-4 rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl overflow-hidden bg-soft flex items-center justify-center shrink-0 ring-1 ring-border">
                    {imagePreview || formData.profileImageUrl ? (
                      <img src={imagePreview || (formData.profileImageUrl?.startsWith("http") ? formData.profileImageUrl : `${staticURL}${formData.profileImageUrl}`)} alt="preview" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    ) : (
                      <User size={20} className="text-muted/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-black text-main truncate">{formData.fullName || t("hr.noName")}</div>
                    <div className="text-[10px] font-bold text-accent">{blueprint.title}</div>
                    <div className="flex gap-1 mt-1">
                      <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full font-black border", formData.status==="active"?"bg-success text-white border-success":formData.status==="suspended"?"bg-warning text-white border-warning":"bg-danger text-white border-danger")}>{formData.status==="active"?t("hr.statusActive"):formData.status==="suspended"?t("hr.statusSuspended"):t("hr.statusArchived")}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-soft border border-border font-bold tabular-nums text-muted">
                        {formatEmployeeMoney(
                          formData.baseSalary || 0,
                          locale,
                          i18n.resolvedLanguage || i18n.language,
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="text-[9px] font-black text-muted">{Math.round(((DYNAMIC_TABS.findIndex(t=>t.id===activeTab)+1)/DYNAMIC_TABS.length)*100)}%</div>
                </div>
              </div>

              <div className="flex-1 max-w-2xl mx-auto w-full">
                <AnimatePresence>
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, scale: 0.98, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.98, x: -20 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    {renderTabContent()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Wizard Footer Navigation */}
              <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border pt-6 sm:pt-8 max-w-2xl mx-auto w-full">
                <Button
                  variant="outline"
                  onClick={() => {
                    const idx = DYNAMIC_TABS.findIndex((t) => t.id === activeTab);
                    if (idx > 0) setActiveTab(DYNAMIC_TABS[idx - 1].id);
                  }}
                  disabled={DYNAMIC_TABS.findIndex((t) => t.id === activeTab) === 0}
                  className="h-11 sm:h-12 px-6 sm:px-8 rounded-xl font-black text-[11px] uppercase tracking-widest order-2 sm:order-1"
                >
                  <ArrowRight size={16} className="ms-2" /> {t("hr.prev")}
                </Button>
                <div className="hidden sm:flex items-center gap-2 order-2">
                  {DYNAMIC_TABS.map((tab) => (
                    <div key={tab.id} className={cn("h-1.5 rounded-full transition-all duration-300", activeTab === tab.id ? "w-8 bg-accent" : "w-1.5 bg-border")} />
                  ))}
                </div>
                {activeTab !== "review" ? (
                  <Button
                    onClick={goNext}
                    className="h-11 sm:h-12 px-6 sm:px-8 rounded-xl bg-accent text-white font-black text-[11px] uppercase tracking-widest order-1 sm:order-3"
                  >
                    {t("hr.next")} <ArrowLeft size={16} className="me-2" />
                  </Button>
                ) : (
                  <div className="hidden sm:block w-[100px] order-3" />
                )}
              </div>
              {/*
                The way out that does not lose the work. Offered only for a new
                hire: an edit already has a saved row to fall back on, so a local
                copy here would only risk restoring stale data over a newer one.
              */}
              {!editingEmp && activeTab !== "review" && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={saveDraft}
                    className="rounded-xl font-black text-[11px] text-muted"
                  >
                    <Save size={14} className="ms-2" />
                    {t("hr.saveDraft")}
                  </Button>
                  {draftSavedAt && (
                    <span className="text-[10px] font-bold text-muted">
                      {t("hr.draftSaved", { age: describeDraftAge(draftSavedAt, t) })}
                    </span>
                  )}
                </div>
              )}
              {/*
                The approval button moved onto the review step, so the phone no
                longer needs a second one pinned here — it was a duplicate of
                the same action, and on the review step both showed at once.
              */}
              <div className="xl:hidden mt-6">
                {activeTab !== "review" && (
                  <p className="text-center text-[10px] font-bold text-muted">
                    {t("hr.completeSteps")}
                  </p>
                )}
              </div>
            </main>

            {/* RIGHT: Step Progress Sidebar */}
            <nav className="hidden w-80 flex-col border-s border-border bg-card/80 p-10 backdrop-blur-md xl:flex">
              <div className="mb-10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black text-muted uppercase tracking-[0.3em]">
                    {t("hr.stepsTitle")}
                  </div>
                  <div className="text-[11px] font-black text-accent tabular-nums">
                    {Math.round(
                      ((DYNAMIC_TABS.findIndex((t) => t.id === activeTab) + 1) /
                        DYNAMIC_TABS.length) *
                        100,
                    )}%
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-soft overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{
                      width: `${Math.round(((DYNAMIC_TABS.findIndex((t) => t.id === activeTab) + 1) / DYNAMIC_TABS.length) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="relative space-y-2">
                <div className="absolute start-5.75 top-4 bottom-4 w-px bg-border/40" />
                {DYNAMIC_TABS.map((tab, idx) => {
                  const isActive = activeTab === tab.id;
                  const isPast =
                    DYNAMIC_TABS.findIndex((t) => t.id === activeTab) > idx;
                  /*
                    A red dot instead of a silent step: the step that holds the
                    mistake is visible from anywhere in the wizard, and its
                    title carries the message for the mouse.
                  */
                  const problems = issuesForStep(stepIssues, tab.id);
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      title={problems[0]}
                      className={cn(
                        "group relative z-10 flex w-full items-center gap-4 rounded-2xl p-3 transition-all",
                        isActive
                          ? "bg-card shadow-xl shadow-border/50"
                          : "hover:bg-card/50",
                      )}
                    >
                      <div
                        className={cn(
                          "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all",
                          isActive
                            ? "bg-accent text-white shadow-lg shadow-accent/20 scale-110"
                            : isPast
                              ? "bg-success text-white"
                              : "bg-soft text-muted/40",
                        )}
                      >
                        {isPast ? (
                          <CheckCircle2 size={18} strokeWidth={3} />
                        ) : (
                          <tab.icon size={18} strokeWidth={isActive ? 3 : 2} />
                        )}
                        {problems.length > 0 && (
                          <span
                            className="absolute -top-1 -end-1 h-3.5 w-3.5 rounded-full border-2 border-card bg-danger"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="text-start">
                        <div
                          className={cn(
                            "text-[11px] font-black uppercase tracking-widest transition-colors",
                            isActive ? "text-accent" : "text-muted",
                          )}
                        >
                          {tab.label}
                        </div>
                        {isActive && (
                          <div className="text-[8px] font-bold text-muted/60 uppercase">
                            {t("hr.inProgress")}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/*
                The approval button now lives on the review step itself, where
                the owner is looking when they decide. It used to sit here too,
                disabled until `review`, which made two buttons for one action
                and left the phone with no visible way to finish.
              */}
              <div className="mt-auto pt-10">
                {/*
                  Steps come and go with the job title. Say which ones dropped
                  and why: a stepper that silently loses entries reads as a
                  bug, and the owner filling the form has no way to tell a
                  deliberate skip from a lost one.
                */}
                {hiddenSteps.length > 0 && (
                  <div className="mb-6 rounded-2xl border border-border/60 bg-soft/60 p-3.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-black text-muted">
                      <Info size={12} className="shrink-0" />
                      {t("hr.notApplicable")}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {hiddenSteps.map((step) => (
                        <li key={step.id} className="text-[10px] leading-relaxed">
                          <span className="font-bold text-muted-foreground line-through decoration-muted/40">
                            {step.label}
                          </span>
                          <span className="block text-muted/70">{step.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {activeTab !== "review" && (
                  <p className="text-center text-[10px] font-bold text-muted-foreground animate-pulse">
                    {t("hr.completeSteps")}
                  </p>
                )}
              </div>
            </nav>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/**
 * The first load shows the shape of the board, not a spinner that replaces it.
 * The header, stats strip and toolbar stay in place, so the page never jumps
 * when the roster arrives.
 */
function HrBoardSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-48 animate-pulse rounded-xl border border-line bg-sunken"
          />
        ))}
      </div>
    </div>
  );
}

export default HRManagement;