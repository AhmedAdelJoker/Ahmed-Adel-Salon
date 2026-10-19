import { useMemo, useState, useCallback, useEffect } from "react";
import { toast } from "react-hot-toast";
import { CheckCircle2 } from "lucide-react";
import api, { staticURL } from "@/services/api";
import { validateImageSize } from "@/lib/media/upload";
import {
  visibleFormTabs,
  hiddenFormSteps,
  JOB_TITLE_BLUEPRINTS,
  defaultForm,
} from "@/features/hr/utils/constants";
import {
  SERVICE_PROVIDER_JOB_TITLES,
  isCustomJobTitleValue,
  isServiceProviderJobTitle,
  normalizeEmployeeRecord,
} from "@/features/hr/utils/helpers";
import {
  validatePhone,
  validateEmployeeEmail,
  findPhoneConflict,
  phoneDigits,
} from "@/features/hr/utils/phone";
import { analyzeNationalId, findNationalIdConflict } from "@/features/hr/utils/nationalId";
import {
  validatePersonName,
  validateUsername,
  validateMoney,
  validateCommission,
  validateBankAccount,
  passwordRequirements,
} from "@/features/hr/utils/validators";
import {
  collectEmployeeFormIssues,
  issuesForStep,
} from "@/features/hr/utils/formIssues";
import {
  readEmployeeDraft,
  writeEmployeeDraft,
  clearEmployeeDraft,
  formIsWorthKeeping,
  type EmployeeDraft,
} from "@/features/hr/utils/draft";
import type { EmployeeRecord } from "@/types/employee";

/**
 * The system roles the backend accepts, and which job title maps to each.
 *
 * `UserRole` in the backend is `owner, admin, manager, cashier, barber,
 * accountant` — there is no `employee` and no `barber_assistant`. Sending
 * either made `create_employee` raise 400 "الدور غير صالح" for *every* employee
 * whose job title was not manager/accountant/cashier/owner, which is the
 * default: adding a barber with a login account could not succeed at all.
 *
 * A job title with no natural system role maps to `barber`; the owner can then
 * change it in the System tab.
 */
const JOB_TITLE_TO_USER_ROLE: Record<string, string> = {
  owner: "owner",
  manager: "manager",
  accountant: "accountant",
  cashier: "cashier",
  barber: "barber",
  colorist: "barber",
  esthetician: "barber",
  barber_assistant: "barber",
  receptionist: "cashier",
  cleaner: "barber",
  other: "barber",
};

/** Mirrors `UserRole` in `app/core/roles.py`. */
const VALID_USER_ROLES = new Set([
  "owner",
  "admin",
  "manager",
  "cashier",
  "barber",
  "accountant",
]);

/**
 * Employee form wizard state: modal, tabs, image upload, submit and
 * status toggle. Extracted from pages/owner/HRManagement (Phase 3).
 */
