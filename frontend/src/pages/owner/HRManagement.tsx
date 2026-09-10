import { useAuth } from "@/context/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import { useUI } from "@/context/UIContext";
import type { EmployeeRecord, DocumentRecord } from "@/types/employee";
import { useHrData, useEmployeeDocuments } from "@/features/hr";
import {
  User,
  Phone,
  Calendar,
  TrendingUp,
  Users,
  Scissors,
  Plus,
  Pencil,
  Image as ImageIcon,
  DollarSign,
  Briefcase,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  FileText,
  UserPlus,
  Save,
  X,
  Activity,
  Trash2,
  Search,
  Archive,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Fingerprint,
  Wallet,
  Building2,
  LayoutGrid,
  List as ListIcon,
  MoreVertical,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import employeeDocumentService from "@/services/employeeDocumentService";
import { motion, AnimatePresence } from "framer-motion";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import EmptyState from "@/components/shared/EmptyState";
import { validateImageSize } from "@/lib/media/upload";
import {
  PageHeader,
  PremiumCard,
  StatCard,
} from "@/components/shared/PremiumUI";
import { cn } from "@/lib/core/utils";
import { staticURL } from "@/services/api";

import {
  JOB_TITLES,
  JOB_TITLE_BLUEPRINTS,
  EMPLOYMENT_TYPES,
  ROLES,
  ASSISTANT_TASKS,
  FORM_TABS,
  defaultForm,
  FIELD_LABEL_CLASS,
  FIELD_INPUT_CLASS,
  FIELD_TEXTAREA_CLASS,
  FIELD_SELECT_CLASS,
  getJobTitleLabel,
  isCustomJobTitleValue,
  normalizeEmployeeRecord,
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
  } = useHrData();
  const {
    employeeDocs,
    expiringDocs,
    docLoading,
    setDocLoading,
    fetchDocuments,
    fetchExpiringDocs,
  } = useEmployeeDocuments();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<EmployeeRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRecord | null>(null);
  const [formData, setFormData] = useState<EmployeeRecord>(defaultForm as EmployeeRecord);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [customJobTitle, setCustomJobTitle] = useState(false);

  // Dynamic Tabs based on Role
  const DYNAMIC_TABS = useMemo(() => {
    const tabs = [...FORM_TABS];
    const role = formData.jobTitle ?? "";

    // Filter out non-relevant tabs
    const filtered = tabs.filter((tab) => {
      if (
        tab.id === "skills" &&
        !["barber", "colorist", "esthetician"].includes(role)
      )
        return false;
      if (tab.id === "assistant" && role !== "barber_assistant") return false;
      return true;
    });

    // Add Review step at the end
    filtered.push({
      id: "review",
      label: "مراجعة واعتماد",
      icon: CheckCircle2,
    });

    return filtered;
  }, [formData.jobTitle]);

  // Handle Role Auto-Configuration
  useEffect(() => {
    const role = formData.jobTitle ?? "";
    setFormData((prev) => ({
      ...prev,
      showInBooking: ["barber", "colorist", "esthetician"].includes(role),
      showInPos: ["barber", "colorist", "esthetician", "cashier"].includes(
        role,
      ),
      hasLoginAccount:
        prev.hasLoginAccount ||
        ["manager", "accountant", "cashier", "owner"].includes(role),
      role: ["manager", "accountant", "cashier", "owner"].includes(role)
        ? role
        : "employee",
    }));
  }, [formData.jobTitle]);

  useEffect(() => {
    if (editingEmp && activeTab === "documents") {
      fetchDocuments(editingEmp.id);
    }
  }, [editingEmp, activeTab, fetchDocuments]);



  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!validateImageSize(file)) {
      e.target.value = "";
      return;
    }
    // Instant local preview - user sees image immediately before server upload
    const localPreview = URL.createObjectURL(file);
    setImagePreview(localPreview);
    try {
      setUploading(true);
      const uploadData = new FormData();
      uploadData.append("file", file);
      const res = await api.post("/employees/upload-image", uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const imageUrl = res.data?.url || res.data?.profile_image_url;
      if (!imageUrl) throw new Error("لم يتم إرجاع رابط الصورة من الخادم");
      setFormData((prev) => ({ ...prev, profileImageUrl: imageUrl }));
      // Replace blob preview with server URL (cache-busted)
      const serverUrl = imageUrl.startsWith("http") ? imageUrl : `${staticURL}${imageUrl}`;
      // Revoke old blob after server succeeds
      setTimeout(() => URL.revokeObjectURL(localPreview), 2000);
      setImagePreview(`${serverUrl}${serverUrl.includes("?") ? "&" : "?"}t=${Date.now()}`);
      toast.success("تم رفع الصورة بنجاح");
    } catch (error) {
      const apiErr = error as { response?: { data?: { detail?: unknown } }; message?: string };
      const msg = (apiErr?.response?.data?.detail as string) || apiErr?.message || "فشل رفع الصورة";
      toast.error(String(msg));
      // Keep local preview as fallback so user still sees chosen image, but mark form as not saved to server
      // Alternatively revert if needed - we keep local so UX is not broken
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const openCreate = () => {
    setEditingEmp(null);
    setFormData(defaultForm);
    setImagePreview(null);
    setCustomJobTitle(false);
    setActiveTab("personal");
    setIsModalOpen(true);
  };

  const openEdit = async (emp) => {
    try {
      setIsActionLoading(true);
      const res = await api.get(`/employees/${emp.id}`);
      const data = normalizeEmployeeRecord(res.data);
      setEditingEmp(data);
      setFormData(data);
      setCustomJobTitle(isCustomJobTitleValue(data.jobTitle));
      setImagePreview(
        data.profileImageUrl ? `${staticURL}${data.profileImageUrl}` : null,
      );
      setActiveTab("personal");
      setIsModalOpen(true);
    } catch (error) {
      const apiErr = error as { response?: { data?: { detail?: unknown } }; message?: string };
      const msg = (apiErr?.response?.data?.detail as string) || apiErr?.message || "فشل تحميل بيانات الموظف";
      toast.error(String(msg));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.phonePrimary) {
      toast.error("يرجى إدخال الاسم ورقم الجوال");
      return;
    }
    if (formData.hasLoginAccount && !formData.username) {
      toast.error("يرجى إدخال اسم المستخدم لحساب الدخول");
      return;
    }
    if (formData.hasLoginAccount && !editingEmp && !formData.password) {
      toast.error("يرجى إدخال كلمة المرور لحساب الدخول");
      return;
    }
    try {
      setIsActionLoading(true);
      // Sanitize payload: convert empty strings to null for dates, and ensure proper types
      const cleanBirth = formData.birthDate && formData.birthDate.trim() !== "" ? formData.birthDate : null;
      const cleanHire = formData.hireDate && formData.hireDate.trim() !== "" ? formData.hireDate : null;
      const payload = {
        ...formData,
        birthDate: cleanBirth,
        hireDate: cleanHire,
        profileImageUrl: formData.profileImageUrl && formData.profileImageUrl.trim() !== "" ? formData.profileImageUrl : null,
        nationalId: formData.nationalId && formData.nationalId.trim() !== "" ? formData.nationalId : null,
        assistantOfBarberId: formData.assistantOfBarberId ? parseInt(String(formData.assistantOfBarberId)) : null,
        baseSalary: Number(formData.baseSalary) || 0,
        commissionRate: Number(formData.commissionRate) || 0,
        fixedBonus: Number(formData.fixedBonus) || 0,
        defaultDeductions: Number(formData.defaultDeductions) || 0,
      };
      // Ensure password is not sent as empty string on update (keep existing)
      if (editingEmp && (!payload.password || payload.password.trim() === "")) {
         
        delete (payload as Record<string, unknown>).password;
      }

      let empId;
      if (editingEmp) {
        await api.put(`/employees/${editingEmp.id}`, payload);
        empId = editingEmp.id;
        toast.success("تم تحديث البيانات بنجاح");
      } else {
        const res = await api.post("/employees", payload);
        empId = res.data.id;
        toast.success("تم إضافة الموظف بنجاح");
      }

      // Save services (backend also handles inline, but keep for compatibility)
      if (Array.isArray((formData.serviceIds ?? [])) && (formData.serviceIds ?? []).length > 0) {
        try {
          await api.post(`/employees/${empId}/services`, (formData.serviceIds ?? []));
        } catch (_e) {
          console.warn("Services sync failed, but employee was saved:", _e);
        }
      } else if (Array.isArray((formData.serviceIds ?? [])) && (formData.serviceIds ?? []).length === 0 && editingEmp) {
        try {
          await api.post(`/employees/${empId}/services`, []);
        } catch (_e) {
          // ignore
        }
      }

      setIsModalOpen(false);
      fetchEmployees();
    } catch (_error) {
      const apiErr = _error as { response?: { data?: { detail?: unknown } }; message?: string };
      const detail = apiErr?.response?.data?.detail;
      let text = "";
      if (Array.isArray(detail)) text = detail.map((m) => m?.msg || m?.detail || JSON.stringify(m)).join(" | ");
      else if (typeof detail === "string") text = detail;
      else text = apiErr?.message || "";
      toast.error(text || "فشل حفظ البيانات - تحقق من الهاتف والبيانات المطلوبة");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!deleteTarget) return;
    try {
      setIsActionLoading(true);
      const nextStatus =
        deleteTarget.status === "active" ? "suspended" : "active";
      await api.put(`/employees/${deleteTarget.id}`, { status: nextStatus });
      toast.success("تم تحديث حالة الموظف");
      setDeleteTarget(null);
      fetchEmployees();
    } catch (_error) {
      toast.error("فشل تعديل الحالة");
    } finally {
      setIsActionLoading(false);
    }
  };

  const currentBlueprint =
    JOB_TITLE_BLUEPRINTS[formData.jobTitle ?? ""] || JOB_TITLE_BLUEPRINTS.other;

  const renderTabContent = () => {
    switch (activeTab) {
      case "personal":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col items-center gap-5">
              <div className="relative group">
                <div className="h-36 w-36 sm:h-40 sm:w-40 overflow-hidden rounded-[1.75rem] border-[5px] border-card bg-soft shadow-xl ring-1 ring-border/50">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      className="h-full w-full object-cover"
                      alt={formData?.fullName || "صورة الموظف"}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        setImagePreview(null);
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted/40 bg-gradient-to-br from-soft to-card">
                      <div className="h-14 w-14 rounded-2xl bg-card border border-border flex items-center justify-center shadow-sm">
                        <ImageIcon size={26} className="text-muted/30" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">أضف صورة</span>
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/70 backdrop-blur-sm">
                      <div className="h-8 w-8 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
                      <span className="text-[9px] font-black text-accent animate-pulse">جاري الرفع...</span>
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-accent text-white shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95 border-2 border-card">
                  {uploading ? <Activity size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={3} />}
                  <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageChange} />
                </label>
                {imagePreview && !uploading && (
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setFormData((p) => ({ ...p, profileImageUrl: "" }));
                    }}
                    className="absolute -top-2 -left-2 h-8 w-8 rounded-full bg-rose-500 text-white shadow-lg flex items-center justify-center hover:bg-rose-600 transition-colors border-2 border-card"
                    title="إزالة الصورة"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                )}
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-[17px] font-black text-main leading-tight">
                  {formData.fullName || "اسم الموظف الجديد"}
                </h3>
                <p className="text-[11px] font-bold text-accent uppercase tracking-widest flex items-center justify-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {currentBlueprint.title}
                </p>
                <p className="text-[10px] font-bold text-muted">يُفضل صورة مربعة 500×500 بصيغة JPG أو PNG</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <User size={14} /> الاسم الكامل
                </label>
                <Input
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className={FIELD_INPUT_CLASS}
                  placeholder="أدخل الاسم الثلاثي..."
                />
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Phone size={14} /> الجوال الأساسي
                </label>
                <Input
                  value={formData.phonePrimary}
                  onChange={(e) =>
                    setFormData({ ...formData, phonePrimary: e.target.value })
                  }
                  className={FIELD_INPUT_CLASS}
                  dir="ltr"
                  placeholder="01xxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <ShieldCheck size={14} /> رقم الهوية
                </label>
                <Input
                  value={formData.nationalId}
                  onChange={(e) =>
                    setFormData({ ...formData, nationalId: e.target.value })
                  }
                  className={FIELD_INPUT_CLASS}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Calendar size={14} /> تاريخ الميلاد
                </label>
                <Input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) =>
                    setFormData({ ...formData, birthDate: e.target.value })
                  }
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <MapPin size={14} /> العنوان التفصيلي
                </label>
                <Input
                  value={formData.detailedAddress}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      detailedAddress: e.target.value,
                    })
                  }
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <FileText size={14} /> نبذة مهنية (بالعربية)
                </label>
                <textarea
                  value={formData.bioAr}
                  onChange={(e) =>
                    setFormData({ ...formData, bioAr: e.target.value })
                  }
                  className={FIELD_TEXTAREA_CLASS}
                  rows={3}
                />
              </div>
            </div>
          </div>
        );
      case "work":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Briefcase size={14} /> المسمى الوظيفي
                </label>
                <Select
                  value={
                    customJobTitle || isCustomJobTitleValue(formData.jobTitle)
                      ? "__custom__"
                      : formData.jobTitle
                  }
                  onValueChange={(v) => {
                    if (v === "__custom__") {
                      setCustomJobTitle(true);
                      setFormData((prev) => ({
                        ...prev,
                        jobTitle: prev.jobTitle && isCustomJobTitleValue(prev.jobTitle) ? prev.jobTitle : "",
                        showInBooking: false,
                      }));
                    } else {
                      setCustomJobTitle(false);
                      setFormData((prev) => ({
                        ...prev,
                        jobTitle: v,
                        showInBooking: v === "barber",
                      }));
                    }
                  }}
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-72 overflow-y-auto">
                    {JOB_TITLES.map((jt) => (
                      <SelectItem key={jt.value} value={jt.value}>
                        {jt.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__" className="font-black text-accent">
                      ✍️ تسجيل يدوي (مسمى مخصص)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {(customJobTitle ||
                  isCustomJobTitleValue(formData.jobTitle)) && (
                  <Input
                    value={
                      isCustomJobTitleValue(formData.jobTitle)
                        ? formData.jobTitle
                        : ""
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        jobTitle: e.target.value,
                      })
                    }
                    className={`${FIELD_INPUT_CLASS} mt-2`}
                    placeholder="أدخل المسمى الوظيفي يدوياً (مثال: منسق ورديات)..."
                  />
                )}
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Clock size={14} /> نظام التعاقد
                </label>
                <Select
                  value={formData.employmentType}
                  onValueChange={(v) =>
                    setFormData({ ...formData, employmentType: v })
                  }
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {EMPLOYMENT_TYPES.map((et) => (
                      <SelectItem key={et.value} value={et.value}>
                        {et.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Calendar size={14} /> تاريخ الالتحاق
                </label>
                <Input
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) =>
                    setFormData({ ...formData, hireDate: e.target.value })
                  }
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Activity size={14} /> الحالة الوظيفية
                </label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem
                      value="active"
                      className="text-emerald-600 font-bold"
                    >
                      نشط
                    </SelectItem>
                    <SelectItem
                      value="suspended"
                      className="text-rose-600 font-bold"
                    >
                      معلّق
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-soft border border-border">
                <div>
                  <div className="text-xs font-black text-main">
                    الظهور في نقطة البيع
                  </div>
                  <div className="text-[10px] font-bold text-muted">
                    إتاحة الموظف في شاشة الدفع
                  </div>
                </div>
                <Switch
                  checked={formData.showInPos}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, showInPos: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-soft border border-border">
                <div>
                  <div className="text-xs font-black text-main">
                    الظهور في الحجوزات
                  </div>
                  <div className="text-[10px] font-bold text-muted">
                    إتاحة الموظف لجدولة المواعيد
                  </div>
                </div>
                <Switch
                  checked={formData.showInBooking}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, showInBooking: v })
                  }
                />
              </div>
            </div>
          </div>
        );
      case "skills":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="p-6 rounded-[2rem] bg-accent/5 border border-accent/10 flex items-center gap-6">
              <div className="h-16 w-16 rounded-2xl bg-accent text-white flex items-center justify-center shadow-lg shrink-0">
                <Scissors size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-main">
                  المؤهلات والخدمات
                </h3>
                <p className="text-xs font-bold text-muted mt-1">
                  حدد الخدمات التي يتقنها الموظف ليتم عرضها له ديناميكياً في
                  شاشة الـ POS والحجوزات.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
              {allServices.map((service) => (
                <button
                  key={service.id}
                  onClick={() => {
                    const currentIds = (formData.serviceIds as (string | number)[]) ?? [];
                    const sid = service.id as string | number;
                    const next = currentIds.includes(sid)
                      ? currentIds.filter((id) => id !== sid)
                      : [...currentIds, sid];
                    setFormData({ ...formData, serviceIds: next });
                  }}
                  className={cn(
                    "flex flex-col p-4 rounded-2xl border transition-all text-right group",
                    ((formData.serviceIds as (string | number)[]) ?? []).includes(service.id as string | number)
                      ? "bg-accent border-accent text-white shadow-lg shadow-accent/20"
                      : "bg-card border-border hover:border-accent/40",
                  )}
                >
                  <div
                    className={cn(
                      "text-[13px] font-black",
                      ((formData.serviceIds as (string | number)[]) ?? []).includes(service.id as string | number)
                        ? "text-white"
                        : "text-main group-hover:text-accent",
                    )}
                  >
                    {service.name_ar || service.name}
                  </div>
                  <div
                    className={cn(
                      "text-[10px] font-bold mt-1",
                      ((formData.serviceIds as (string | number)[]) ?? []).includes(service.id as string | number)
                        ? "text-white/70"
                        : "text-muted",
                    )}
                  >
                    {service.category} • {service.price} ج.م
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      case "financial":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <DollarSign size={14} /> الراتب الأساسي
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    value={formData.baseSalary}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        baseSalary: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={`${FIELD_INPUT_CLASS} pr-12`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted">
                    ج.م
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <TrendingUp size={14} /> نسبة العمولة
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    value={formData.commissionRate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commissionRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={`${FIELD_INPUT_CLASS} pr-12`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Plus size={14} /> حوافز ثابتة
                </label>
                <Input
                  type="number"
                  value={formData.fixedBonus}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fixedBonus: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Trash2 size={14} /> خصومات دورية
                </label>
                <Input
                  type="number"
                  value={formData.defaultDeductions}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultDeductions: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Wallet size={14} /> قناة صرف المستحقات
                </label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(v) =>
                    setFormData({ ...formData, paymentMethod: v })
                  }
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="cash">نقدي (Cash)</SelectItem>
                    <SelectItem value="wallet">
                      محفظة إلكترونية (Wallet)
                    </SelectItem>
                    <SelectItem value="bank">تحويل بنكي (Bank)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );
      case "assistant":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            {formData.jobTitle !== "barber_assistant" && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-4 text-amber-700">
                <Activity className="shrink-0" />
                <p className="text-xs font-bold leading-relaxed">
                  هذا القسم مخصص فقط للموظفين الذين يعملون بصفة "مساعد حلاق"
                  لتحديد المشرف والمهام.
                </p>
              </div>
            )}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  المشرف المباشر (الخبير)
                </label>
                <Select
                  value={String(formData.assistantOfBarberId ?? "")}
                  onValueChange={(v) =>
                    setFormData({ ...formData, assistantOfBarberId: v })
                  }
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS}>
                    <SelectValue placeholder="اختر الخبير المسؤول..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {employees
                      .filter((e) => e.jobTitle === "barber")
                      .map((b) => (
                        <SelectItem key={String(b.id ?? "")} value={(b.id ?? "").toString()}>
                          {b.fullName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <label className={FIELD_LABEL_CLASS}>المهام التشغيلية</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ASSISTANT_TASKS.map((task) => (
                    <button
                      key={task}
                      onClick={() => {
                        const next = (formData.assistantTasksJson ?? []).includes(task)
                          ? (formData.assistantTasksJson ?? []).filter(
                              (t) => t !== task,
                            )
                          : [...(formData.assistantTasksJson ?? []), task];
                        setFormData({ ...formData, assistantTasksJson: next });
                      }}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black border transition-all",
                        (formData.assistantTasksJson ?? []).includes(task)
                          ? "bg-accent text-white border-accent shadow-lg shadow-accent/20"
                          : "bg-card text-muted border-border hover:bg-soft",
                      )}
                    >
                      {task}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      case "system":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between p-6 rounded-2xl bg-accent text-white shadow-xl shadow-accent/20">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                  <Fingerprint size={24} />
                </div>
                <div>
                  <div className="text-sm font-black uppercase tracking-widest">
                    حساب دخول الموظف
                  </div>
                  <div className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                    تفعيل الصلاحيات التقنية للمنظومة
                  </div>
                </div>
              </div>
              <Switch
                checked={formData.hasLoginAccount}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, hasLoginAccount: v })
                }
                className="data-[state=checked]:bg-white data-[state=checked]:text-accent"
              />
            </div>

            {formData.hasLoginAccount && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-3xl border border-border bg-soft/50">
                <div className="space-y-2">
                  <label className={FIELD_LABEL_CLASS}>اسم المستخدم</label>
                  <Input
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className={FIELD_INPUT_CLASS}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <label className={FIELD_LABEL_CLASS}>كلمة المرور</label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className={FIELD_INPUT_CLASS}
                    dir="ltr"
                    placeholder={
                      editingEmp ? "••••••••" : "أدخل كلمة المرور..."
                    }
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className={FIELD_LABEL_CLASS}>مستوى الوصول</label>
                  <Select
                    value={formData.role}
                    onValueChange={(v) => setFormData({ ...formData, role: v })}
                  >
                    <SelectTrigger className={FIELD_SELECT_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className={FIELD_LABEL_CLASS}>ملاحظات إدارية</label>
              <textarea
                value={formData.personalNotes}
                onChange={(e) =>
                  setFormData({ ...formData, personalNotes: e.target.value })
                }
                className={FIELD_TEXTAREA_CLASS}
                rows={4}
              />
            </div>
          </div>
        );
      case "documents":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="p-6 rounded-[2rem] bg-accent/5 border border-accent/10 flex flex-col md:flex-row items-center gap-6">
              <div className="h-16 w-16 rounded-2xl bg-accent text-white flex items-center justify-center shadow-lg shrink-0">
                <Archive size={32} />
              </div>
              <div className="flex-1 text-center md:text-right">
                <h3 className="text-xl font-black text-main">
                  الخزنة الرقمية (Digital Vault)
                </h3>
                <p className="text-xs font-bold text-muted mt-1">
                  أرشفة احترافية لعقود الموظفين، الهويات، والشهادات الصحية مع
                  تتبع تلقائي للصلاحية.
                </p>
              </div>
              <Button
                onClick={() => (document.getElementById("doc-upload") as HTMLInputElement | null)?.click()}
                className="h-12 px-6 rounded-xl bg-accent font-black text-xs uppercase tracking-widest shadow-lg shadow-accent/20"
              >
                <Plus size={18} className="ml-2" /> رفع مستند جديد
                <input
                  id="doc-upload"
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const title = prompt(
                        "عنوان المستند (مثلاً: عقد العمل 2026):",
                      );
                      const type = prompt(
                        "نوع المستند (ID, CONTRACT, HEALTH, CERTIFICATE):",
                        "CONTRACT",
                      );
                      const expiry = prompt(
                        "تاريخ الانتهاء (YYYY-MM-DD) - اختياري:",
                      );

                      const fd = new FormData();
                      fd.append("file", file);
                      fd.append("title", title || file.name);
                      fd.append("file_type", type || "OTHER");
                      if (expiry) fd.append("expiry_date", expiry);

                      if (!editingEmp?.id) {
                        toast.error("اختر موظفًا أولًا");
                        return;
                      }
                      try {
                        setDocLoading(true);
                        await employeeDocumentService.upload(editingEmp.id, fd);
                        toast.success("تم أرشفة المستند بنجاح");
                        fetchDocuments(editingEmp.id);
                      } catch (_err) {
                        toast.error("فشل رفع المستند");
                      } finally {
                        setDocLoading(false);
                      }
                    }
                  }}
                />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {docLoading ? (
                <div className="flex justify-center p-12">
                  <Activity className="animate-spin text-accent" size={32} />
                </div>
              ) : employeeDocs.length > 0 ? (
                employeeDocs.map((doc: DocumentRecord) => (
                  <div
                    key={doc.id}
                    className="group flex items-center justify-between p-5 rounded-[2rem] bg-card border border-border hover:border-accent/40 hover:shadow-xl hover:shadow-accent/5 transition-all"
                  >
                    <div className="flex items-center gap-5">
                      <div className="h-12 w-12 rounded-xl bg-soft text-muted flex items-center justify-center group-hover:bg-accent/5 group-hover:text-accent transition-colors">
                        <FileText size={24} />
                      </div>
                      <div>
                        <div className="text-sm font-black text-main">
                          {(doc as DocumentRecord).title || ""}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge
                            variant="outline"
                            className="rounded-lg px-2 py-0 text-[8px] font-black uppercase tracking-widest border-border text-muted"
                          >
                            {(doc as DocumentRecord).file_type || "OTHER"}
                          </Badge>
                          {doc.expiry_date && (
                            <div
                              className={cn(
                                "flex items-center gap-1 text-[9px] font-bold",
                                new Date(doc.expiry_date) < new Date()
                                  ? "text-rose-500"
                                  : "text-emerald-600",
                              )}
                            >
                              <Clock size={10} /> ينتهي في:{" "}
                              {new Date(doc.expiry_date).toLocaleDateString(
                                "ar-EG",
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          window.open(`${staticURL}${doc.file_url}`, "_blank")
                        }
                        className="h-10 w-10 rounded-xl text-muted hover:bg-accent/5 hover:text-accent"
                      >
                        <Eye size={18} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (confirm("هل أنت متأكد من حذف هذا المستند؟")) {
                            try {
                              await employeeDocumentService.remove(doc.id);
                              toast.success("تم الحذف");
                              if (editingEmp?.id) fetchDocuments(editingEmp.id);
                            } catch (_err) {
                              toast.error("فشل الحذف");
                            }
                          }
                        }}
                        className="h-10 w-10 rounded-xl text-muted hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-12 rounded-[2rem] border-2 border-dashed border-border/40">
                  <Archive className="mx-auto text-muted/20 mb-4" size={48} />
                  <p className="text-xs font-bold text-muted">
                    لا يوجد مستندات مؤرشفة لهذا الموظف حتى الآن.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      case "review":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-3">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent">
                <CheckCircle2
                  size={48}
                  strokeWidth={3}
                  className="animate-bounce"
                />
              </div>
              <h3 className="text-2xl font-black text-main">
                مراجعة البيانات النهائية
              </h3>
              <p className="text-sm font-bold text-muted">
                يرجى التدقيق في بيانات الكادر قبل الاعتماد النهائي.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-3xl border border-border bg-soft/30 p-6 space-y-4">
                <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] border-b border-border pb-2">
                  الهوية والعمل
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">الاسم:</span>
                    <span className="text-xs font-black text-main">
                      {formData.fullName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      المسمى:
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-black uppercase"
                    >
                      {isCustomJobTitleValue(formData.jobTitle) && formData.jobTitle
                        ? formData.jobTitle
                        : currentBlueprint.title}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      الجوال:
                    </span>
                    <span className="text-xs font-black text-main" dir="ltr">
                      {formData.phonePrimary}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-soft/30 p-6 space-y-4">
                <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] border-b border-border pb-2">
                  الهيكل المالي
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      الراتب الأساسي:
                    </span>
                    <span className="text-xs font-black text-emerald-600">
                      {Number(formData.baseSalary ?? 0).toLocaleString()} ج.م
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      العمولة:
                    </span>
                    <span className="text-xs font-black text-main">
                      {formData.commissionRate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      طريقة الصرف:
                    </span>
                    <span className="text-xs font-black text-main uppercase">
                      {formData.paymentMethod}
                    </span>
                  </div>
                </div>
              </div>

              {formData.hasLoginAccount && (
                <div className="md:col-span-2 rounded-3xl border border-accent/20 bg-accent/5 p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-accent text-white flex items-center justify-center">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-main">
                        حساب النظام جاهز
                      </h4>
                      <p className="text-[10px] font-bold text-muted">
                        اسم المستخدم:{" "}
                        <span className="font-black text-accent">
                          {formData.username}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-accent text-white font-black text-[9px] uppercase tracking-widest">
                    {formData.role} ACCESS
                  </Badge>
                </div>
              )}
            </div>

            {!formData.hasLoginAccount &&
              ["manager", "accountant", "cashier"].includes(
                formData.jobTitle ?? "",
              ) && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-4 text-rose-600 animate-pulse">
                  <ShieldAlert size={20} />
                  <p className="text-[11px] font-black">
                    تحذير: لا يمكن لهذا الدور العمل بدون حساب نظام. يرجى العودة
                    لخطوة "بوابة النظام".
                  </p>
                </div>
              )}
          </div>
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
    <div className="erp-page space-y-8 pb-20" dir="rtl">
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

      {/* ═══ EXPIRING DOCUMENTS ALERT ═══ */}
      {expiringDocs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-6 rounded-[2.5rem] bg-rose-600 text-white shadow-xl shadow-rose-200 flex items-center justify-between border-4 border-white/20"
        >
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center animate-pulse">
              <ShieldAlert size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black">تنبيه صلاحية المستندات</h3>
              <p className="text-xs font-bold opacity-80 mt-1">
                يوجد {expiringDocs.length} مستندات شارفت على الانتهاء خلال الـ
                15 يوماً القادمة.
              </p>
            </div>
          </div>
          <div className="flex -space-x-4 space-x-reverse">
            {expiringDocs.slice(0, 3).map((doc: DocumentRecord, i) => (
              <div
                key={i}
                title={`${doc.employeeName}: ${doc.title}`}
                className="h-12 w-12 rounded-xl border-4 border-rose-600 bg-white text-rose-600 flex items-center justify-center font-black text-xs shadow-lg"
              >
                {(doc as DocumentRecord).employeeName?.substring(0, 1)}
              </div>
            ))}
            {expiringDocs.length > 3 && (
              <div className="h-12 w-12 rounded-xl border-4 border-rose-600 bg-slate-900 text-white flex items-center justify-center font-black text-[10px] shadow-lg">
                +{expiringDocs.length - 3}
              </div>
            )}
          </div>
        </motion.div>
      )}

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
              className="h-11 rounded-2xl border-border bg-card/50 px-8 text-sm font-black text-main transition-all hover:border-accent/20"
            >
              <Archive className="ml-2" size={20} /> الأرشيف الرقمي
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الكادر"
          value={stats.total}
          icon={Users}
          variant="secondary"
          delay={0}
        />
        <StatCard
          label="نشط حالياً"
          value={stats.active}
          icon={CheckCircle2}
          variant="success"
          delay={0.05}
        />
        <StatCard
          label="خبراء الحلاقة"
          value={stats.barbers}
          icon={Scissors}
          variant="warning"
          delay={0.1}
        />
        <StatCard
          label="فريق الدعم"
          value={stats.assistants}
          icon={UserPlus}
          variant="primary"
          delay={0.15}
        />
      </div>

      {/* ═══ FILTER & SEARCH ═══ */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md group">
          <Search
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors"
            size={18}
          />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث باسم الموظف أو المسمى الوظيفي..."
            className="h-14 rounded-2xl border-border bg-card/80 pr-12 text-sm font-bold shadow-sm focus:border-accent focus:bg-card"
          />
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-card/60 border border-border p-1.5 shadow-sm">
          <button
            onClick={() => setActiveView("cards")}
            className={cn(
              "flex h-11 items-center gap-2 rounded-xl px-5 text-[11px] font-black transition-all",
              activeView === "cards"
                ? "bg-accent text-white shadow-lg"
                : "text-muted hover:bg-card",
            )}
          >
            <LayoutGrid size={16} /> عرض الشبكة
          </button>
          <button
            onClick={() => setActiveView("table")}
            className={cn(
              "flex h-11 items-center gap-2 rounded-xl px-5 text-[11px] font-black transition-all",
              activeView === "table"
                ? "bg-accent text-white shadow-lg"
                : "text-muted hover:bg-card",
            )}
          >
            <ListIcon size={16} /> عرض القائمة
          </button>
        </div>
      </div>

      {/* ═══ EMPLOYEE CONTENT ═══ */}
      <AnimatePresence mode="wait">
        {activeView === "cards" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {filteredEmployees.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  icon={Users}
                  title="لا يوجد كوادر مطابقة"
                  description="جرب تعديل كلمات البحث أو أضف موظفاً جديداً للمنظومة."
                  action={
                    <Button onClick={openCreate} className="rounded-xl bg-accent text-white font-black">
                      <Plus size={16} className="ml-2"/> إضافة موظف جديد
                    </Button>
                  }
                />
              </div>
            ) : filteredEmployees.map((emp) => {
              const bp =
                JOB_TITLE_BLUEPRINTS[emp.jobTitle ?? ""] ||
                JOB_TITLE_BLUEPRINTS.other;
              const statusActive = emp.status === "active";
              return (
                <motion.div
                  key={emp.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4 }}
                  className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-soft hover:shadow-premium transition-all duration-300"
                >
                  {/* Top accent bar */}
                  <div className={cn("h-1.5 w-full", bp.accent)} />
                  {/* Hover glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent pointer-events-none" />
                  <div className="relative flex flex-1 flex-col p-6 sm:p-7 gap-5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 gap-4">
                        <div className="relative shrink-0">
                          <div className="rounded-2xl ring-2 ring-border/50 shadow-lg overflow-hidden bg-soft">
                            <EmployeeAvatar
                              imageUrl={emp.profileImageUrl || emp.profile_image_url}
                              name={emp.fullName}
                              size="xl"
                              className=""
                            />
                          </div>
                          <div className={cn("absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-[3px] border-card shadow-md flex items-center justify-center", statusActive ? "bg-emerald-500" : "bg-rose-500")}>
                            <div className={cn("h-2 w-2 rounded-full bg-white", statusActive && "animate-pulse")} />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <h3 className="text-[15px] sm:text-[17px] font-black text-main leading-tight line-clamp-1">
                            {emp.fullName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border",
                                isCustomJobTitleValue(emp.jobTitle)
                                  ? "bg-accent/10 text-accent border-accent/20"
                                  : bp.badgeClass,
                              )}
                            >
                              {isCustomJobTitleValue(emp.jobTitle) && emp.jobTitle ? emp.jobTitle : bp.title}
                            </Badge>
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black border", statusActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200")}>
                              {statusActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />} {statusActive ? "نشط" : "معلّق"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-muted">
                            <span className="inline-flex items-center gap-1"><Calendar size={11} /> {emp.hireDate ? new Date(emp.hireDate).toLocaleDateString("ar-EG") : "—"}</span>
                            {emp.employmentType && <span className="hidden sm:inline">• {EMPLOYMENT_TYPES.find(t=>t.value===emp.employmentType)?.label || emp.employmentType}</span>}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-soft text-muted hover:bg-card hover:text-accent border border-border/50 shrink-0">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-border shadow-premium bg-card">
                          <DropdownMenuItem onClick={() => openEdit(emp)} className="rounded-xl font-bold py-3">
                            <Pencil size={16} className="ml-3 text-accent" /> تعديل الملف
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/owner/payroll?employeeId=${emp.id}`)} className="rounded-xl font-bold py-3">
                            <DollarSign size={16} className="ml-3 text-emerald-600" /> كشف الراتب
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/attendance?employeeId=${emp.id}`)} className="rounded-xl font-bold py-3">
                            <Clock size={16} className="ml-3 text-sky-600" /> سجل الحضور
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEmployeeQuickView(emp.id as string | number)} className="rounded-xl font-bold py-3">
                            <Eye size={16} className="ml-3 text-indigo-600" /> عرض سريع
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-2" />
                          <DropdownMenuItem onClick={() => setDeleteTarget(emp)} className="rounded-xl font-bold py-3 text-rose-600">
                            <XCircle size={16} className="ml-3" /> {emp.status === "active" ? "تعطيل الملف" : "تفعيل الملف"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Decorative separator */}
                    <div className="h-px bg-gradient-to-r from-border via-border/50 to-transparent" />

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="group/stat rounded-2xl bg-soft border border-border/60 p-3 sm:p-4 hover:border-accent/20 hover:bg-card transition-colors">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center"><Wallet size={14} /></div>
                          <span className="text-[9px] font-black text-muted uppercase tracking-widest">الراتب الأساسي</span>
                        </div>
                        <div className="text-[15px] font-black text-main">
                          {Number(emp.baseSalary).toLocaleString("ar-EG")} <span className="text-[10px] font-bold text-muted">ج.م</span>
                        </div>
                      </div>
                      <div className="group/stat rounded-2xl bg-soft border border-border/60 p-3 sm:p-4 hover:border-accent/20 hover:bg-card transition-colors">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center"><TrendingUp size={14} /></div>
                          <span className="text-[9px] font-black text-muted uppercase tracking-widest">العمولة</span>
                        </div>
                        <div className="text-[15px] font-black text-main">
                          {emp.commissionRate} <span className="text-[10px] font-bold text-muted">%</span>
                        </div>
                      </div>
                    </div>

                    {/* Contact & Actions */}
                    <div className="mt-auto space-y-3">
                      <div className="flex items-center gap-3 rounded-2xl bg-accent/[0.06] border border-accent/10 p-3">
                        <div className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center shadow-sm shrink-0">
                          <Phone size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-black text-muted uppercase tracking-widest">الجوال الأساسي</div>
                          <div className="text-[13px] font-black text-main truncate" dir="ltr">{emp.phonePrimary}</div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(emp)} className="h-9 w-9 rounded-xl bg-card border border-border text-muted hover:text-accent hover:border-accent/20 shrink-0">
                          <Pencil size={14} />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => openEmployeeQuickView(emp.id as string | number)} className="flex-1 h-10 rounded-xl bg-soft hover:bg-accent hover:text-white text-main font-black text-[11px] border border-border transition-all">
                          <Eye size={14} className="ml-2" /> معاينة
                        </Button>
                        <Button onClick={() => openEdit(emp)} className="flex-1 h-10 rounded-xl bg-accent text-white font-black text-[11px] shadow-lg shadow-accent/20 hover:bg-accent/90">
                          <Pencil size={14} className="ml-2" /> تعديل
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <PremiumCard noPadding className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right min-w-[700px]">
                <thead>
                  <tr className="border-b border-border bg-soft/50">
                    <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">
                      الموظف
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">
                      المسمى
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">
                      الجوال
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">
                      الراتب
                    </th>
                    <th className="px-8 py-6 text-center text-[10px] font-black text-muted uppercase tracking-widest">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="group transition-colors hover:bg-soft/30"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <EmployeeAvatar
                            imageUrl={
                              emp.profileImageUrl || emp.profile_image_url
                            }
                            name={emp.fullName}
                            size="sm"
                          />
                          <div className="font-black text-main">
                            {emp.fullName}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <Badge
                          variant="outline"
                          className="rounded-full px-3 py-1 text-[9px] font-black bg-card"
                        >
                          {getJobTitleLabel(emp.jobTitle)}
                        </Badge>
                      </td>
                      <td className="px-8 py-5 font-bold text-muted" dir="ltr">
                        {emp.phonePrimary}
                      </td>
                      <td className="px-8 py-5 font-black text-main">
                        {Number(emp.baseSalary ?? 0).toLocaleString("ar-EG")} ج.م
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(emp)}
                            className="h-10 w-10 rounded-xl text-accent hover:bg-accent/10"
                          >
                            <Pencil size={18} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              navigate(`/owner/payroll?employeeId=${emp.id}`)
                            }
                            className="h-10 w-10 rounded-xl text-emerald-600 hover:bg-emerald-50"
                          >
                            <DollarSign size={18} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(emp)}
                            className="h-10 w-10 rounded-xl text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={18} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </PremiumCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ EMPLOYEE WIZARD MODAL ═══ */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="flex h-[100dvh] sm:h-[94vh] w-[100vw] sm:w-[96vw] max-w-350 flex-col overflow-hidden rounded-none sm:rounded-[2rem] border-0 bg-card p-0 shadow-[0_50px_150px_-30px_rgba(0,0,0,0.4)]"
          dir="rtl"
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
              className="h-12 w-12 rounded-2xl bg-soft text-muted transition-all hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center"
            >
              <X size={24} strokeWidth={3} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* LEFT: Live Preview - Professional & Responsive */}
            <aside className="hidden w-[380px] xl:flex flex-col border-l border-border bg-gradient-to-b from-card to-soft/30 p-6 lg:p-8 backdrop-blur-md overflow-y-auto custom-scrollbar">
              <div className="mb-6 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/15 px-3 py-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
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
                    <div className={cn("absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full border-[3px] border-card shadow-md flex items-center justify-center text-white", formData.status === "active" ? "bg-emerald-500" : "bg-rose-500") }>
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
                        <div className={cn("h-2 w-2 rounded-full", formData.status==="active"?"bg-emerald-500 animate-pulse":"bg-rose-500")} />
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
                <div className="rounded-2xl bg-slate-900 dark:bg-slate-800 p-4 text-white shadow-lg relative overflow-hidden">
                  <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/5" />
                  <div className="relative flex items-center gap-2.5 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center"><Building2 size={14} /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">موجز الدور</span>
                  </div>
                  <p className="relative text-[11px] font-medium leading-relaxed text-slate-300 line-clamp-3">{currentBlueprint.summary}</p>
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
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-black whitespace-nowrap transition-all shrink-0", isActive ? "bg-accent text-white border-accent shadow-md" : isPast ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-card text-muted border-border")}>
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
                      <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full font-black border", formData.status==="active"?"bg-emerald-500 text-white border-emerald-500":"bg-rose-500 text-white border-rose-500")}>{formData.status==="active"?"نشط":"معلّق"}</span>
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
                <Button onClick={handleSubmit} disabled={isActionLoading || activeTab !== "review"} className={cn("h-12 w-full rounded-xl font-black text-white shadow-lg", activeTab==="review" ? "bg-accent hover:bg-accent/90 shadow-accent/20" : "bg-slate-300 opacity-60 cursor-not-allowed")}>
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
                              ? "bg-emerald-500 text-white"
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
                      : "bg-slate-300 cursor-not-allowed opacity-50",
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
