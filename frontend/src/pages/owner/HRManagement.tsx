import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUI } from "@/context/UIContext";
import { useHrData, useEmployeeDocuments, useEmployeeForm } from "@/features/hr";
import { Pagination, createPaginationState } from "@/components/shared/Pagination";
import {
  User,
  Phone,
  Plus,
  Pencil,
  CheckCircle2,
  UserPlus,
  Save,
  X,
  Archive,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Building2,
  Wallet,
  Clock,
  BarChart3,
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
} from "@/features/hr";

const HRManagement = () => {
  const navigate = useNavigate();
  const { user: _user } = useAuth();
  const { openEmployeeQuickView } = useUI();
  const [searchParams] = useSearchParams();
  const _highlightedEmployeeId = searchParams.get("employeeId");
  void _user;
  void _highlightedEmployeeId;

  const {
    employees,
    allServices,
    loading,
    searchTerm,
    setSearchTerm,
    activeView,
    setActiveView,
    filteredEmployees,
    stats,
    fetchEmployees,
    // Phase 2: pagination
    page,
    setPage,
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
    formData,
    setFormData,
    imagePreview,
    setImagePreview,
    uploading,
    isActionLoading,
    customJobTitle,
    setCustomJobTitle,
    DYNAMIC_TABS,
    currentBlueprint,
    handleImageChange,
    openCreate,
    openEdit,
    handleSubmit,
    handleToggleStatus,
  } = useEmployeeForm(fetchEmployees);
  useEffect(() => {
    if (editingEmp && activeTab === "documents") {
      fetchDocuments(editingEmp.id);
    }
  }, [editingEmp, activeTab, fetchDocuments]);



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
            blueprint={currentBlueprint}
          />
        );
      case "work":
        return (
          <WorkTab
            formData={formData}
            setFormData={setFormData}
            customJobTitle={customJobTitle}
            setCustomJobTitle={setCustomJobTitle}
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
          <ReviewTab formData={formData} blueprint={currentBlueprint} />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-125 flex-col items-center justify-center gap-4 erp-page">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-accent/10 border-t-accent" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">
          جاري مزامنة بيانات الكوادر...
        </p>
      </div>
    );
  }

  return (
    <div className="erp-page space-y-8 pb-20">
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          deleteTarget?.status === "active"
            ? "تعطيل ملف الموظف؟"
            : "إعادة تفعيل الموظف؟"
        }
        description={`سيتم تعديل الحالة التشغيلية للموظف ${deleteTarget?.fullName}.`}
        onConfirm={handleToggleStatus}
        loading={isActionLoading}
      />

      <ExpiringDocsAlert expiringDocs={expiringDocs} />

      {/* ═══ HEADER SECTION ═══ */}
      <PageHeader
        title="إدارة الموظفين"
        subtitle="منظومة احترافية لإدارة شؤون الموظفين، تتبع الأداء، وتنسيق العمليات اليومية للصالون بأعلى معايير الإبداع."
        badge="الكوادر البشرية المتميزة"
        icon={Sparkles}
        actions={
          <>
            <Button
              onClick={openCreate}
              className="h-11 rounded-2xl bg-accent px-8 text-sm font-black shadow-xl shadow-accent/20 transition-all active:scale-95"
            >
              <Plus className="ml-2" size={20} strokeWidth={3} /> إضافة موظف
              جديد
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/owner/hr/archive")}
              className="h-9 rounded-xl border-border bg-card/50 px-5 text-xs font-black text-muted transition-all hover:border-accent/20 hover:text-main"
            >
              <Archive className="ml-2" size={16} /> الأرشيف
            </Button>
          </>
        }
      />

      <HrStatsGrid stats={stats} />

      {/* ═══ RELATED NAV — هوية HR (مرحلة 3) ═══ */}
      <PremiumCard className="p-0 overflow-hidden" hoverable={false} animate={false}>
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest text-muted uppercase ml-2">
            <Sparkles size={12} className="text-accent" /> انتقال سريع
          </span>
          {[
            { label: "الرواتب", desc: "المستحقات والسلف", icon: Wallet, href: "/owner/payroll", color: "bg-warning text-white" },
            { label: "الحضور", icon: Clock, desc: "الانضباط اليومي", href: "/attendance", color: "bg-info text-white" },
            { label: "أرشيف الموظفين", icon: Archive, desc: "المعلّقون والسجل", href: "/owner/hr/archive", color: "bg-soft text-muted border border-border" },
            { label: "تقارير الأداء", icon: BarChart3, desc: "الإنتاجية والعمولة", href: "/owner/employee-reports", color: "bg-primary text-white" },
          ].map((l) => (
            <button
              key={l.href}
              onClick={() => navigate(l.href)}
              className="inline-flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-right hover:border-accent/20 hover:bg-soft transition-colors group"
            >
              <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", l.color)}>
                <l.icon size={14} />
              </span>
              <span className="text-right">
                <span className="block text-xs font-black text-main group-hover:text-accent transition-colors">{l.label}</span>
                <span className="block text-[10px] font-bold text-muted leading-none">{l.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </PremiumCard>

      {/* ═══ FILTER & SEARCH ═══ */}
      <HrToolbar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* ═══ EMPLOYEE CONTENT ═══ */}
      <AnimatePresence mode="wait">
        {activeView === "cards" ? (
          <EmployeeCardGrid
            employees={filteredEmployees}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onCreate={openCreate}
          />
        ) : (
          <EmployeeTable
            employees={filteredEmployees}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        )}
      </AnimatePresence>

      {/* Phase 2: unified pagination — reads X-Total-Count header */}
      {totalCount > 0 && (() => {
        const paginator = createPaginationState({
          page,
          size: 50,
          total: totalCount,
        });
        return (
          <div className="card-surface mt-4 rounded-2xl px-2 py-3">
            <Pagination
              paginator={paginator}
              onPageChange={setPage}
              showSizeChanger={false}
              locale="ar"
            />
            <p className="text-center text-[10px] font-bold text-muted">
              صفحة {page} • {totalCount} موظف إجمالي
            </p>
          </div>
        );
      })()}

      {/* ═══ EMPLOYEE WIZARD MODAL ═══ */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
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
              <div>
                <DialogTitle className="text-2xl font-black text-main tracking-tight">
                  {editingEmp ? "تحديث ملف موظف" : "إضافة كادر جديد للمنظومة"}
                </DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">
                  {editingEmp ? formData.fullName : "بناء هوية وظيفية متكاملة"}
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={() => setIsModalOpen(false)}
              className="h-12 w-12 rounded-2xl bg-soft text-muted transition-all hover:bg-danger-soft hover:text-danger flex items-center justify-center"
            >
              <X size={24} strokeWidth={3} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* LEFT: Live Preview - Professional & Responsive */}
            <aside className="hidden w-[380px] xl:flex flex-col border-l border-border bg-gradient-to-b from-card to-soft/30 p-6 lg:p-8 backdrop-blur-md overflow-y-auto custom-scrollbar">
              <div className="mb-6 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/15 px-3 py-1">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="text-[9px] font-black text-accent uppercase tracking-[0.2em]">معاينة مباشرة</span>
                </div>
                <p className="mt-3 text-[11px] font-bold text-muted">هكذا سيظهر الموظف في الكارد والبحث</p>
              </div>

              <div className={cn("relative overflow-hidden rounded-[2rem] border bg-card shadow-xl", currentBlueprint.cardBg)}>
                <div className={cn("absolute inset-x-0 top-0 h-1", currentBlueprint.accent)} />
                <div className={cn("absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-[0.07]", currentBlueprint.accent)} />
                <div className="relative z-10 flex flex-col items-center gap-5 p-7">
                  <div className="relative">
                    {/* Decorative ring */}
                    <div className="absolute inset-0 rounded-[1.7rem] bg-gradient-to-br from-accent/20 to-transparent blur-xl" />
                    <div className="relative rounded-[1.6rem] p-1.5 bg-card shadow-xl ring-1 ring-border/50">
                      <div className="h-28 w-28 rounded-[1.3rem] overflow-hidden bg-soft flex items-center justify-center">
                        {imagePreview || formData.profileImageUrl ? (
                          <img src={imagePreview || (formData.profileImageUrl?.startsWith("http") ? formData.profileImageUrl : `${staticURL}${formData.profileImageUrl}`)} alt={formData.fullName || "صورة الموظف"} className="h-full w-full object-cover" onError={(e)=> { e.currentTarget.style.display='none'; setImagePreview(null); }} />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-muted/40">
                            <User size={32} strokeWidth={1.5} />
                            <span className="text-[8px] font-black uppercase">بدون صورة</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={cn("absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full border-[3px] border-card shadow-md flex items-center justify-center text-white", formData.status === "active" ? "bg-success" : "bg-danger") }>
                      {formData.status === "active" ? <CheckCircle2 size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                    </div>
                  </div>
                  <div className="text-center space-y-2 w-full">
                    <h4 className="text-[18px] font-black text-main tracking-tight line-clamp-1 px-2">
                      {formData.fullName || "اسم الموظف"}
                    </h4>
                    <div className="flex items-center justify-center">
                      <Badge className={cn("rounded-full px-3.5 py-1 text-[10px] font-black tracking-widest border shadow-sm", currentBlueprint.badgeClass)}>
                        {currentBlueprint.title}
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
                      <div className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">الحالة</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className={cn("h-2 w-2 rounded-full", formData.status==="active"?"bg-success animate-pulse":"bg-danger")} />
                        <span className="text-[11px] font-black text-main">{formData.status==="active"?"نشط":"معلّق"}</span>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-soft border border-border/50 p-3 text-center">
                      <div className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">الراتب</div>
                      <div className="text-[11px] font-black text-main">{Number(formData.baseSalary||0).toLocaleString("ar-EG")} <span className="text-[9px] text-muted">ج.م</span></div>
                    </div>
                  </div>

                  <div className="w-full grid grid-cols-3 gap-1.5">
                    {[
                      {k:"POS", v:formData.showInPos, label:"الكاشير"},
                      {k:"Booking", v:formData.showInBooking, label:"الحجز"},
                      {k:"Login", v:formData.hasLoginAccount, label:"الدخول"},
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
                    <div className="h-6 w-6 rounded-lg bg-accent/10 flex items-center justify-center text-accent"><Sparkles size={12} /></div> أولويات الدور
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentBlueprint.focus.map((f) => (
                      <span key={f} className="inline-flex items-center gap-1 rounded-full bg-card border border-border px-2.5 py-1 text-[10px] font-bold text-main shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {f}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-soft p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-accent/5" />
                  <div className="relative flex items-center gap-2.5 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><Building2 size={14} /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">موجز الدور</span>
                  </div>
                  <p className="relative text-[11px] font-medium leading-relaxed text-main line-clamp-3">{currentBlueprint.summary}</p>
                </div>
                {formData.bioAr && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">النبذة المهنية</div>
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
                    return (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-black whitespace-nowrap transition-all shrink-0", isActive ? "bg-accent text-white border-accent shadow-md" : isPast ? "bg-success-soft text-success border-success/20" : "bg-card text-muted border-border")}>
                        {isPast ? <CheckCircle2 size={14} /> : <tab.icon size={14} />} {tab.label}
                      </button>
                    );
                  })}
                </div>
                {/* Mobile Live Preview collapsed */}
                <div className="mt-4 rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl overflow-hidden bg-soft flex items-center justify-center shrink-0 ring-1 ring-border">
                    {imagePreview || formData.profileImageUrl ? (
                      <img src={imagePreview || (formData.profileImageUrl?.startsWith("http") ? formData.profileImageUrl : `${staticURL}${formData.profileImageUrl}`)} alt="preview" className="h-full w-full object-cover" />
                    ) : (
                      <User size={20} className="text-muted/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-black text-main truncate">{formData.fullName || "بدون اسم"}</div>
                    <div className="text-[10px] font-bold text-accent">{currentBlueprint.title}</div>
                    <div className="flex gap-1 mt-1">
                      <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full font-black border", formData.status==="active"?"bg-success text-white border-success":"bg-danger text-white border-danger")}>{formData.status==="active"?"نشط":"معلّق"}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-soft border border-border font-bold text-muted">{Number(formData.baseSalary||0).toLocaleString("ar-EG")} ج.م</span>
                    </div>
                  </div>
                  <div className="text-[9px] font-black text-muted">{Math.round(((DYNAMIC_TABS.findIndex(t=>t.id===activeTab)+1)/DYNAMIC_TABS.length)*100)}%</div>
                </div>
              </div>

              <div className="flex-1 max-w-2xl mx-auto w-full">
                <AnimatePresence mode="wait">
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
                  <ArrowRight size={16} className="ml-2" /> السابق
                </Button>
                <div className="hidden sm:flex items-center gap-2 order-2">
                  {DYNAMIC_TABS.map((tab) => (
                    <div key={tab.id} className={cn("h-1.5 rounded-full transition-all duration-300", activeTab === tab.id ? "w-8 bg-accent" : "w-1.5 bg-border")} />
                  ))}
                </div>
                {activeTab !== "review" ? (
                  <Button
                    onClick={() => {
                      const idx = DYNAMIC_TABS.findIndex((t) => t.id === activeTab);
                      if (idx < DYNAMIC_TABS.length - 1) setActiveTab(DYNAMIC_TABS[idx + 1].id);
                    }}
                    className="h-11 sm:h-12 px-6 sm:px-8 rounded-xl bg-accent text-white font-black text-[11px] uppercase tracking-widest order-1 sm:order-3"
                  >
                    التالي <ArrowLeft size={16} className="mr-2" />
                  </Button>
                ) : (
                  <div className="hidden sm:block w-[100px] order-3" />
                )}
              </div>
              {/* Mobile Save Button */}
              <div className="xl:hidden mt-6">
                <Button onClick={handleSubmit} disabled={isActionLoading || activeTab !== "review"} className={cn("h-12 w-full rounded-xl font-black text-white shadow-lg", activeTab==="review" ? "bg-accent hover:bg-accent/90 shadow-accent/20" : "bg-soft text-muted opacity-60 cursor-not-allowed")}>
                  <Save size={18} className="ml-2" /> {editingEmp ? "تحديث البيانات" : "حفظ الموظف"}
                </Button>
                {activeTab !== "review" && <p className="mt-2 text-center text-[10px] font-bold text-muted">أكمل الخطوات للوصول للمراجعة ثم الحفظ</p>}
              </div>
            </main>

            {/* RIGHT: Step Progress Sidebar */}
            <nav className="hidden w-80 flex-col border-r border-border bg-card/80 p-10 backdrop-blur-md xl:flex">
              <div className="mb-10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black text-muted uppercase tracking-[0.3em]">
                    خطوات الإعداد
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
                <div className="absolute right-5.75 top-4 bottom-4 w-px bg-border/40" />
                {DYNAMIC_TABS.map((tab, idx) => {
                  const isActive = activeTab === tab.id;
                  const isPast =
                    DYNAMIC_TABS.findIndex((t) => t.id === activeTab) > idx;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "group relative z-10 flex w-full items-center gap-4 rounded-2xl p-3 transition-all",
                        isActive
                          ? "bg-card shadow-xl shadow-border/50"
                          : "hover:bg-card/50",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all",
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
                      </div>
                      <div className="text-right">
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
                            قيد الإكمال الآن
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-auto pt-10">
                <Button
                  onClick={handleSubmit}
                  disabled={isActionLoading || activeTab !== "review"}
                  className={cn(
                    "h-14 w-full rounded-2xl font-black text-white shadow-xl transition-all",
                    activeTab === "review"
                      ? "bg-accent shadow-accent/20 hover:bg-accent/90"
                      : "bg-soft cursor-not-allowed opacity-50",
                  )}
                >
                  <Save size={20} className="ml-2" />
                  {editingEmp ? "تحديث البيانات" : "حفظ الموظف الجديد"}
                </Button>
                {activeTab !== "review" && (
                  <p className="mt-4 text-center text-[10px] font-bold text-muted-foreground animate-pulse">
                    يرجى إكمال الخطوات للوصول للمراجعة والحفظ
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

export default HRManagement;