export function useEmployeeForm(fetchEmployees: () => Promise<void>) {
  const [activeTab, setActiveTab] = useState("personal");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<EmployeeRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRecord | null>(null);
  // Moving someone to the archive (they left the salon) is a separate,
  // heavier decision than "on vacation": distinct target and confirmation.
  const [archiveTarget, setArchiveTarget] = useState<EmployeeRecord | null>(null);
  const [formData, setFormData] = useState<EmployeeRecord>(
    defaultForm as EmployeeRecord,
  );
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [customJobTitle, setCustomJobTitle] = useState(false);
  // A resume offer for an unfinished new-employee form, and when the current
  // draft was written (for the "saved" note beside the button).
  const [draftOffer, setDraftOffer] = useState<EmployeeDraft | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  // Dynamic Tabs based on Role
  const DYNAMIC_TABS = useMemo(() => {
    const visible = visibleFormTabs(formData.jobTitle);

    // Add Review step at the end
    return [
      ...visible,
      {
        id: "review" as const,
        label: "مراجعة واعتماد",
        icon: CheckCircle2,
      },
    ];
  }, [formData.jobTitle]);

  // The steps this job title does not ask for, with the reason for each, so the
  // wizard can explain the shrinking stepper instead of leaving a hole in it.
  const hiddenSteps = useMemo(
    () => hiddenFormSteps(formData.jobTitle),
    [formData.jobTitle],
  );

  /*
    Everything currently wrong, per step, from one pure function — the same
    answer feeds the red dots on the stepper, the "next" gate below and a final
    re-check at submit, so the three can never disagree about the form.
  */
  const stepIssues = useMemo(
    () => collectEmployeeFormIssues(formData),
    [formData],
  );

  /**
   * Advance one step, refusing when the current step has something wrong.
   *
   * Before this, "next" always moved forward: an invalid phone or an impossible
   * national id was carried all the way to the review screen, and the owner
   * found out at the save, with no indication of which step to walk back to.
   * The first message is shown as a toast; the offending step also carries a
   * red dot on the stepper.
   */
  const goNext = useCallback(() => {
    const idx = DYNAMIC_TABS.findIndex((t) => t.id === activeTab);
    if (idx < 0 || idx >= DYNAMIC_TABS.length - 1) return;
    const problems = issuesForStep(stepIssues, activeTab);
    if (problems.length > 0) {
      toast.error(problems[0]);
      return;
    }
    setActiveTab(DYNAMIC_TABS[idx + 1].id);
  }, [activeTab, DYNAMIC_TABS, stepIssues]);

  /*
    Job title drives which steps exist, but the owner can change it *after*
    landing on one of them: pick "barber", fill in skills, then change the title
    to "manager" in the Work tab. The step disappears from the stepper while
    `activeTab` still points at it — the body kept rendering a step with no way
    to reach it, and the footer's indexOf returned -1, so "previous" dereferenced
    `tabs[-2]` and blew up. Land on the work step, which is where the change was
    just made.
  */
  useEffect(() => {
    if (activeTab === "review") return;
    if (visibleFormTabs(formData.jobTitle).some((tab) => tab.id === activeTab)) return;
    setActiveTab("work");
  }, [activeTab, formData.jobTitle]);

  // Role auto-configuration — applied ONLY when the user actively picks a job
  // title (WorkTab calls applyJobTitleDefaults). It used to live in a
  // [formData.jobTitle] effect, which also fired when openEdit populated the
  // form, wiping the owner's saved showInPos/showInBooking/role choices with
  // job-title defaults on every edit — and re-deriving on every keystroke of
  // a custom title.
  const applyJobTitleDefaults = useCallback((role: string) => {
    setFormData((prev) => ({
      ...prev,
      jobTitle: role,
      // Booking and POS visibility are classification decisions, not free
      // toggles: only service providers can be on the public booking site,
      // and the till adds cashiers to that list.
      showInBooking: SERVICE_PROVIDER_JOB_TITLES.includes(role),
      showInPos: [...SERVICE_PROVIDER_JOB_TITLES, "cashier"].includes(role),
      hasLoginAccount:
        prev.hasLoginAccount ||
        ["manager", "accountant", "cashier", "owner"].includes(role),
      // A job title with no natural system role still needs a valid one, or
      // the backend refuses the whole create. `role` is the *system* role, not
      // the job title, and the two are not the same list.
      role: JOB_TITLE_TO_USER_ROLE[role] || "barber",
    }));
  }, []);

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
      /*
        Revert the preview. It was a local object URL that never reached the
        server, and leaving it up showed an image that was not stored — the
        owner would save the form believing the photo was attached, and it would
        be gone. An honest "no image" plus an error beats a silent loss.
      */
      URL.revokeObjectURL(localPreview);
      setImagePreview(null);
      setFormData((prev) => ({ ...prev, profileImageUrl: "" }));
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
    // Ask after the dialog is up, not before: a resume prompt shown while the
    // owner is still deciding would be an interruption, not an offer.
    setDraftOffer(readEmployeeDraft());
  };

