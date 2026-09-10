import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { CheckCircle2 } from "lucide-react";
import api, { staticURL } from "@/services/api";
import { validateImageSize } from "@/lib/media/upload";
import {
  FORM_TABS,
  JOB_TITLE_BLUEPRINTS,
  defaultForm,
} from "@/features/hr/utils/constants";
import { isCustomJobTitleValue } from "@/features/hr/utils/helpers";
import { normalizeEmployeeRecord } from "@/features/hr/utils/helpers";
import type { EmployeeRecord } from "@/types/employee";

/**
 * Employee form wizard state: modal, tabs, image upload, submit and
 * status toggle. Extracted from pages/owner/HRManagement (Phase 3).
 */
export function useEmployeeForm(fetchEmployees: () => Promise<void>) {
  const [activeTab, setActiveTab] = useState("personal");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<EmployeeRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRecord | null>(null);
  const [formData, setFormData] = useState<EmployeeRecord>(
    defaultForm as EmployeeRecord,
  );
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
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

  const handleImageChange = async (e: any) => {
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

  const openEdit = async (emp: any) => {
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

  return {
    activeTab,
    setActiveTab,
    isModalOpen,
    setIsModalOpen,
    editingEmp,
    setEditingEmp,
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
  };
}