/*
    Closing a half-filled new-employee form is the case worth protecting. Seven
    steps, a salary and a commission — all lost to a misclick on the X. Only
    for a create: editing has the saved row to fall back on, and a stale local
    copy silently overwriting a colleague's later correction is a worse failure
    than retyping.

    This writes the *live* form, not whatever was last explicitly saved. The
    work exists in component state whether or not anyone pressed the button, and
    an owner who closes the dialog mid-way through has just demonstrated that
    they mean to come back.
  */
  const keepDraftOnClose = useCallback(() => {
    if (editingEmp) return;
    if (!formIsWorthKeeping(formData as unknown as Record<string, unknown>, customJobTitle)) {
      return;
    }
    if (writeEmployeeDraft({ formData: formData as unknown as Record<string, unknown>, activeTab, customJobTitle })) {
      setDraftSavedAt(new Date().toISOString());
    }
  }, [editingEmp, formData, activeTab, customJobTitle]);

  const saveDraft = useCallback(() => {
    if (editingEmp) return false;
    const ok = writeEmployeeDraft({
      formData: formData as unknown as Record<string, unknown>,
      activeTab,
      customJobTitle,
    });
    if (ok) {
      setDraftSavedAt(new Date().toISOString());
      setDraftOffer(null);
      setIsModalOpen(false);
    }
    return ok;
  }, [editingEmp, formData, activeTab, customJobTitle]);

  const resumeDraft = useCallback(() => {
    const draft = readEmployeeDraft();
    if (!draft) return;
    // Merge onto `defaultForm`, not onto whatever the form currently holds: a
    // field added to the form after the draft was written would otherwise stay
    // undefined and submit as `undefined`.
    setFormData({ ...defaultForm, ...draft.formData } as EmployeeRecord);
    setCustomJobTitle(draft.customJobTitle);
    setActiveTab(draft.activeTab || "personal");
    setIsModalOpen(true);
    setDraftOffer(null);
  }, []);

  const dismissDraft = useCallback(() => {
    clearEmployeeDraft();
    setDraftOffer(null);
  }, []);

  const openEdit = async (emp: any) => {
    try {
      setIsActionLoading(true);
      const res = await api.get(`/employees/${emp.id}`);
      const data = normalizeEmployeeRecord(res.data);
      setEditingEmp(data);
      setFormData(data);
      setCustomJobTitle(isCustomJobTitleValue(data.jobTitle));
      // The stored path is relative (`/uploads/...`) and served from the API
      // origin, so it needs the prefix. Concatenating without checking produced
      // `http://host/https://…` for any absolute value, and the `<img>` broke.
      setImagePreview(
        data.profileImageUrl
          ? data.profileImageUrl.startsWith("http")
            ? data.profileImageUrl
            : `${staticURL}${data.profileImageUrl}`
          : null,
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
    // Shape first (free, instant), then identity against the roster.
    const nameError = validatePersonName(formData.fullName);
    if (nameError) {
      toast.error(nameError);
      return;
    }
    const phoneError = validatePhone(formData.phonePrimary);
    if (phoneError) {
      toast.error(phoneError);
      return;
    }
    /*
      The steps can also be reached directly by clicking the stepper, so the
      gate on "next" is not enough on its own: everything is re-checked here,
      where it actually matters.
    */
    const idAnalysis = analyzeNationalId(formData.nationalId);
    if (idAnalysis.error) {
      toast.error(idAnalysis.error);
      return;
    }
    if (
      idAnalysis.info &&
      formData.birthDate &&
      formData.birthDate !== idAnalysis.info.birthDate
    ) {
      toast.error(
        `تاريخ الميلاد لا يطابق الرقم القومي (${idAnalysis.info.birthDate})`,
      );
      return;
    }
    if (formData.hasLoginAccount) {
      if (!formData.username) {
        toast.error("يرجى إدخال اسم المستخدم لحساب الدخول");
        return;
      }
      const usernameError = validateUsername(formData.username);
      if (usernameError) {
        toast.error(usernameError);
        return;
      }
    }
    // Only when something was typed: an empty address is a legitimate "no
    // address", not a failed entry.
    if (String(formData.email ?? "").trim()) {
      const emailError = validateEmployeeEmail(formData.email);
      if (emailError) {
        toast.error(emailError);
        return;
      }
    }
    // A contract that ends before it starts is the kind of typo that silently
    // excludes someone from renewal reminders forever.
    const contractEnd = String(formData.contractEndDate ?? "").trim();
    const hiredOn = String(formData.hireDate ?? "").trim();
    if (contractEnd && hiredOn && contractEnd < hiredOn) {
      toast.error("تاريخ انتهاء العقد لا يمكن أن يسبق تاريخ التعيين");
      return;
    }
    if (formData.hasLoginAccount && !editingEmp && !formData.password) {
      toast.error("يرجى إدخال كلمة المرور لحساب الدخول");
      return;
    }
    if (formData.hasLoginAccount && formData.password) {
      const unmet = passwordRequirements(formData.password).find((r) => !r.met);
      if (unmet) {
        toast.error(`كلمة المرور: ${unmet.label}`);
        return;
      }
    }
    const moneyChecks: Array<[string, unknown]> = [
      ["الراتب الأساسي", formData.baseSalary],
      ["الحافز الثابت", formData.fixedBonus],
      ["الخصومات الثابتة", formData.defaultDeductions],
    ];
    for (const [label, value] of moneyChecks) {
      const moneyError = validateMoney(value, label);
      if (moneyError) {
        toast.error(moneyError);
        return;
      }
    }
    const commissionIssue = validateCommission(formData.commissionRate);
    if (commissionIssue) {
      toast.error(commissionIssue);
      return;
    }
    const paymentMethod = String(formData.paymentMethod ?? "cash");
    const wallet = String(formData.walletNumber ?? "").trim();
    if (paymentMethod === "wallet" && !wallet) {
      toast.error("رقم المحفظة مطلوب عند اختيار التحويل للمحفظة");
      return;
    }
    if (wallet) {
      const walletError = validatePhone(wallet);
      if (walletError) {
        toast.error(`رقم المحفظة: ${walletError}`);
        return;
      }
    }
    const bank = String(formData.bankAccount ?? "").trim();
    if (paymentMethod === "bank" && !bank) {
      toast.error("رقم الحساب البنكي مطلوب عند اختيار التحويل البنكي");
      return;
    }
    if (bank) {
      const bankIssue = validateBankAccount(bank);
      if (bankIssue) {
        toast.error(bankIssue);
        return;
      }
    }
    try {
      setIsActionLoading(true);
      /*
        Duplicate check before the write: a server-side rejection mid-save would
        leave the form half-applied. Query rather than read the roster prop,
        because the roster on screen may be filtered or paginated and would
        miss a number held by someone else.
      */
      try {
        const res = await api.get("/employees", {
          params: { q: phoneDigits(formData.phonePrimary), limit: 50 },
        });
        const conflict = findPhoneConflict(
          formData.phonePrimary,
          Array.isArray(res.data) ? res.data : [],
          editingEmp?.id,
        );
        if (conflict) {
          toast.error(
            `رقم الجوال مسجل بالفعل للموظف: ${conflict.name}` +
              (conflict.id ? ` (رقم ${conflict.id})` : ""),
          );
          return;
        }
        /*
          The same person with two national ids (or two rows sharing one) is the
          duplicate a payroll audit finds months later. The roster query searches
          national ids too, and the server answers 409 as the final word.
        */
        if (idAnalysis.digits) {
          const idRes = await api.get("/employees", {
            params: { q: idAnalysis.digits, limit: 50 },
          });
          const idConflict = findNationalIdConflict(
            idAnalysis.digits,
            Array.isArray(idRes.data) ? idRes.data : [],
            editingEmp?.id,
          );
          if (idConflict) {
            toast.error(
              `رقم الهوية مسجل بالفعل للموظف: ${idConflict.name}` +
                (idConflict.id ? ` (رقم ${idConflict.id})` : ""),
            );
            return;
          }
        }
      } catch {
        // Roster unavailable: let the save proceed and let the server decide,
        // rather than blocking a valid entry on a failed read.
      }
      // Sanitize payload: convert empty strings to null for dates, and ensure proper types
      const cleanBirth = formData.birthDate && formData.birthDate.trim() !== "" ? formData.birthDate : null;
      const cleanHire = formData.hireDate && formData.hireDate.trim() !== "" ? formData.hireDate : null;
      const cleanContractEnd = formData.contractEndDate && String(formData.contractEndDate).trim() !== "" ? String(formData.contractEndDate).trim() : null;
      const cleanEmail = formData.email && String(formData.email).trim() !== "" ? String(formData.email).trim() : null;
      const payload = {
        ...formData,
        // Stored normalized: digits only, in English numerals, whichever
        // keyboard the owner typed on.
        phonePrimary: phoneDigits(formData.phonePrimary),
        birthDate: cleanBirth,
        hireDate: cleanHire,
        contractEndDate: cleanContractEnd,
        email: cleanEmail,
        profileImageUrl: formData.profileImageUrl && formData.profileImageUrl.trim() !== "" ? formData.profileImageUrl : null,
        nationalId: idAnalysis.digits || null,
        assistantOfBarberId: formData.assistantOfBarberId ? parseInt(String(formData.assistantOfBarberId)) : null,
        baseSalary: Number(formData.baseSalary) || 0,
        commissionRate: Number(formData.commissionRate) || 0,
        fixedBonus: Number(formData.fixedBonus) || 0,
        defaultDeductions: Number(formData.defaultDeductions) || 0,
        // The booking switch is a classification, not a free toggle: a
        // cashier or accountant is never "on the public site". The server
        // drops it regardless — normalizing here too means the saved copy
        // matches what the form showed.
        showInBooking:
          isServiceProviderJobTitle(formData.jobTitle) &&
          Boolean(formData.showInBooking),
        // Never let an unrecognised role block the save: an invalid one makes the
        // backend answer 400 for the whole request. `null` tells
        // `create_employee` to derive it from the job title instead.
        role: VALID_USER_ROLES.has(formData.role ?? "") ? formData.role : null,
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
      // The record now exists, so the local copy is both redundant and a hazard:
      // resuming it later would create the same person twice.
      clearEmployeeDraft();
      setDraftOffer(null);
      setDraftSavedAt(null);
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
      toast.success(
        nextStatus === "suspended"
          ? "تم تسجيل الموظف في إجازة"
          : "تم إرجاع الموظف للعمل",
      );
      setDeleteTarget(null);
      fetchEmployees();
    } catch (_error) {
      toast.error("فشل تعديل الحالة");
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Move an employee to the archive: they left the salon (resigned). The row
   * keeps its history but leaves every operational surface — the switches are
   * switched off too, so a return later starts from a clean, deliberate state.
   */
  const handleArchiveEmployee = async () => {
    if (!archiveTarget) return;
    try {
      setIsActionLoading(true);
      await api.put(`/employees/${archiveTarget.id}`, {
        status: "resigned",
        isActive: false,
        showInBooking: false,
        showInPos: false,
      });
      toast.success("تم نقل الموظف إلى الأرشيف");
      setArchiveTarget(null);
      fetchEmployees();
    } catch (_error) {
      toast.error("فشل نقل الموظف إلى الأرشيف");
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
    archiveTarget,
    setArchiveTarget,
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
  };
}
