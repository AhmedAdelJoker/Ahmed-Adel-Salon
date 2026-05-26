import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useMemo, useState } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import exportService from "../../services/exportService";
import { toast } from "react-hot-toast";
import salaryAdvanceService from "../../services/salaryAdvanceService";
import {
  User,
  Phone,
  Calendar,
  TrendingUp,
  Users,
  Scissors,
  Plus,
  Star,
  Pencil,
  Image as ImageIcon,
  DollarSign,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  FileText,
  UserPlus,
  FileDown,
  FileSpreadsheet,
  Save,
  X,
  Activity,
  Trash2,
  Banknote,
  Search,
  Archive,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { normalizeListResponse } from "../../services/apiAdapter";
import { motion, AnimatePresence } from "framer-motion";
import { EmployeeAvatar } from "../../components/shared/EmployeeAvatar";

const JOB_TITLES = [
  { value: "owner", label: "مالك" },
  { value: "manager", label: "مدير" },
  { value: "barber", label: "حلاق" },
  { value: "barber_assistant", label: "مساعد حلاق" },
  { value: "cashier", label: "كاشير" },
  { value: "receptionist", label: "استقبال" },
  { value: "inventory_staff", label: "مسؤول مخزن" },
  { value: "accountant", label: "محاسب" },
  { value: "cleaner", label: "عامل نظافة" },
  { value: "other", label: "أخرى" },
];

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "دوام كامل" },
  { value: "part_time", label: "دوام جزئي" },
  { value: "temporary", label: "مؤقت" },
];

const ROLES = [
  { value: "owner", label: "Owner (المالك)" },
  { value: "manager", label: "Manager (المدير)" },
  { value: "cashier", label: "Cashier (الكاشير)" },
  { value: "barber", label: "Barber (حلاق)" },
  { value: "barber_assistant", label: "Barber Assistant (مساعد الحلاق)" },
];

const ASSISTANT_TASKS = [
  "غسيل الشعر",
  "تجهيز العميل",
  "تنظيف الأدوات",
  "تحضير الكرسي",
  "مساعدة في الخدمات الطويلة",
  "تنظيف منطقة العمل",
  "أخرى",
];

const defaultForm = {
  fullName: "",
  displayName: "",
  phonePrimary: "",
  phoneSecondary: "",
  profileImageUrl: "",
  bioAr: "",
  bioEn: "",
  nationalId: "",
  birthDate: "",
  governorate: "",
  city: "",
  detailedAddress: "",
  personalNotes: "",
  jobTitle: "barber",
  department: "",
  employmentType: "full_time",
  hireDate: new Date().toISOString().split("T")[0],
  status: "active",
  showInPos: true,
  showInBooking: true,
  displayOrder: 0,
  baseSalary: 0,
  commissionRate: 0,
  fixedBonus: 0,
  defaultDeductions: 0,
  paymentMethod: "cash",
  walletNumber: "",
  bankAccount: "",
  assistantOfBarberId: "",
  assistantTasksJson: [],
  receivesCommission: false,
  assistantCommissionRate: 0,
  hasLoginAccount: false,
  username: "",
  password: "",
  role: "employee",
};

const STATIC_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api/v1", "")
  : import.meta.env.VITE_API_URL;

const FORM_TABS = [
  { id: "personal", label: "البيانات الشخصية", icon: User },
  { id: "work", label: "تفاصيل العمل", icon: Briefcase },
  { id: "financial", label: "الحسابات المالية", icon: DollarSign },
  { id: "assistant", label: "قسم المساعدين", icon: Scissors },
  { id: "documents", label: "المستندات", icon: FileText },
  { id: "system", label: "صلاحيات النظام", icon: ShieldCheck },
];

const EMPLOYEE_WIZARD_DRAFT_PREFIX = "hr_employee_wizard_draft";
const FIELD_LABEL_CLASS =
  "flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-muted";
const FIELD_HINT_CLASS = "text-[11px] font-bold leading-6 text-muted/80";
const FIELD_INPUT_CLASS =
  "h-14 rounded-2xl border border-white/10 bg-white/5 px-4 font-bold text-main shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition placeholder:text-muted/55 focus:border-cyan-400/35 focus:bg-white/10";
const FIELD_INPUT_LTR_CLASS = `${FIELD_INPUT_CLASS} text-left tracking-tight`;
const FIELD_TEXTAREA_CLASS =
  "w-full rounded-[22px] border border-white/10 bg-white/5 p-5 text-sm font-bold text-main shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition placeholder:text-muted/55 focus:border-cyan-400/35 focus:bg-white/10 focus:outline-none resize-none";
const FIELD_SELECT_CLASS =
  "h-14 rounded-2xl border border-white/10 bg-white/5 px-4 font-bold text-main shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition focus:border-cyan-400/35 focus:bg-white/10";
const FIELD_PANEL_CLASS =
  "rounded-[22px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
const STEP_INTRO_CLASS =
  "md:col-span-2 rounded-[24px] border border-white/10 bg-gradient-to-r from-white/10 to-transparent px-5 py-4";
const EDIT_TAB_FIELDS = {
  personal: [
    "fullName",
    "displayName",
    "phonePrimary",
    "phoneSecondary",
    "nationalId",
    "birthDate",
    "governorate",
    "city",
    "detailedAddress",
    "bioAr",
    "bioEn",
    "profileImageUrl",
  ],
  work: [
    "jobTitle",
    "employmentType",
    "hireDate",
    "status",
    "showInPos",
    "showInBooking",
    "assistantOfBarberId",
  ],
  financial: [
    "baseSalary",
    "commissionRate",
    "fixedBonus",
    "defaultDeductions",
    "paymentMethod",
    "walletNumber",
    "bankAccount",
  ],
  assistant: [
    "assistantOfBarberId",
    "assistantTasksJson",
    "receivesCommission",
    "assistantCommissionRate",
  ],
  system: ["hasLoginAccount", "username", "role"],
};

const EDIT_FIELD_LABELS = {
  fullName: "الاسم الكامل",
  displayName: "الاسم المعروض",
  phonePrimary: "الجوال الأساسي",
  phoneSecondary: "جوال الطوارئ",
  nationalId: "رقم الهوية",
  birthDate: "تاريخ الميلاد",
  governorate: "المنطقة",
  city: "المدينة",
  detailedAddress: "العنوان التفصيلي",
  bioAr: "النبذة العربية",
  bioEn: "النبذة الإنجليزية",
  profileImageUrl: "الصورة الشخصية",
  jobTitle: "المسمى الوظيفي",
  employmentType: "نظام التعاقد",
  hireDate: "تاريخ الالتحاق",
  status: "الحالة الوظيفية",
  showInPos: "الظهور في نقطة البيع",
  showInBooking: "الظهور في الحجوزات",
  baseSalary: "الراتب الأساسي",
  commissionRate: "نسبة العمولة",
  fixedBonus: "الحافز الثابت",
  defaultDeductions: "الخصومات الافتراضية",
  paymentMethod: "قناة الصرف",
  walletNumber: "رقم المحفظة",
  bankAccount: "الحساب البنكي",
  assistantOfBarberId: "المشرف المباشر",
  assistantTasksJson: "مهام المساعد",
  receivesCommission: "تفعيل عمولة المساعد",
  assistantCommissionRate: "نسبة عمولة المساعد",
  hasLoginAccount: "حساب الدخول",
  username: "اسم المستخدم",
  role: "مستوى الوصول",
};

const JOB_TITLE_BLUEPRINTS = {
  owner: {
    eyebrow: "قيادة استراتيجية",
    title: "ملف قيادة المالك",
    summary:
      "تركز هذه الهوية على الصلاحيات الكاملة، ظهور موثوق في المنظومة، وصورة قيادية متسقة مع العلامة.",
    focus: ["إبراز الثقة", "تحديد الصلاحيات", "توثيق الملف الإداري"],
    accent: "from-warning/20 via-warning/5 to-transparent",
    badgeClass: "border-warning/30 bg-warning/10 text-warning",
  },
  manager: {
    eyebrow: "إدارة وتشغيل",
    title: "ملف مدير تشغيل",
    summary:
      "مناسب للموظف الذي يقود الفريق ويحتاج تفاصيل تشغيلية واضحة مع صلاحيات وصول دقيقة.",
    focus: ["قيادة الفريق", "متابعة الأداء", "تنسيق الموارد"],
    accent: "from-info/20 via-info/5 to-transparent",
    badgeClass: "border-info/30 bg-info/10 text-info",
  },
  barber: {
    eyebrow: "واجهة الخدمة",
    title: "ملف خبير خدمات",
    summary:
      "يبني بطاقة احترافية للموظف على الموقع ونقطة البيع والحجوزات مع حضور قوي أمام العميل.",
    focus: ["الظهور في الحجوزات", "نبذة تسويقية", "هيكل عمولة واضح"],
    accent: "from-accent/20 via-accent/5 to-transparent",
    badgeClass: "border-accent/30 bg-accent/10 text-accent",
  },
  barber_assistant: {
    eyebrow: "دعم العمليات",
    title: "ملف مساعد ديناميكي",
    summary:
      "مهيأ لربط المساعد بالمشرف المناسب وتحديد مهامه اليومية بشكل مرن وسهل المتابعة.",
    focus: ["الارتباط بالمشرف", "توزيع المهام", "عمولة المساندة"],
    accent: "from-success/20 via-success/5 to-transparent",
    badgeClass: "border-success/30 bg-success/10 text-success",
  },
  cashier: {
    eyebrow: "تشغيل مالي",
    title: "ملف واجهة الدفع",
    summary:
      "يركز على الوضوح المالي، سرعة التشغيل، وحساب دخول منضبط لعمليات الكاشير.",
    focus: ["دقة الحسابات", "اعتماد الراتب", "صلاحية الوصول"],
    accent: "from-success/20 via-success/5 to-transparent",
    badgeClass: "border-success/30 bg-success/10 text-success",
  },
  receptionist: {
    eyebrow: "استقبال العملاء",
    title: "ملف واجهة الضيافة",
    summary:
      "مصمم للموظف الذي يتعامل مع العملاء مباشرة ويحتاج ملفاً واضحاً وسهل الإدارة.",
    focus: ["سرعة التواصل", "تنظيم الحجز", "صورة ودودة"],
    accent: "from-info/20 via-info/5 to-transparent",
    badgeClass: "border-info/30 bg-info/10 text-info",
  },
  accountant: {
    eyebrow: "رقابة مالية",
    title: "ملف المحاسب التنفيذي",
    summary:
      "مناسب للمهام المالية الدقيقة مع إبراز بيانات الصرف والصلاحيات بشكل احترافي.",
    focus: ["قنوات الصرف", "مراجعة الاستحقاقات", "تحديد الصلاحيات"],
    accent: "from-warning/20 via-warning/5 to-transparent",
    badgeClass: "border-warning/30 bg-warning/10 text-warning",
  },
  inventory_staff: {
    eyebrow: "تشغيل المخزون",
    title: "ملف مسؤول المخزن",
    summary:
      "يدعم الأدوار التشغيلية خلف الكواليس مع وضوح في الحالة الوظيفية والصلاحيات.",
    focus: ["تنسيق التشغيل", "الهوية الوظيفية", "مستوى الوصول"],
    accent: "from-main/10 via-main/5 to-transparent",
    badgeClass: "border-border bg-soft text-main",
  },
  cleaner: {
    eyebrow: "جودة بيئة العمل",
    title: "ملف دعم النظافة",
    summary:
      "ينظم الملفات الأساسية للموظفين الداعمين ويضمن توثيقاً بسيطاً وواضحاً.",
    focus: ["التوثيق الأساسي", "الحالة الوظيفية", "ملاحظات الإدارة"],
    accent: "from-muted/20 via-muted/5 to-transparent",
    badgeClass: "border-border bg-soft text-muted",
  },
  other: {
    eyebrow: "هيكل مرن",
    title: "ملف كادر مخصص",
    summary:
      "نموذج مرن لأي وظيفة خاصة داخل الصالون مع مساحة كافية لتكييف التفاصيل حسب الاحتياج.",
    focus: ["تخصيص الدور", "الهوية الإدارية", "مرونة الإعداد"],
    accent: "from-main/10 via-main/5 to-transparent",
    badgeClass: "border-border bg-soft text-main",
  },
};

const deriveDateOnly = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    if (value.includes("T")) return value.split("T")[0];
    if (value.includes(" ")) return value.split(" ")[0];
  }
  return value;
};

const normalizeEmployeeRecord = (employee = {}) => {
  const fullName =
    employee.fullName ||
    employee.full_name ||
    employee.displayName ||
    employee.display_name ||
    "موظف";

  const displayName =
    employee.displayName || employee.display_name || fullName || "";

  const status =
    employee.status ||
    (employee.isActive === false || employee.is_active === false
      ? "suspended"
      : "active");

  const jobTitle =
    employee.jobTitle || employee.job_title || employee.role || "barber";

  return {
    ...employee,
    id: employee.id ?? employee.employee_id ?? employee.employeeId,
    fullName,
    displayName,
    phonePrimary: employee.phonePrimary || employee.phone_primary || "",
    phoneSecondary: employee.phoneSecondary || employee.phone_secondary || "",
    profileImageUrl:
      employee.profileImageUrl || employee.profile_image_url || "",
    bioAr: employee.bioAr || employee.bio_ar || "",
    bioEn: employee.bioEn || employee.bio_en || "",
    nationalId: employee.nationalId || employee.national_id || "",
    birthDate: deriveDateOnly(employee.birthDate || employee.birth_date),
    governorate: employee.governorate || "",
    city: employee.city || "",
    detailedAddress:
      employee.detailedAddress || employee.detailed_address || "",
    personalNotes: employee.personalNotes || employee.personal_notes || "",
    jobTitle,
    department: employee.department || "",
    employmentType:
      employee.employmentType || employee.employment_type || "full_time",
    hireDate: deriveDateOnly(
      employee.hireDate || employee.hire_date || employee.created_at,
    ),
    status,
    showInPos: employee.showInPos ?? employee.show_in_pos ?? true,
    showInBooking: employee.showInBooking ?? employee.show_in_booking ?? true,
    displayOrder: Number(employee.displayOrder ?? employee.display_order ?? 0),
    baseSalary: Number(employee.baseSalary ?? employee.base_salary ?? 0),
    commissionRate: Number(
      employee.commissionRate ?? employee.commission_rate ?? 0,
    ),
    fixedBonus: Number(employee.fixedBonus ?? employee.fixed_bonus ?? 0),
    defaultDeductions: Number(
      employee.defaultDeductions ?? employee.default_deductions ?? 0,
    ),
    paymentMethod: employee.paymentMethod || employee.payment_method || "cash",
    walletNumber: employee.walletNumber || employee.wallet_number || "",
    bankAccount: employee.bankAccount || employee.bank_account || "",
    assistantOfBarberId: String(
      employee.assistantOfBarberId ?? employee.assistant_of_barber_id ?? "",
    ),
    assistantTasksJson: Array.isArray(
      employee.assistantTasksJson ?? employee.assistant_tasks_json,
    )
      ? (employee.assistantTasksJson ?? employee.assistant_tasks_json)
      : [],
    receivesCommission:
      employee.receivesCommission ?? employee.receives_commission ?? false,
    assistantCommissionRate: Number(
      employee.assistantCommissionRate ??
        employee.assistant_commission_rate ??
        0,
    ),
    hasLoginAccount: Boolean(
      employee.hasLoginAccount ??
      employee.has_login_account ??
      employee.username ??
      employee.user_id,
    ),
    username: employee.username || "",
    role: employee.role || "barber",
    isLegacyRecord:
      employee.isLegacyRecord ??
      (!("status" in employee) &&
        !("isActive" in employee) &&
        !("is_active" in employee)),
  };
};

const readEmployeeWizardDraft = (storageKey) => {
  if (!storageKey || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.error("Failed to read employee wizard draft", error);
    return null;
  }
};

const writeEmployeeWizardDraft = (storageKey, value) => {
  if (!storageKey || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    console.error("Failed to write employee wizard draft", error);
  }
};

const clearEmployeeWizardDraft = (storageKey) => {
  if (!storageKey || typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(storageKey);
  } catch (error) {
    console.error("Failed to clear employee wizard draft", error);
  }
};

const isFilledText = (value) =>
  typeof value === "string" && value.trim().length > 0;
const countCompleted = (items = []) => items.filter(Boolean).length;

const getComparableValue = (value) => {
  if (Array.isArray(value)) {
    return JSON.stringify([...value].map((item) => String(item)).sort());
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "boolean") return value;
  if (value == null) return "";
  return String(value).trim();
};

const findTabForField = (fieldKey) =>
  Object.entries(EDIT_TAB_FIELDS).find(([, fields]) =>
    fields.includes(fieldKey),
  )?.[0] || "personal";

const getTabProgress = ({ formData, editingEmp, employeeDocs }) => {
  const progress = {
    personal: {
      completed: countCompleted([
        isFilledText(formData.fullName),
        isFilledText(formData.phonePrimary),
        isFilledText(formData.governorate),
        isFilledText(formData.bioAr),
      ]),
      total: 4,
    },
    work: {
      completed: countCompleted([
        isFilledText(formData.jobTitle),
        isFilledText(formData.employmentType),
        isFilledText(formData.hireDate),
        isFilledText(formData.status),
        formData.jobTitle !== "barber_assistant" ||
          isFilledText(formData.assistantOfBarberId),
      ]),
      total: 5,
    },
    financial: {
      completed: countCompleted([
        Number(formData.baseSalary) > 0,
        Number(formData.commissionRate) >= 0,
        isFilledText(formData.paymentMethod),
        formData.paymentMethod === "cash" ||
          isFilledText(formData.walletNumber || formData.bankAccount),
      ]),
      total: 4,
    },
    assistant: {
      completed:
        formData.jobTitle !== "barber_assistant"
          ? 1
          : countCompleted([
              isFilledText(formData.assistantOfBarberId),
              !formData.receivesCommission ||
                Number(formData.assistantCommissionRate) > 0,
            ]),
      total: formData.jobTitle !== "barber_assistant" ? 1 : 2,
    },
    documents: {
      completed: editingEmp ? Number(employeeDocs.length > 0) : 1,
      total: 1,
    },
    system: {
      completed: formData.hasLoginAccount
        ? countCompleted([
            isFilledText(formData.username),
            isFilledText(formData.role),
            editingEmp ? true : isFilledText(formData.password),
          ])
        : 1,
      total: formData.hasLoginAccount ? 3 : 1,
    },
  };

  const completed = Object.values(progress).reduce(
    (sum, section) => sum + section.completed,
    0,
  );
  const total = Object.values(progress).reduce(
    (sum, section) => sum + section.total,
    0,
  );

  return {
    sections: progress,
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
};

const HRManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchParams] = useSearchParams();
  const highlightedEmployeeId = searchParams.get("employeeId");

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeView, setActiveView] = useState("cards");
  const [activeTab, setActiveTab] = useState("personal");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState(null);
  const [advanceData, setAdvanceData] = useState({
    amount: "",
    description: "",
    advanceDate: new Date().toISOString().split("T")[0],
  });
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasRecoveredDraft, setHasRecoveredDraft] = useState(false);
  const [employeeDocs, setEmployeeDocs] = useState([]);
  const [docLoading, setDocLoading] = useState(false);
  const [originalEditForm, setOriginalEditForm] = useState(null);

  const draftStorageKey = useMemo(() => {
    const actorId =
      user?.id ||
      user?.user_id ||
      user?.username ||
      user?.full_name ||
      "anonymous";
    return `${EMPLOYEE_WIZARD_DRAFT_PREFIX}:${actorId}`;
  }, [user]);

  const filteredEmployees = useMemo(() => {
    let result = employees.filter((emp) => emp.status === "active");
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (emp) =>
          emp.fullName?.toLowerCase().includes(q) ||
          emp.phonePrimary?.includes(q) ||
          emp.jobTitle?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [employees, searchTerm]);

  const wizardTabs = useMemo(
    () =>
      editingEmp
        ? FORM_TABS
        : FORM_TABS.filter((tab) => tab.id !== "documents"),
    [editingEmp],
  );

  const jobBlueprint =
    JOB_TITLE_BLUEPRINTS[formData.jobTitle] || JOB_TITLE_BLUEPRINTS.other;

  const tabProgress = useMemo(
    () => getTabProgress({ formData, editingEmp, employeeDocs }),
    [formData, editingEmp, employeeDocs],
  );

  const activeTabMeta =
    wizardTabs.find((tab) => tab.id === activeTab) || wizardTabs[0];
  const activeTabIndex = Math.max(
    0,
    wizardTabs.findIndex((tab) => tab.id === activeTab),
  );
  const activeSectionProgress = tabProgress.sections[activeTab] || {
    completed: 0,
    total: 1,
  };
  const previousWizardTab =
    activeTabIndex > 0 ? wizardTabs[activeTabIndex - 1] : null;
  const nextWizardTab =
    activeTabIndex >= 0 && activeTabIndex < wizardTabs.length - 1
      ? wizardTabs[activeTabIndex + 1]
      : null;
  const isFirstWizardStep = activeTabIndex <= 0;
  const isLastWizardStep = activeTabIndex === wizardTabs.length - 1;

  const readinessChecklist = useMemo(
    () => [
      {
        label: "الاسم والجوال الأساسي",
        done:
          isFilledText(formData.fullName) &&
          isFilledText(formData.phonePrimary),
      },
      {
        label: "تحديد الدور والحالة الوظيفية",
        done: isFilledText(formData.jobTitle) && isFilledText(formData.status),
      },
      {
        label: "اعتماد الهيكل المالي",
        done:
          Number(formData.baseSalary) > 0 &&
          isFilledText(formData.paymentMethod),
      },
      {
        label: "إعداد حساب الدخول عند الحاجة",
        done: formData.hasLoginAccount
          ? isFilledText(formData.username) &&
            (editingEmp || isFilledText(formData.password)) &&
            isFilledText(formData.role)
          : true,
      },
    ],
    [formData, editingEmp],
  );

  const readinessDoneCount = readinessChecklist.filter(
    (item) => item.done,
  ).length;

  const salaryPreview = Number(formData.baseSalary || 0).toLocaleString(
    "ar-EG",
  );
  const employeeDisplayName =
    formData.fullName?.trim() || formData.displayName?.trim() || "اسم الموظف";
  const employeeRoleLabel =
    JOB_TITLES.find((item) => item.value === formData.jobTitle)?.label ||
    "الدور الوظيفي";
  const employmentLabel =
    EMPLOYMENT_TYPES.find((item) => item.value === formData.employmentType)
      ?.label || "نوع التعاقد";

  const barbersList = useMemo(
    () =>
      employees.filter((e) => e.jobTitle === "barber" && e.status === "active"),
    [employees],
  );

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.status === "active").length;
    const barbers = employees.filter(
      (e) => e.jobTitle === "barber" && e.status === "active",
    ).length;
    return { active, barbers, total: employees.length };
  }, [employees]);

  const formatComparisonValue = (fieldKey, value) => {
    if (fieldKey === "jobTitle") {
      return (
        JOB_TITLES.find((item) => item.value === value)?.label ||
        value ||
        "غير محدد"
      );
    }
    if (fieldKey === "employmentType") {
      return (
        EMPLOYMENT_TYPES.find((item) => item.value === value)?.label ||
        value ||
        "غير محدد"
      );
    }
    if (fieldKey === "status") {
      return (
        {
          active: "نشط",
          suspended: "موقوف",
          resigned: "مستقيل",
        }[value] ||
        value ||
        "غير محدد"
      );
    }
    if (fieldKey === "paymentMethod") {
      return (
        {
          cash: "نقدي",
          wallet: "محفظة إلكترونية",
          bank: "تحويل بنكي",
        }[value] ||
        value ||
        "غير محدد"
      );
    }
    if (
      [
        "showInPos",
        "showInBooking",
        "hasLoginAccount",
        "receivesCommission",
      ].includes(fieldKey)
    ) {
      return value ? "مفعل" : "غير مفعل";
    }
    if (fieldKey === "assistantTasksJson") {
      return Array.isArray(value) && value.length
        ? value.join("، ")
        : "غير محدد";
    }
    if (
      [
        "baseSalary",
        "commissionRate",
        "fixedBonus",
        "defaultDeductions",
        "assistantCommissionRate",
      ].includes(fieldKey)
    ) {
      return Number(value || 0).toLocaleString("ar-EG");
    }
    if (fieldKey === "assistantOfBarberId") {
      const supervisor = barbersList.find(
        (item) => String(item.id) === String(value),
      );
      return supervisor?.fullName || value || "غير محدد";
    }
    if (fieldKey === "profileImageUrl") {
      return value ? "تم تحديد صورة" : "بدون صورة";
    }

    return value || "غير محدد";
  };

  const editFieldChanges = useMemo(() => {
    if (!editingEmp || !originalEditForm) return [];

    return Object.keys(EDIT_FIELD_LABELS).reduce((changes, fieldKey) => {
      const originalValue = getComparableValue(originalEditForm[fieldKey]);
      const currentValue = getComparableValue(formData[fieldKey]);

      if (originalValue === currentValue) return changes;

      changes.push({
        key: fieldKey,
        label: EDIT_FIELD_LABELS[fieldKey],
        tabId: findTabForField(fieldKey),
        from: formatComparisonValue(fieldKey, originalEditForm[fieldKey]),
        to: formatComparisonValue(fieldKey, formData[fieldKey]),
      });
      return changes;
    }, []);
  }, [editingEmp, originalEditForm, formData, barbersList]);

  const editChangesByTab = useMemo(() => {
    return editFieldChanges.reduce((acc, change) => {
      acc[change.tabId] = [...(acc[change.tabId] || []), change];
      return acc;
    }, {});
  }, [editFieldChanges]);

  const editChangedTabs = useMemo(() => {
    return wizardTabs
      .map((tab) => ({
        ...tab,
        changes: editChangesByTab[tab.id] || [],
      }))
      .filter((tab) => tab.changes.length > 0);
  }, [wizardTabs, editChangesByTab]);

  const hasUnsavedEditChanges = editingEmp
    ? editFieldChanges.length > 0
    : false;
  const activeSectionPercent = Math.min(
    100,
    Math.round(
      (activeSectionProgress.completed /
        Math.max(activeSectionProgress.total, 1)) *
        100,
    ),
  );
  const pendingReadiness = readinessChecklist.filter((item) => !item.done);
  const executiveStatusLabel = editingEmp
    ? hasUnsavedEditChanges
      ? `${editFieldChanges.length} تغييرات تنتظر الحفظ`
      : "لا توجد تغييرات معلقة"
    : pendingReadiness.length
      ? `${pendingReadiness.length} نقاط تحتاج الإكمال`
      : "الملف جاهز للاعتماد";
  const executiveStatusTone = editingEmp
    ? hasUnsavedEditChanges
      ? "text-warning"
      : "text-success"
    : pendingReadiness.length
      ? "text-warning"
      : "text-success";
  const profileQuickRows = [
    {
      label: "الجوال",
      value: formData.phonePrimary || "غير مضاف",
      ltr: true,
    },
    {
      label: "المنطقة",
      value: formData.governorate || formData.city || "غير محددة",
    },
    {
      label: "المرفقات",
      value: editingEmp ? `${employeeDocs.length} ملف` : "بعد الحفظ",
    },
    {
      label: "الدخول",
      value: formData.hasLoginAccount ? "مفعل" : "اختياري",
    },
  ];
  const visibilityRows = [
    {
      label: "نقطة البيع",
      value: formData.showInPos ? "مفعل" : "مخفي",
      tone: formData.showInPos ? "text-success" : "text-muted",
    },
    {
      label: "الحجوزات",
      value: formData.showInBooking ? "ظاهر" : "غير ظاهر",
      tone: formData.showInBooking ? "text-success" : "text-muted",
    },
    {
      label: "حساب الدخول",
      value: formData.hasLoginAccount ? "جاهز للإسناد" : "اختياري",
      tone: formData.hasLoginAccount ? "text-info" : "text-muted",
    },
  ];
  const executivePulseItems = [
    {
      label: "القسم الحالي",
      value: activeTabMeta.label,
      meta: `${activeTabIndex + 1}/${wizardTabs.length}`,
    },
    {
      label: "الأولوية التالية",
      value: nextWizardTab?.label || "الاعتماد النهائي",
      meta: `${activeSectionProgress.completed}/${activeSectionProgress.total}`,
    },
  ];

  const persistCurrentDraft = () => {
    const safeTab = wizardTabs.some((tab) => tab.id === activeTab)
      ? activeTab
      : wizardTabs[0]?.id || "personal";

    writeEmployeeWizardDraft(draftStorageKey, {
      formData: {
        ...formData,
        password: "",
      },
      imagePreview,
      activeTab: safeTab,
      savedAt: new Date().toISOString(),
    });
  };

  const restoreDraftIntoForm = (draft) => {
    const draftForm =
      draft?.formData && typeof draft.formData === "object"
        ? draft.formData
        : {};
    const mergedForm = {
      ...defaultForm,
      ...draftForm,
      password: "",
    };
    const restoredTab = FORM_TABS.some((tab) => tab.id === draft?.activeTab)
      ? draft.activeTab
      : "personal";

    setEditingEmp(null);
    setOriginalEditForm(null);
    setFormData(mergedForm);
    setImagePreview(draft?.imagePreview || mergedForm.profileImageUrl || null);
    setEmployeeDocs([]);
    setActiveTab(restoredTab);
    setHasRecoveredDraft(true);
    setIsModalOpen(true);
  };

  const resetCreateDraft = () => {
    clearEmployeeWizardDraft(draftStorageKey);
    setHasRecoveredDraft(false);
    setFormData(defaultForm);
    setImagePreview(null);
    setEmployeeDocs([]);
    setActiveTab("personal");
    toast.success("تم مسح المسودة والبدء من جديد");
  };

  const restoreOriginalEditState = () => {
    if (!originalEditForm) return;
    setFormData(originalEditForm);
    setImagePreview(
      originalEditForm.profileImageUrl
        ? `${STATIC_URL}${originalEditForm.profileImageUrl}`
        : null,
    );
    toast.success("تم استعادة النسخة الأصلية قبل التعديل");
  };

  const hasMeaningfulDraft = useMemo(() => {
    const comparableCurrent = {
      ...formData,
      password: "",
    };
    const comparableDefault = {
      ...defaultForm,
      password: "",
    };

    return (
      JSON.stringify(comparableCurrent) !== JSON.stringify(comparableDefault) ||
      Boolean(imagePreview) ||
      activeTab !== "personal"
    );
  }, [formData, imagePreview, activeTab]);

  const getStepValidationMessage = (tabId) => {
    switch (tabId) {
      case "personal":
        if (!isFilledText(formData.fullName)) return "أدخل الاسم الكامل أولاً.";
        if (!isFilledText(formData.phonePrimary))
          return "أدخل رقم الجوال الأساسي قبل الانتقال.";
        return null;
      case "work":
        if (!isFilledText(formData.jobTitle)) return "حدد المسمى الوظيفي.";
        if (!isFilledText(formData.employmentType)) return "حدد نظام التعاقد.";
        if (!isFilledText(formData.hireDate))
          return "حدد تاريخ الالتحاق بالعمل.";
        if (!isFilledText(formData.status)) return "حدد الحالة الوظيفية.";
        if (
          formData.jobTitle === "barber_assistant" &&
          !isFilledText(formData.assistantOfBarberId)
        ) {
          return "اختر الحلاق المسؤول عن المساعد قبل المتابعة.";
        }
        return null;
      case "financial":
        if (Number.isNaN(Number(formData.baseSalary))) {
          return "راجع قيمة الراتب الأساسي.";
        }
        if (!isFilledText(formData.paymentMethod))
          return "حدد قناة صرف المستحقات.";
        if (
          formData.paymentMethod !== "cash" &&
          !isFilledText(formData.walletNumber || formData.bankAccount)
        ) {
          return "أدخل رقم الحساب أو المحفظة قبل الانتقال.";
        }
        return null;
      case "assistant":
        if (formData.jobTitle !== "barber_assistant") return null;
        if (!isFilledText(formData.assistantOfBarberId))
          return "حدد المشرف المباشر للمساعد.";
        if (
          formData.receivesCommission &&
          Number(formData.assistantCommissionRate || 0) <= 0
        ) {
          return "أدخل نسبة عمولة صحيحة للمساعد.";
        }
        return null;
      case "system":
        if (!formData.hasLoginAccount) return null;
        if (!isFilledText(formData.username))
          return "أدخل اسم المستخدم الخاص بحساب الدخول.";
        if (!editingEmp && !isFilledText(formData.password))
          return "أدخل كلمة المرور قبل الاعتماد.";
        if (!isFilledText(formData.role))
          return "حدد مستوى الوصول لهذا الحساب.";
        return null;
      default:
        return null;
    }
  };

  const validateStep = (tabId, { silent = false } = {}) => {
    const message = getStepValidationMessage(tabId);
    if (message && !silent) {
      toast.error(message);
    }
    return !message;
  };

  const handleWizardTabChange = (targetId) => {
    const targetIndex = wizardTabs.findIndex((tab) => tab.id === targetId);
    if (targetIndex === -1) return;
    if (targetIndex <= activeTabIndex) {
      setActiveTab(targetId);
      return;
    }
    if (!validateStep(activeTab)) return;
    setActiveTab(targetId);
  };

  const handlePrevStep = () => {
    if (previousWizardTab) {
      setActiveTab(previousWizardTab.id);
    }
  };

  const handleNextStep = () => {
    if (!validateStep(activeTab)) return;
    if (nextWizardTab) {
      setActiveTab(nextWizardTab.id);
    }
  };

  const getEmployeeId = (employee) =>
    employee?.id || employee?.employee_id || employee?.employeeId;
  const getEmployeeName = (employee) =>
    employee?.fullName ||
    employee?.full_name ||
    employee?.displayName ||
    employee?.display_name ||
    "موظف";

  const employeeQuery = (employee) => {
    const id = getEmployeeId(employee);
    const name = encodeURIComponent(getEmployeeName(employee));
    return `employeeId=${id}&employeeName=${name}`;
  };

  const openEmployeePayroll = (employee) => {
    const employeeId = getEmployeeId(employee);
    if (!employeeId) return toast.error("لا يمكن تحديد معرف الموظف");
    navigate(`/owner/payroll?${employeeQuery(employee)}`);
  };

  const openEmployeeAttendance = (employee) => {
    const employeeId = getEmployeeId(employee);
    if (!employeeId) return toast.error("لا يمكن تحديد معرف الموظف");
    navigate(`/attendance?${employeeQuery(employee)}`);
  };

  const openEmployeeReports = (employee) => {
    const employeeId = getEmployeeId(employee);
    if (!employeeId) return toast.error("لا يمكن تحديد معرف الموظف");
    navigate(`/owner/employee-reports?${employeeQuery(employee)}`);
  };

  const handleCreateAdvance = async () => {
    if (!advanceTarget || !advanceData.amount) return;
    try {
      setIsAdvancing(true);
      await salaryAdvanceService.create({
        employee_id: advanceTarget.id,
        amount: parseFloat(advanceData.amount),
        description: advanceData.description,
        advance_date: advanceData.advanceDate,
      });
      toast.success("تم تسجيل السلفة بنجاح");
      setAdvanceTarget(null);
      setAdvanceData({
        amount: "",
        description: "",
        advanceDate: new Date().toISOString().split("T")[0],
      });
    } catch (error) {
      toast.error("فشل تسجيل السلفة");
    } finally {
      setIsAdvancing(false);
    }
  };

  const fetchEmployeeDocs = async (empId) => {
    try {
      setDocLoading(true);
      const res = await api.get(`/employees/${empId}/documents`);
      setEmployeeDocs(res.data || []);
    } catch (err) {
      console.error("Failed to fetch documents", err);
    } finally {
      setDocLoading(false);
    }
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !editingEmp) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);
    formData.append("file_type", "other");

    try {
      toast.loading("جاري رفع المستند...", { id: "upload-doc" });
      await api.post(`/employees/${editingEmp.id}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { title: file.name, file_type: "other" },
      });
      toast.success("تم رفع المستند بنجاح", { id: "upload-doc" });
      fetchEmployeeDocs(editingEmp.id);
    } catch (err) {
      toast.error("فشل رفع المستند", { id: "upload-doc" });
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await api.delete(`/employees/documents/${docId}`);
      toast.success("تم حذف المستند");
      fetchEmployeeDocs(editingEmp.id);
    } catch (err) {
      toast.error("فشل حذف المستند");
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get("/employees");
      setEmployees(
        normalizeListResponse(res).items.map((employee) =>
          normalizeEmployeeRecord(employee),
        ),
      );
    } catch (error) {
      toast.error("فشل تحميل بيانات الموظفين");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (editingEmp && activeTab === "documents") {
      fetchEmployeeDocs(editingEmp.id);
    }
  }, [editingEmp, activeTab]);

  useEffect(() => {
    if (!isModalOpen || editingEmp) return;
    if (!hasMeaningfulDraft) {
      clearEmployeeWizardDraft(draftStorageKey);
      return;
    }
    persistCurrentDraft();
  }, [
    isModalOpen,
    editingEmp,
    formData,
    imagePreview,
    activeTab,
    draftStorageKey,
    hasMeaningfulDraft,
  ]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error("حجم الصورة كبير جداً (الحد الأقصى 20 ميجابايت)");
        return;
      }

      try {
        setUploading(true);
        const uploadData = new FormData();
        uploadData.append("file", file);

        const res = await api.post("/employees/upload-image", uploadData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const imageUrl = res.data.url;
        setFormData((prev) => ({ ...prev, profileImageUrl: imageUrl }));
        setImagePreview(`${STATIC_URL}${imageUrl}`);
        toast.success("تم رفع الصورة بنجاح");
      } catch (error) {
        toast.error("فشل رفع الصورة");
      } finally {
        setUploading(false);
      }
    }
  };

  const openCreate = () => {
    const savedDraft = readEmployeeWizardDraft(draftStorageKey);

    if (savedDraft?.formData) {
      restoreDraftIntoForm(savedDraft);
      toast.success("تم استعادة آخر مسودة غير مكتملة");
      return;
    }

    setHasRecoveredDraft(false);
    setEditingEmp(null);
    setOriginalEditForm(null);
    setEmployeeDocs([]);
    setFormData(defaultForm);
    setImagePreview(null);
    setActiveTab("personal");
    setIsModalOpen(true);
  };

  const openEdit = async (emp) => {
    try {
      setIsActionLoading(true);
      const res = await api.get(`/employees/${emp.id}`);
      const data = normalizeEmployeeRecord(res.data);
      const initialEditForm = {
        ...defaultForm,
        ...data,
        birthDate: deriveDateOnly(data.birthDate),
        hireDate: deriveDateOnly(data.hireDate),
        assistantOfBarberId: data.assistantOfBarberId?.toString() || "",
      };
      setEditingEmp(data);
      setOriginalEditForm(initialEditForm);
      setHasRecoveredDraft(false);
      setFormData(initialEditForm);
      setImagePreview(
        data.profileImageUrl ? `${STATIC_URL}${data.profileImageUrl}` : null,
      );
      setActiveTab("personal");
      setIsModalOpen(true);
    } catch (error) {
      toast.error("فشل تحميل بيانات الموظف التفصيلية");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSubmit = async () => {
    const firstInvalidStep = wizardTabs.find(
      (tab) => !validateStep(tab.id, { silent: true }),
    );
    if (firstInvalidStep) {
      setActiveTab(firstInvalidStep.id);
      validateStep(firstInvalidStep.id);
      return;
    }

    if (!formData.fullName || !formData.phonePrimary) {
      toast.error("يرجى إدخال الاسم ورقم الجوال الأساسي");
      return;
    }

    if (
      formData.jobTitle === "barber_assistant" &&
      !formData.assistantOfBarberId
    ) {
      toast.error("يرجى اختيار الحلاق المسؤول عن المساعد");
      return;
    }

    try {
      setIsActionLoading(true);

      const payload = {
        ...formData,
        display_name: formData.displayName?.trim() || formData.fullName?.trim(),
        assistantOfBarberId: formData.assistantOfBarberId
          ? parseInt(formData.assistantOfBarberId)
          : null,
      };

      let employeeId = editingEmp?.id;
      if (editingEmp) {
        await api.put(`/employees/${editingEmp.id}`, payload);
        toast.success("تم تحديث بيانات الموظف");
      } else {
        const res = await api.post("/employees", payload);
        employeeId = res.data.id;
        clearEmployeeWizardDraft(draftStorageKey);
        setHasRecoveredDraft(false);
        toast.success("تم إضافة الموظف بنجاح");
      }

      if (formData.hasLoginAccount && formData.username && formData.password) {
        try {
          await api.post("/users", {
            username: formData.username,
            password: formData.password,
            full_name: formData.fullName,
            role: formData.role,
            employee_id: employeeId,
            is_active: true,
          });
          toast.success("تم إنشاء حساب الدخول للموظف");
        } catch (userError) {
          toast.error(
            "الموظف تم حفظه ولكن فشل إنشاء حساب الدخول: " +
              (userError.response?.data?.detail || "اسم المستخدم موجود مسبقاً"),
          );
        }
      }

      setIsModalOpen(false);
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || "فشل حفظ بيانات الموظف");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.isLegacyRecord) {
      toast.error(
        "تعطيل الموظف غير متاح حالياً لأن الـ API الحالي لا يدعم حالة الموظف.",
      );
      setDeleteTarget(null);
      return;
    }
    try {
      setIsActionLoading(true);
      const nextStatus =
        deleteTarget.status === "active" ? "suspended" : "active";
      await api.put(`/employees/${deleteTarget.id}`, {
        status: nextStatus,
        isActive: nextStatus === "active",
      });
      toast.success(
        nextStatus === "active" ? "تم تفعيل الموظف" : "تم تعطيل الموظف",
      );
      setDeleteTarget(null);
      fetchEmployees();
    } catch (error) {
      toast.error("فشل تعديل حالة الموظف");
    } finally {
      setIsActionLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "personal":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className={STEP_INTRO_CLASS}>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-accent">
                هوية الموظف
              </div>
              <p className="mt-2 text-sm font-bold leading-7 text-main">
                اجعل الملف واضحًا من أول نظرة: الاسم، وسائل التواصل، ونبذة
                مختصرة تُستخدم داخليًا وتسويقيًا.
              </p>
            </div>

            <div className="md:col-span-2 flex flex-col items-center gap-6 mb-2">
              <div className="relative group">
                <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-[32px] border-2 border-dashed border-white/10 bg-white/5 ring-8 ring-white/5">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      className="w-full h-full object-cover"
                      alt="Preview"
                    />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-muted" />
                  )}
                </div>
                <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-[32px] bg-black/45 opacity-0 transition-all backdrop-blur-sm group-hover:opacity-100">
                  <span className="text-white text-xs font-black uppercase tracking-widest">
                    تغيير الصورة
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                </label>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                الحد الأقصى 20 ميجابايت (PNG, JPG)
              </p>
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <User size={14} className="text-accent" /> الاسم الكامل للموظف
              </label>
              <Input
                value={formData.fullName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                className={FIELD_INPUT_CLASS}
                placeholder="أدخل الاسم الثلاثي..."
              />
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <Phone size={14} className="text-accent" /> الجوال الأساسي
              </label>
              <Input
                value={formData.phonePrimary || ""}
                onChange={(e) =>
                  setFormData({ ...formData, phonePrimary: e.target.value })
                }
                className={FIELD_INPUT_LTR_CLASS}
                dir="ltr"
                placeholder="01xxxxxxxxx"
              />
              <p className={FIELD_HINT_CLASS}>
                استخدم رقمًا مباشرًا يسهل الرجوع إليه من فريق التشغيل والحجوزات.
              </p>
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <Phone size={14} className="text-muted" /> جوال الطوارئ
              </label>
              <Input
                value={formData.phoneSecondary || "" || ""}
                onChange={(e) =>
                  setFormData({ ...formData, phoneSecondary: e.target.value })
                }
                className={FIELD_INPUT_LTR_CLASS}
                dir="ltr"
              />
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <ShieldCheck size={14} className="text-muted" /> رقم الهوية
                الوطنية
              </label>
              <Input
                value={formData.nationalId || "" || ""}
                onChange={(e) =>
                  setFormData({ ...formData, nationalId: e.target.value })
                }
                className={FIELD_INPUT_LTR_CLASS}
                dir="ltr"
              />
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <Calendar size={14} className="text-muted" /> تاريخ الميلاد
              </label>
              <Input
                type="date"
                value={formData.birthDate || "" || ""}
                onChange={(e) =>
                  setFormData({ ...formData, birthDate: e.target.value })
                }
                className={FIELD_INPUT_CLASS}
              />
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <MapPin size={14} className="text-muted" /> منطقة السكن
              </label>
              <Input
                value={formData.governorate || "" || ""}
                onChange={(e) =>
                  setFormData({ ...formData, governorate: e.target.value })
                }
                className={FIELD_INPUT_CLASS}
                placeholder="المحافظة / المدينة"
              />
            </div>

            <div className="space-y-3 col-span-full">
              <label className={FIELD_LABEL_CLASS}>
                <FileText size={14} className="text-accent" /> نبذة مهنية
                (بالعربية)
              </label>
              <textarea
                value={formData.bioAr || ""}
                onChange={(e) =>
                  setFormData({ ...formData, bioAr: e.target.value })
                }
                className={`${FIELD_TEXTAREA_CLASS} h-32`}
                placeholder="صف خبرة الموظف ومهاراته ليظهر للعملاء في الموقع..."
              />
            </div>

            <div className="space-y-3 col-span-full">
              <label className={FIELD_LABEL_CLASS}>
                <FileText size={14} className="text-accent" /> Professional Bio
                (English)
              </label>
              <textarea
                value={formData.bioEn || ""}
                onChange={(e) =>
                  setFormData({ ...formData, bioEn: e.target.value })
                }
                className={`${FIELD_TEXTAREA_CLASS} h-32`}
                placeholder="Describe employee experience for the public site..."
                dir="ltr"
              />
            </div>
          </div>
        );
      case "work":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className={STEP_INTRO_CLASS}>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-accent">
                بنية التشغيل
              </div>
              <p className="mt-2 text-sm font-bold leading-7 text-main">
                حدّد هذا الدور كما سيظهر في النظام فعليًا: نوع العمل، الحالة،
                وأين يُسمح له بالظهور.
              </p>
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <Briefcase size={14} className="text-accent" /> المسمى الوظيفي
              </label>
              <Select
                value={formData.jobTitle || ""}
                onValueChange={(v) => {
                  const isBarber = v === "barber";
                  setFormData({
                    ...formData,
                    jobTitle: v,
                    showInBooking: isBarber,
                    showInPos: true,
                  });
                }}
              >
                <SelectTrigger className={FIELD_SELECT_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-premium">
                  {JOB_TITLES.map((jt) => (
                    <SelectItem
                      key={jt.value}
                      value={jt.value || ""}
                      className="font-bold"
                    >
                      {jt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <Clock size={14} className="text-accent" /> نظام التعاقد
              </label>
              <Select
                value={formData.employmentType || ""}
                onValueChange={(v) =>
                  setFormData({ ...formData, employmentType: v })
                }
              >
                <SelectTrigger className={FIELD_SELECT_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-premium">
                  {EMPLOYMENT_TYPES.map((et) => (
                    <SelectItem
                      key={et.value}
                      value={et.value || ""}
                      className="font-bold"
                    >
                      {et.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <Calendar size={14} className="text-muted" /> تاريخ الالتحاق
                بالعمل
              </label>
              <Input
                type="date"
                value={formData.hireDate || "" || ""}
                onChange={(e) =>
                  setFormData({ ...formData, hireDate: e.target.value })
                }
                className={FIELD_INPUT_CLASS}
              />
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <Activity size={14} className="text-accent" /> الحالة الوظيفية
              </label>
              <Select
                value={formData.status || ""}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    status: v,
                    isActive: v === "active",
                  })
                }
              >
                <SelectTrigger className={FIELD_SELECT_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-premium">
                  <SelectItem value="active" className="font-bold text-success">
                    نشط (Active)
                  </SelectItem>
                  <SelectItem
                    value="suspended"
                    className="font-bold text-danger"
                  >
                    موقوف (Suspended)
                  </SelectItem>
                  <SelectItem value="resigned" className="font-bold text-muted">
                    مستقيل (Resigned)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
              <div
                className={
                  FIELD_PANEL_CLASS + " flex items-center justify-between"
                }
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-main uppercase">
                    الظهور في نقطة البيع
                  </div>
                  <div className="text-[10px] font-bold text-muted uppercase tracking-widest">
                    إتاحة الموظف في شاشة الـ POS
                  </div>
                </div>
                <Switch
                  checked={formData.showInPos}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, showInPos: v })
                  }
                />
              </div>
              <div
                className={
                  FIELD_PANEL_CLASS + " flex items-center justify-between"
                }
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-main uppercase">
                    الظهور في الحجوزات
                  </div>
                  <div className="text-[10px] font-bold text-muted uppercase tracking-widest">
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
      case "financial":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className={STEP_INTRO_CLASS}>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-accent">
                الصورة المالية
              </div>
              <p className="mt-2 text-sm font-bold leading-7 text-main">
                اضبط الراتب والعمولات وقناة الصرف بشكل واضح حتى تصبح المراجعة
                أسرع وأقل عرضة للخطأ.
              </p>
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <DollarSign size={14} className="text-success" /> الراتب الأساسي
                المعتمد
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={formData.baseSalary || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      baseSalary: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={`${FIELD_INPUT_CLASS} pr-14 text-lg`}
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted uppercase">
                  ج.م
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <TrendingUp size={14} className="text-info" /> نسبة العمولة
                التشغيلية
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={formData.commissionRate || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      commissionRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={`${FIELD_INPUT_CLASS} pr-14 text-lg`}
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted uppercase">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <Plus size={14} className="text-success" /> الحوافز الشهرية
                الثابتة
              </label>
              <Input
                type="number"
                value={formData.fixedBonus || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    fixedBonus: parseFloat(e.target.value) || 0,
                  })
                }
                className={FIELD_INPUT_CLASS}
              />
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <Trash2 size={14} className="text-danger" /> الخصومات الافتراضية
              </label>
              <Input
                type="number"
                value={formData.defaultDeductions || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultDeductions: parseFloat(e.target.value) || 0,
                  })
                }
                className={FIELD_INPUT_CLASS}
              />
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>قناة صرف المستحقات</label>
              <Select
                value={formData.paymentMethod || ""}
                onValueChange={(v) =>
                  setFormData({ ...formData, paymentMethod: v })
                }
              >
                <SelectTrigger className={FIELD_SELECT_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="cash" className="font-bold">
                    نقدي (Cash)
                  </SelectItem>
                  <SelectItem value="wallet" className="font-bold">
                    محفظة إلكترونية (E-Wallet)
                  </SelectItem>
                  <SelectItem value="bank" className="font-bold">
                    تحويل بنكي (Bank Transfer)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>رقم الحساب / المحفظة</label>
              <Input
                value={
                  formData.walletNumber || formData.bankAccount || "" || ""
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    walletNumber: e.target.value,
                    bankAccount: e.target.value,
                  })
                }
                className={FIELD_INPUT_LTR_CLASS}
                dir="ltr"
                placeholder="IBAN or Phone Number"
              />
            </div>
          </div>
        );
      case "assistant":
        return (
          <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {formData.jobTitle !== "barber_assistant" && (
              <Card className="p-5 border-info/20 bg-info-soft/10 shadow-none flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center text-info shrink-0">
                  <Activity size={20} />
                </div>
                <p className="text-xs font-bold text-info leading-relaxed">
                  هذا القسم مخصص فقط لتحديد تبعية الموظف إذا كان يعمل بصفة
                  "مساعد حلاق". المساعدين يرتبطون بخبراء محددين لضمان دقة
                  التقارير.
                </p>
              </Card>
            )}
            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                الحلاق المسؤول (Supervisor)
              </label>
              <Select
                value={formData.assistantOfBarberId || ""}
                onValueChange={(v) =>
                  setFormData({ ...formData, assistantOfBarberId: v })
                }
              >
                <SelectTrigger className={FIELD_SELECT_CLASS}>
                  <SelectValue placeholder="اختر الخبير المسؤول..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {barbersList.map((b) => (
                    <SelectItem
                      key={b.id}
                      value={b.id.toString() || ""}
                      className="font-bold"
                    >
                      {b.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                بروتوكول المهام المسندة
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {ASSISTANT_TASKS.map((task) => (
                  <button
                    type="button"
                    key={task}
                    onClick={() => {
                      const current = formData.assistantTasksJson || [];
                      const next = current.includes(task)
                        ? current.filter((t) => t !== task)
                        : [...current, task];
                      setFormData({ ...formData, assistantTasksJson: next });
                    }}
                    className={`text-right px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${formData.assistantTasksJson?.includes(task) ? "bg-accent text-white border-accent shadow-lg shadow-accent/20" : "bg-soft text-muted border-border hover:bg-card hover:text-accent"}`}
                  >
                    {task}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={
                FIELD_PANEL_CLASS + " flex items-center justify-between"
              }
            >
              <div className="space-y-0.5">
                <div className="text-xs font-black text-main uppercase">
                  عمولة المساعد
                </div>
                <div className="text-[10px] font-bold text-muted uppercase tracking-widest">
                  هل يتقاضى الموظف نسبة إضافية مقابل كل عملية مساعدة؟
                </div>
              </div>
              <Switch
                checked={formData.receivesCommission}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, receivesCommission: v })
                }
              />
            </div>

            {formData.receivesCommission && (
              <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                <label className={FIELD_LABEL_CLASS}>
                  نسبة عمولة المساعد المعتمدة %
                </label>
                <Input
                  type="number"
                  value={formData.assistantCommissionRate || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      assistantCommissionRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={`${FIELD_INPUT_CLASS} text-lg`}
                />
              </div>
            )}
          </div>
        );
      case "documents":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between p-6 bg-soft/50 rounded-2xl border border-border/60">
              <div className="space-y-1">
                <h4 className="text-sm font-black text-main uppercase">
                  المرفقات والوثائق الرسمية
                </h4>
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                  رفع الهويات، عقود العمل، والشهادات الصحية
                </p>
              </div>
              <label className="cursor-pointer">
                <Button
                  variant="outline"
                  className="h-11 px-6 rounded-xl border-accent/20 text-accent font-black text-[10px] uppercase tracking-widest hover:bg-accent hover:text-white transition-all pointer-events-none"
                >
                  <Plus className="ml-2" size={16} /> رفع مستند جديد
                </Button>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleDocUpload}
                />
              </label>
            </div>

            {docLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Activity className="w-8 h-8 text-accent animate-pulse" />
                <p className="text-[10px] font-black text-muted uppercase tracking-widest">
                  جاري جلب المستندات المؤرشفة...
                </p>
              </div>
            ) : employeeDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-20 h-20 rounded-full bg-soft flex items-center justify-center text-muted/40 mb-4">
                  <FileText size={32} />
                </div>
                <p className="text-xs font-bold text-muted">
                  لا يوجد مستندات مؤرشفة لهذا الموظف حالياً.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employeeDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 bg-white border border-border/60 rounded-2xl flex items-center justify-between group hover:border-accent/40 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
                        <FileText size={20} />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-black text-main line-clamp-1">
                          {doc.title}
                        </div>
                        <div className="text-[9px] font-bold text-muted uppercase tracking-widest">
                          {new Date(doc.created_at).toLocaleDateString("ar-EG")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg text-info hover:bg-info-soft"
                        onClick={() =>
                          window.open(`${STATIC_URL}${doc.file_url}`, "_blank")
                        }
                      >
                        <FileDown size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg text-danger hover:bg-danger-soft"
                        onClick={() => handleDeleteDoc(doc.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case "system":
        return (
          <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="rounded-[24px] border border-accent/15 bg-accent/10 px-5 py-4">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-accent">
                التحكم في الوصول
              </div>
              <p className="mt-2 text-sm font-bold leading-7 text-main">
                فعّل حساب الدخول فقط عند الحاجة، واترك أقل مستوى وصول مناسب
                للدور لتقليل الأخطاء التشغيلية.
              </p>
            </div>

            <div className="flex items-center justify-between p-6 bg-accent-soft/30 rounded-2xl border border-accent/20">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/20">
                  <UserPlus size={28} strokeWidth={2} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-black text-accent uppercase">
                    صلاحيات دخول النظام
                  </div>
                  <div className="text-[10px] font-bold text-main/60 uppercase tracking-widest">
                    تفعيل حساب دخول للوحة التحكم أو تطبيق الخبراء
                  </div>
                </div>
              </div>
              <Switch
                checked={formData.hasLoginAccount}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, hasLoginAccount: v })
                }
              />
            </div>

            {formData.hasLoginAccount && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 border border-border/60 bg-soft/20 rounded-[28px] animate-in slide-in-from-top-6 duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="space-y-3 relative z-10">
                  <label className={FIELD_LABEL_CLASS}>
                    اسم المستخدم (Unique ID)
                  </label>
                  <Input
                    value={formData.username || "" || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className={`${FIELD_INPUT_LTR_CLASS} bg-white`}
                    dir="ltr"
                    placeholder="example.user"
                  />
                </div>
                <div className="space-y-3 relative z-10">
                  <label className={FIELD_LABEL_CLASS}>
                    كلمة المرور المشفرة
                  </label>
                  <Input
                    type="password"
                    value={formData.password || "" || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className={`${FIELD_INPUT_LTR_CLASS} bg-white`}
                    dir="ltr"
                    placeholder={
                      editingEmp ? "••••••••" : "أدخل كلمة المرور..."
                    }
                  />
                  {editingEmp && (
                    <p className="text-[9px] font-bold text-muted">
                      * اتركها فارغة إذا لم ترغب في التغيير
                    </p>
                  )}
                </div>
                <div className="space-y-3 md:col-span-2 relative z-10">
                  <label className={FIELD_LABEL_CLASS}>
                    مستوى الوصول (Access Role)
                  </label>
                  <Select
                    value={formData.role || ""}
                    onValueChange={(v) => setFormData({ ...formData, role: v })}
                  >
                    <SelectTrigger className={`${FIELD_SELECT_CLASS} bg-white`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {ROLES.map((r) => (
                        <SelectItem
                          key={r.value}
                          value={r.value || ""}
                          className="font-bold"
                        >
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className={FIELD_LABEL_CLASS}>
                <FileText size={14} className="text-muted" /> ملاحظات الملف
                الإداري
              </label>
              <textarea
                value={formData.personalNotes || "" || ""}
                onChange={(e) =>
                  setFormData({ ...formData, personalNotes: e.target.value })
                }
                className={`${FIELD_TEXTAREA_CLASS} h-32 font-medium`}
                placeholder="سجل أي ملاحظات إدارية، سلوكية، أو فنية تخص الموظف..."
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center erp-page-container">
        <div className="flex flex-col items-center gap-4 text-accent">
          <Activity className="w-12 h-12 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
            مزامنة قاعدة بيانات الموظفين...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 erp-page-container" dir="rtl">
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          deleteTarget?.status === "active"
            ? "تعطيل صلاحيات الموظف؟"
            : "إعادة تفعيل الموظف؟"
        }
        description={`سيتم تعديل حالة ${deleteTarget?.fullName || "الموظف"} التشغيلية وإمكانية دخوله للنظام.`}
        onConfirm={handleToggleStatus}
        loading={isActionLoading}
      />

      <Dialog
        open={!!advanceTarget}
        onOpenChange={(open) => !open && setAdvanceTarget(null)}
      >
        <DialogContent className="sm:max-w-112.5 rounded-[32px] p-0 overflow-hidden border-none shadow-premium">
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="text-2xl font-black text-main flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center text-success">
                <Banknote size={24} />
              </div>
              تسجيل سلفة مالية
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-muted mt-2">
              سيتم تسجيل السلفة كمصروف (بند سلف) وخصمها تلقائياً من راتب{" "}
              <span className="text-accent">{advanceTarget?.fullName}</span>{" "}
              لشهر {new Date().toLocaleString("ar-EG", { month: "long" })}.
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                  <DollarSign size={14} className="text-success" /> قيمة السلفة
                  (ج.م)
                </label>
                <Input
                  type="number"
                  value={advanceData.amount || ""}
                  onChange={(e) =>
                    setAdvanceData({ ...advanceData, amount: e.target.value })
                  }
                  placeholder="المبلغ..."
                  className="h-14 rounded-xl bg-soft border-border font-black text-lg"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={14} className="text-info" /> تاريخ السلفة
                </label>
                <Input
                  type="date"
                  value={advanceData.advanceDate || ""}
                  onChange={(e) =>
                    setAdvanceData({
                      ...advanceData,
                      advanceDate: e.target.value,
                    })
                  }
                  className="h-14 rounded-xl bg-soft border-border font-bold"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} className="text-muted" /> بيان السلفة /
                السبب
              </label>
              <textarea
                value={advanceData.description || ""}
                onChange={(e) =>
                  setAdvanceData({
                    ...advanceData,
                    description: e.target.value,
                  })
                }
                placeholder="اكتب تفاصيل السلفة هنا..."
                className="w-full h-24 rounded-2xl bg-soft border border-border p-4 text-sm font-bold focus:outline-none focus:border-accent transition-all resize-none"
              />
            </div>
          </div>

          <DialogFooter className="p-8 pt-0 flex gap-3">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => setAdvanceTarget(null)}
              className="h-12 flex-1 rounded-xl font-black uppercase tracking-widest"
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={loading}
              onClick={handleCreateAdvance}
              loading={isAdvancing}
              disabled={!advanceData.amount}
              className="h-12 flex-[2] rounded-xl font-black text-base shadow-lg shadow-success/20 bg-success hover:bg-success/90"
            >
              تأكيد السلفة <CheckCircle2 className="mr-2" size={18} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-main uppercase tracking-tight leading-none">
            إدارة الموظفين
          </h1>
          <p className="text-base font-medium text-muted">
            {stats.active} من أصل {stats.total} موظف نشط في المنظومة حالياً
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          <Button
            type="button"
            variant="outline"
            title="تصدير سجل الموظفين إلى Excel"
            onClick={() =>
              exportService.downloadExcel(
                "/exports/employees/excel",
                "employees_report",
              )
            }
            className="h-12 rounded-xl border-border px-6 text-xs font-black uppercase tracking-widest"
          >
            Excel <FileSpreadsheet className="mr-2 text-success" size={16} />
          </Button>
          <Button
            type="button"
            variant="outline"
            title="تصدير سجل الموظفين إلى CSV"
            onClick={() =>
              exportService.downloadCsv(
                "/exports/employees/csv",
                "employees_report",
              )
            }
            className="h-12 rounded-xl border-border px-6 text-xs font-black uppercase tracking-widest"
          >
            CSV <FileDown className="mr-2 text-info" size={16} />
          </Button>
          <Button
            type="button"
            variant="primary"
            title="إضافة ملف موظف جديد للمنظومة"
            disabled={loading}
            onClick={openCreate}
            className="h-12 flex-1 rounded-xl px-10 md:flex-none shadow-lg shadow-accent/20 font-black text-lg"
          >
            <Plus className="ml-2" size={20} strokeWidth={2.5} /> إضافة موظف
          </Button>
          <Button
            type="button"
            variant="outline"
            title="أرشيف الموظفين"
            disabled={loading}
            onClick={() => navigate("/owner/hr/archive")}
            className="h-12 flex-1 rounded-xl px-10 md:flex-none shadow-sm text-danger border-danger/30 hover:bg-danger hover:text-white transition-all font-black"
          >
            <Archive className="ml-2" size={20} /> الأرشيف
          </Button>
        </div>
      </div>

      <div className="relative w-full group">
        <Search
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors"
          size={20}
        />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="بحث سريع باسم الموظف أو رقم الجوال..."
          className="h-14 pr-12 rounded-2xl bg-card border-border/60 focus:border-accent shadow-sm text-base font-bold"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 pt-2">
        <div className="rounded-premium border border-border/60 bg-card p-7 shadow-soft flex items-center gap-6 group hover:border-accent/20 transition-all">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/20 transition-transform group-hover:scale-105">
            <Users size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">
              إجمالي الكادر
            </div>
            <div className="text-3xl font-black text-main tracking-tighter">
              {stats.total}{" "}
              <small className="text-[10px] font-bold mr-1">موظف</small>
            </div>
          </div>
        </div>

        <div className="rounded-premium border border-border/60 bg-card p-7 shadow-soft flex items-center gap-6 group hover:border-accent/20 transition-all">
          <div className="w-16 h-16 rounded-2xl bg-info flex items-center justify-center text-white shadow-lg shadow-info/20 transition-transform group-hover:scale-105">
            <Scissors size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">
              الحلاقون
            </div>
            <div className="text-3xl font-black text-main tracking-tighter">
              {stats.barbers}{" "}
              <small className="text-[10px] font-bold mr-1">خبير</small>
            </div>
          </div>
        </div>

        <div className="rounded-premium border border-border/60 bg-card p-7 shadow-soft flex items-center gap-6 group hover:border-accent/20 transition-all">
          <div className="w-16 h-16 rounded-2xl bg-warning flex items-center justify-center text-white shadow-lg shadow-warning/20 transition-transform group-hover:scale-105">
            <UserPlus size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">
              المساعدون
            </div>
            <div className="text-3xl font-black text-main tracking-tighter">
              {
                employees.filter((e) => e.jobTitle === "barber_assistant")
                  .length
              }{" "}
              <small className="text-[10px] font-bold mr-1">موظف</small>
            </div>
          </div>
        </div>
      </div>

      <Card className="p-4 border-border/60">
        <div className="flex items-center gap-2 bg-soft p-1.5 rounded-2xl border border-border w-fit mx-auto sm:mx-0">
          <button
            type="button"
            disabled={loading}
            onClick={() => setActiveView("cards")}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === "cards" ? "bg-accent text-white shadow-soft" : "text-muted hover:bg-card hover:text-accent"}`}
          >
            عرض البطاقات
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setActiveView("table")}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === "table" ? "bg-accent text-white shadow-soft" : "text-muted hover:bg-card hover:text-accent"}`}
          >
            عرض الجدول
          </button>
        </div>
      </Card>

      {activeView === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredEmployees.map((employee) => (
            <motion.div
              layout
              key={employee.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-card border border-border/60 rounded-premium p-8 shadow-soft hover:shadow-premium transition-all relative group overflow-hidden ${String(getEmployeeId(employee)) === String(highlightedEmployeeId) ? "ring-2 ring-accent/40 border-accent/40" : ""} ${employee.status !== "active" ? "opacity-60" : ""}`}
            >
              {employee.status !== "active" && (
                <div className="absolute top-0 right-0 left-0 bg-danger/10 text-danger text-[10px] font-black uppercase py-1 text-center border-b border-danger/20 z-10">
                  معلق إداريًا
                </div>
              )}

              <div className="absolute top-8 left-8 flex gap-3 z-20">
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={loading}
                  onClick={() => openEmployeePayroll(employee)}
                  className="w-10 h-10 rounded-xl border border-border group-hover:border-accent/20 shadow-sm text-accent"
                  title="فتح ملف الراتب"
                >
                  <DollarSign size={18} strokeWidth={2} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={loading}
                  onClick={() => openEmployeeAttendance(employee)}
                  className="w-10 h-10 rounded-xl border border-border group-hover:border-accent/20 shadow-sm text-info"
                  title="فتح سجل الحضور"
                >
                  <Clock size={18} strokeWidth={2} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={loading}
                  onClick={() => openEmployeeReports(employee)}
                  className="w-10 h-10 rounded-xl border border-border group-hover:border-accent/20 shadow-sm text-warning"
                  title="فتح تقرير الموظف"
                >
                  <FileText size={18} strokeWidth={2} />
                </Button>

                <Button
                  variant="secondary"
                  size="icon"
                  disabled={loading}
                  onClick={() => setAdvanceTarget(employee)}
                  className="w-10 h-10 rounded-xl border border-border group-hover:border-accent/20 shadow-sm text-success"
                  title="تسجيل سلفة"
                >
                  <Banknote size={18} strokeWidth={2} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={loading}
                  onClick={() => openEdit(employee)}
                  className="w-10 h-10 rounded-xl border border-border group-hover:border-accent/20 shadow-sm"
                  title="تعديل السجل"
                >
                  <Pencil size={18} strokeWidth={2} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={loading}
                  onClick={() => setDeleteTarget(employee)}
                  className={`w-10 h-10 rounded-xl transition-all ${employee.status === "active" ? "hover:bg-danger-soft text-danger/40 hover:text-danger" : "hover:bg-success-soft text-success/40 hover:text-success"}`}
                  title={
                    employee.status === "active"
                      ? "إيقاف الصلاحيات"
                      : "تفعيل الصلاحيات"
                  }
                >
                  {employee.status === "active" ? (
                    <XCircle size={18} strokeWidth={2.5} />
                  ) : (
                    <CheckCircle2 size={18} strokeWidth={2.5} />
                  )}
                </Button>
              </div>

              <div className="flex flex-col items-center text-center">
                <EmployeeAvatar
                  imageUrl={
                    employee.profileImageUrl || employee.profile_image_url
                  }
                  name={employee.fullName}
                  size="xl"
                  className="mb-6 group-hover:scale-105 transition-transform"
                />

                <div className="space-y-1">
                  <h3 className="text-xl font-black text-main leading-tight tracking-tight">
                    {employee.fullName || "موظف مجهول"}
                  </h3>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[10px] font-black text-accent uppercase tracking-widest">
                      {JOB_TITLES.find((j) => j.value === employee.jobTitle)
                        ?.label || employee.jobTitle}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                      {EMPLOYMENT_TYPES.find(
                        (et) => et.value === employee.employmentType,
                      )?.label || "دوام كامل"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mt-10">
                  <div className="p-4 bg-soft/50 rounded-2xl border border-border/40 text-center">
                    <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1.5 leading-none">
                      الراتب الأساسي
                    </div>
                    <div className="text-base font-black text-accent tracking-tighter leading-none">
                      {(employee.baseSalary || 0).toLocaleString()}{" "}
                      <small className="text-[10px] font-bold">ج.م</small>
                    </div>
                  </div>
                  <div className="p-4 bg-soft/50 rounded-2xl border border-border/40 text-center">
                    <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1.5 leading-none">
                      العمولة الحالية
                    </div>
                    <div className="text-base font-black text-main tracking-tighter leading-none">
                      {employee.commissionRate || 0}
                      <small className="text-[10px] font-bold mr-0.5">%</small>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-border/40 w-full flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-bold text-muted">
                    <span className="flex items-center gap-2">
                      <Phone
                        size={14}
                        className="text-accent"
                        strokeWidth={2.5}
                      />{" "}
                      {employee.phonePrimary || "---"}
                    </span>
                    <span className="flex items-center gap-2 uppercase tracking-tight">
                      <Calendar size={14} /> منذ{" "}
                      {new Date(employee.hireDate).getFullYear()}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="rounded-premium border-border/60 bg-card shadow-soft overflow-hidden transition-all hover:shadow-premium">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-border bg-soft/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                    الموظف
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                    المسمى الوظيفي
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                    الجوال
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                    الراتب
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                    الحالة
                  </th>
                  <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-muted">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="group transition-all hover:bg-accent-subtle/30"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <EmployeeAvatar
                          imageUrl={
                            employee.profileImageUrl ||
                            employee.profile_image_url
                          }
                          name={employee.fullName}
                          size="sm"
                          className="group-hover:scale-110 transition-transform"
                        />
                        <div className="space-y-0.5">
                          <div className="text-sm font-black text-main leading-none group-hover:text-accent transition-colors">
                            {employee.fullName}
                          </div>
                          <div className="text-[9px] font-bold text-muted uppercase tracking-widest">
                            معرف: #HR-{employee.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <Badge
                        variant="outline"
                        className="h-6 px-3 font-black text-[9px] uppercase tracking-widest"
                      >
                        {JOB_TITLES.find((j) => j.value === employee.jobTitle)
                          ?.label || employee.jobTitle}
                      </Badge>
                    </td>
                    <td
                      className="px-8 py-5 text-sm font-bold text-muted"
                      dir="ltr"
                    >
                      {employee.phonePrimary}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="text-sm font-black text-accent tracking-tighter">
                        {employee.baseSalary.toLocaleString()}{" "}
                        <small className="text-[10px] font-bold">ج.م</small>
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <Badge
                        variant={
                          employee.status === "active" ? "success" : "danger"
                        }
                        className="h-6 px-4 font-black text-[9px] uppercase tracking-widest"
                      >
                        {employee.status === "active"
                          ? "نشط حالياً"
                          : "معطل إدارياً"}
                      </Badge>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          disabled={loading}
                          onClick={() => setAdvanceTarget(employee)}
                          className="h-9 w-9 rounded-xl border border-border group-hover:border-accent/20 transition-all shadow-sm text-success"
                          title="تسجيل سلفة"
                        >
                          <Banknote size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          disabled={loading}
                          onClick={() => openEdit(employee)}
                          className="h-9 w-9 rounded-xl border border-border group-hover:border-accent/20 transition-all shadow-sm"
                          title="تحديث ملف الموظف"
                        >
                          <Pencil size={16} strokeWidth={2.5} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={loading}
                          onClick={() => setDeleteTarget(employee)}
                          className={`h-9 w-9 rounded-xl transition-all ${employee.status === "active" ? "hover:bg-danger-soft text-danger/40 hover:text-danger" : "hover:bg-success-soft text-success/40 hover:text-success"}`}
                          title={
                            employee.status === "active"
                              ? "تعطيل الصلاحيات"
                              : "إعادة تفعيل الموظف"
                          }
                        >
                          {employee.status === "active" ? (
                            <Trash2 size={16} strokeWidth={2.5} />
                          ) : (
                            <CheckCircle2 size={16} strokeWidth={2.5} />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="flex max-h-[92vh] max-w-[1240px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#101525]/96 p-0 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          dir="rtl"
        >
          <DialogHeader className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(180deg,#13192c_0%,#0f1526_100%)] px-6 py-7 text-center sm:px-8 sm:py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_35%),radial-gradient(circle_at_top_right,rgba(29,195,242,0.12),transparent_26%),radial-gradient(circle_at_top_left,rgba(212,162,100,0.12),transparent_24%)]" />
            <div className="absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative z-10 mx-auto max-w-5xl space-y-6">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Badge className="rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white">
                  {editingEmp ? "وضع التحديث" : "وضع الإنشاء"}
                </Badge>
                <Badge
                  className={`rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${jobBlueprint.badgeClass}`}
                >
                  {jobBlueprint.eyebrow}
                </Badge>
                <span className="text-[11px] font-black uppercase tracking-[0.24em] text-white/45">
                  المرحلة {activeTabIndex + 1} من {wizardTabs.length}
                </span>
              </div>

              <div className="space-y-2">
                <DialogTitle className="text-[2rem] font-black leading-[1.05] tracking-tight text-white sm:text-[2.9rem]">
                  {editingEmp ? "تحديث السجل الوظيفي" : "إضافة كادر وظيفي جديد"}
                </DialogTitle>
                <DialogDescription className="mx-auto max-w-3xl text-sm font-medium leading-7 text-white/68 sm:text-[15px]">
                  {editingEmp
                    ? `تحديث بيانات الموظف ${editingEmp.fullName} عبر لوحة أوضح بصرياً وأسرع في المراجعة والتنفيذ.`
                    : "أنشئ ملفاً وظيفياً أنظف وأكثر احترافية مع مؤشرات فورية توضّح ما تم وما ينقص قبل الاعتماد النهائي."}
                </DialogDescription>

                {editingEmp ? (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] ${
                        hasUnsavedEditChanges
                          ? "border-warning/30 bg-warning/10 text-warning"
                          : "border-success/20 bg-success/10 text-success"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          hasUnsavedEditChanges ? "bg-warning" : "bg-success"
                        }`}
                      />
                      {hasUnsavedEditChanges
                        ? `${editFieldChanges.length} تغييرات غير محفوظة`
                        : "لا توجد تغييرات معلقة"}
                    </div>
                    {editChangedTabs.slice(0, 3).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleWizardTabChange(tab.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/75 transition hover:bg-white/20"
                      >
                        <span>{tab.label}</span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px]">
                          {tab.changes.length}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : hasRecoveredDraft ? (
                  <div className="flex justify-center pt-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-white/80">
                      <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                      تم استرجاع مسودة محفوظة تلقائياً
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <div className="rounded-[24px] border border-white/10 bg-[#171f35]/88 p-4 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm sm:col-span-2 xl:col-span-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                        مسار التنفيذ
                      </div>
                      <div
                        className={`mt-2 text-lg font-black ${executiveStatusTone}`}
                      >
                        {executiveStatusLabel}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
                        التقدّم العام
                      </div>
                      <div className="mt-2 text-[1.6rem] font-black leading-none text-white">
                        {tabProgress.percent}
                        <span className="mr-1 text-sm text-white/45">%</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-accent to-cyan-300 transition-all duration-500"
                      style={{ width: `${tabProgress.percent}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#171f35]/88 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                    القسم الحالي
                  </div>
                  <div className="mt-3 text-base font-black text-white">
                    {activeTabMeta.label}
                  </div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                    {activeTabIndex + 1}/{wizardTabs.length}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#171f35]/88 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                    النمط
                  </div>
                  <div className="mt-3 text-base font-black text-white">
                    {employeeRoleLabel}
                  </div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                    {employmentLabel}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#171f35]/88 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                    الحقول
                  </div>
                  <div className="mt-3 text-[1.6rem] font-black leading-none text-white">
                    {tabProgress.completed}
                    <span className="mr-1 text-sm text-white/45">
                      / {tabProgress.total}
                    </span>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#171f35]/88 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                    الجاهزية
                  </div>
                  <div className="mt-3 text-[1.6rem] font-black leading-none text-white">
                    {readinessDoneCount}
                    <span className="mr-1 text-sm text-white/45">
                      / {readinessChecklist.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-5 sm:p-6">
              <div className="flex gap-2 overflow-x-auto rounded-[24px] border border-white/10 bg-[#11182c] p-2 custom-scrollbar">
                {wizardTabs.map((tab, index) =>
                  (() => {
                    const section = tabProgress.sections[tab.id] || {
                      completed: 0,
                      total: 1,
                    };
                    const isActive = activeTab === tab.id;
                    const isComplete = section.completed >= section.total;
                    return (
                      <button
                        type="button"
                        key={tab.id}
                        disabled={loading}
                        onClick={() => handleWizardTabChange(tab.id)}
                        className={`group flex min-h-[68px] min-w-[158px] flex-1 flex-col items-start justify-between rounded-[20px] border px-4 py-3 text-right transition-all ${
                          isActive
                            ? "border-cyan-400/30 bg-gradient-to-br from-cyan-400/18 to-accent/18 text-white shadow-lg shadow-cyan-500/10"
                            : "border-transparent bg-white/75 text-muted hover:border-accent/20 hover:bg-white hover:text-accent"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
                              isActive
                                ? "bg-white/14 text-white"
                                : "bg-soft text-main group-hover:bg-accent/10 group-hover:text-accent"
                            }`}
                          >
                            <tab.icon size={16} strokeWidth={2.3} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.25em]">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            {editingEmp && editChangesByTab[tab.id]?.length ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-black ${isActive ? "bg-white/20 text-white" : "bg-warning/10 text-warning"}`}
                              >
                                {editChangesByTab[tab.id].length}
                              </span>
                            ) : null}
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                isComplete
                                  ? isActive
                                    ? "bg-white"
                                    : "bg-success"
                                  : isActive
                                    ? "bg-white/45"
                                    : "bg-border"
                              }`}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[11px] font-black tracking-tight sm:text-xs">
                            {tab.label}
                          </div>
                          <div
                            className={`text-[9px] font-black uppercase tracking-[0.18em] ${
                              isActive ? "text-white/70" : "text-muted"
                            }`}
                          >
                            {tab.id === "documents" && !editingEmp
                              ? "متاح بعد الحفظ"
                              : `${section.completed}/${section.total} جاهز`}
                          </div>
                        </div>
                      </button>
                    );
                  })(),
                )}
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_220px_320px]">
                <div className="space-y-5">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <Card className="rounded-[28px] border border-white/10 bg-[#12192d] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-white/10 text-white">
                            <activeTabMeta.icon size={22} strokeWidth={2.2} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted">
                              البوصلة الحالية
                            </div>
                            <div className="text-2xl font-black tracking-tight text-main">
                              {jobBlueprint.title}
                            </div>
                            <p className="max-w-xl text-sm font-bold leading-7 text-muted/80">
                              {jobBlueprint.summary}
                            </p>
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                            إنجاز القسم
                          </div>
                          <div className="mt-2 text-[1.7rem] font-black leading-none text-main">
                            {activeSectionPercent}
                            <span className="mr-1 text-sm text-muted">%</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-accent to-cyan-300 transition-all duration-500"
                          style={{ width: `${activeSectionPercent}%` }}
                        />
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {executivePulseItems.map((item) => (
                          <div
                            key={item.label}
                            className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4"
                          >
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                              {item.label}
                            </div>
                            <div className="mt-2 text-sm font-black leading-6 text-main">
                              {item.value}
                            </div>
                            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted">
                              {item.meta}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="rounded-[28px] border border-white/10 bg-[#12192d] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted">
                        إشارة التنفيذ
                      </div>
                      <div
                        className={`mt-3 text-xl font-black leading-8 ${executiveStatusTone}`}
                      >
                        {executiveStatusLabel}
                      </div>
                      <div className="mt-5 space-y-3">
                        {(editingEmp
                          ? editChangedTabs.slice(0, 3)
                          : pendingReadiness.slice(0, 3)
                        ).map((item) => (
                          <div
                            key={editingEmp ? item.id : item.label}
                            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                          >
                            <span className="text-xs font-black text-main">
                              {editingEmp ? item.label : item.label}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                              {editingEmp
                                ? `${item.changes.length} تعديل`
                                : item.done
                                  ? "جاهز"
                                  : "قيد الإكمال"}
                            </span>
                          </div>
                        ))}
                        {!editingEmp && !pendingReadiness.length ? (
                          <div className="rounded-2xl border border-success/20 bg-success/10 px-4 py-4 text-center text-xs font-black text-success">
                            كل مؤشرات الاعتماد مكتملة وجاهزة للحفظ.
                          </div>
                        ) : null}
                      </div>
                    </Card>
                  </div>

                  <div className="min-h-[460px] rounded-[28px] border border-white/10 bg-[#12182a] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-7 erp-form-content">
                    {renderTabContent()}
                  </div>
                </div>

                <aside className="space-y-5 xl:sticky xl:top-0 xl:self-start">
                  <Card className="rounded-[28px] border border-white/10 bg-[#141b2f] p-5 text-center shadow-soft">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted">
                      الهوية الحية
                    </div>
                    <div className="mt-4 flex justify-center">
                      <EmployeeAvatar
                        imageUrl={imagePreview || formData.profileImageUrl}
                        name={employeeDisplayName}
                        size="xl"
                      />
                    </div>
                    <div className="mt-4 text-2xl font-black tracking-tight text-main">
                      {employeeDisplayName}
                    </div>
                    <div className="mt-1 text-sm font-black text-muted">
                      {employeeRoleLabel}
                    </div>
                    <Badge className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-main">
                      {employmentLabel}
                    </Badge>

                    <div className="mt-5 space-y-3 border-t border-white/10 pt-5 text-right">
                      {profileQuickRows.map((row) => (
                        <div
                          key={row.label}
                          className="space-y-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                        >
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                            {row.label}
                          </div>
                          <div
                            className="text-sm font-black text-main"
                            dir={row.ltr ? "ltr" : undefined}
                          >
                            {row.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="rounded-[28px] border border-white/10 bg-[#141b2f] p-5 shadow-soft">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted">
                      أولويات الدور
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {jobBlueprint.focus.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-main"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </Card>
                </aside>

                <aside className="space-y-5">
                  <Card className="overflow-hidden rounded-[28px] border border-white/10 bg-[#141b2f] shadow-soft">
                    <div
                      className={`border-b border-white/10 bg-gradient-to-br ${jobBlueprint.accent} p-5`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-muted">
                            بطاقة الكادر
                          </div>
                          <div className="text-xl font-black text-main">
                            ملخص تشغيلي
                          </div>
                        </div>
                        <Badge
                          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${jobBlueprint.badgeClass}`}
                        >
                          {formData.status === "active"
                            ? "نشط"
                            : formData.status === "suspended"
                              ? "موقوف"
                              : "غير مكتمل"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-5 p-5">
                      <div>
                        <div className="text-2xl font-black tracking-tight text-main">
                          {employeeDisplayName}
                        </div>
                        <div className="mt-2 text-sm font-bold text-muted">
                          {employeeRoleLabel} • {employmentLabel}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted">
                            الراتب
                          </div>
                          <div className="mt-2 text-lg font-black tracking-tight text-main">
                            {salaryPreview}{" "}
                            <span className="text-xs text-muted">ج.م</span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted">
                            العمولة
                          </div>
                          <div className="mt-2 text-lg font-black tracking-tight text-main">
                            {Number(
                              formData.commissionRate || 0,
                            ).toLocaleString("ar-EG")}
                            <span className="mr-1 text-xs text-muted">%</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 border-t border-white/10 pt-5">
                        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">
                          قنوات الظهور
                        </div>
                        <div className="grid gap-3">
                          {visibilityRows.map((row) => (
                            <div
                              key={row.label}
                              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                            >
                              <span className="text-xs font-black text-main">
                                {row.label}
                              </span>
                              <span
                                className={`text-[10px] font-black uppercase tracking-[0.2em] ${row.tone}`}
                              >
                                {row.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3 border-t border-white/10 pt-5">
                        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">
                          ما ينقص قبل الاعتماد
                        </div>
                        {pendingReadiness.length ? (
                          <div className="space-y-2">
                            {pendingReadiness.map((item) => (
                              <div
                                key={item.label}
                                className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs font-bold text-main"
                              >
                                {item.label}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-success/20 bg-success/10 px-4 py-4 text-center text-xs font-black text-success">
                            الملف جاهز بالكامل للاعتماد النهائي.
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>

                  {editingEmp ? (
                    <Card className="rounded-[28px] border border-white/10 bg-[#141b2f] p-5 shadow-soft">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">
                            مراجعة التحديث
                          </div>
                          <div className="mt-1 text-lg font-black text-main">
                            ملخص الفروقات
                          </div>
                        </div>
                        {hasUnsavedEditChanges ? (
                          <button
                            type="button"
                            onClick={restoreOriginalEditState}
                            className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-soft px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-main transition hover:border-accent/30 hover:text-accent"
                          >
                            <RotateCcw size={14} />
                            استعادة الأصل
                          </button>
                        ) : null}
                      </div>

                      {hasUnsavedEditChanges ? (
                        <div className="mt-5 space-y-3">
                          {editFieldChanges.slice(0, 4).map((change) => (
                            <div
                              key={change.key}
                              className="rounded-2xl border border-white/10 bg-white/5 p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleWizardTabChange(change.tabId)
                                  }
                                  className="text-right text-xs font-black text-main transition hover:text-accent"
                                >
                                  {change.label}
                                </button>
                                <span className="rounded-full bg-warning/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-warning">
                                  {
                                    wizardTabs.find(
                                      (tab) => tab.id === change.tabId,
                                    )?.label
                                  }
                                </span>
                              </div>
                              <div className="mt-3 grid gap-2 text-[11px] font-bold text-muted">
                                <div className="rounded-xl bg-white/90 px-3 py-2">
                                  قبل:{" "}
                                  <span className="text-main">
                                    {change.from}
                                  </span>
                                </div>
                                <div className="rounded-xl border border-accent/20 bg-accent/10 px-3 py-2">
                                  بعد:{" "}
                                  <span className="text-main">{change.to}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {editFieldChanges.length > 4 ? (
                            <div className="text-center text-[10px] font-black uppercase tracking-[0.22em] text-muted">
                              + {editFieldChanges.length - 4} تغييرات إضافية
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-5 rounded-[24px] border border-success/20 bg-success/10 p-5 text-center">
                          <div className="text-sm font-black text-success">
                            السجل متطابق مع النسخة المحفوظة
                          </div>
                          <p className="mt-2 text-xs font-bold leading-6 text-muted">
                            يمكنك مراجعة الأقسام بهدوء. زر الحفظ سيتفعل تلقائياً
                            بمجرد إجراء أي تغيير فعلي.
                          </p>
                        </div>
                      )}
                    </Card>
                  ) : (
                    <Card className="rounded-[28px] border border-white/10 bg-[#141b2f] p-5 shadow-soft">
                      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">
                        حالة المسودة
                      </div>
                      <div className="mt-2 text-lg font-black text-main">
                        {hasRecoveredDraft
                          ? "تم استرجاع نسخة سابقة من العمل"
                          : "الحفظ التلقائي يعمل أثناء الإنشاء"}
                      </div>
                      <p className="mt-3 text-xs font-bold leading-6 text-muted">
                        يتم حفظ التقدم تلقائياً بدون حفظ كلمة المرور، حتى تعود
                        لنفس المرحلة عند إغلاق النافذة أو الرجوع لاحقاً.
                      </p>
                      <div className="mt-5 border-t border-white/10 pt-5">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={loading || isActionLoading}
                          onClick={resetCreateDraft}
                          className="h-11 w-full rounded-2xl border-danger/30 text-[11px] font-black uppercase tracking-[0.18em] text-danger hover:bg-danger hover:text-white"
                        >
                          <Trash2 size={16} className="ml-2" />
                          مسح المسودة والبدء من جديد
                        </Button>
                      </div>
                    </Card>
                  )}

                  <Card className="rounded-[28px] border border-white/10 bg-[#141b2f] p-5 shadow-soft">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">
                          فحص الجودة
                        </div>
                        <div className="mt-1 text-lg font-black text-main">
                          جاهزية الاعتماد
                        </div>
                      </div>
                      <div className="rounded-2xl bg-soft px-4 py-3 text-center">
                        <div className="text-xl font-black text-main">
                          {readinessDoneCount}/{readinessChecklist.length}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {readinessChecklist.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-soft/40 px-4 py-3"
                        >
                          <span className="text-xs font-bold leading-6 text-main">
                            {item.label}
                          </span>
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                              item.done
                                ? "bg-success/10 text-success"
                                : "bg-danger/10 text-danger"
                            }`}
                          >
                            {item.done ? (
                              <CheckCircle2 size={16} strokeWidth={2.6} />
                            ) : (
                              <X size={16} strokeWidth={2.6} />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </aside>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-white/10 bg-[#0f1527]/92 px-5 py-4 backdrop-blur-xl sm:px-6">
            <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">
                  مسار التنفيذ
                </div>
                <div className="mt-1 text-sm font-bold text-main">
                  {isLastWizardStep
                    ? "أنت في المرحلة الأخيرة. راجع البيانات ثم اعتمد الحفظ."
                    : `الخطوة التالية: ${nextWizardTab?.label || "الاعتماد النهائي"}`}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                <Button
                  variant="secondary"
                  disabled={loading || isActionLoading}
                  onClick={() => setIsModalOpen(false)}
                  className="h-12 rounded-2xl px-5 font-black uppercase tracking-[0.18em]"
                >
                  إلغاء الأمر
                </Button>

                <Button
                  variant="outline"
                  disabled={loading || isActionLoading || isFirstWizardStep}
                  onClick={handlePrevStep}
                  className="h-12 rounded-2xl px-5 font-black uppercase tracking-[0.18em]"
                >
                  <ArrowRight size={18} className="ml-2" />
                  السابق
                </Button>

                {isLastWizardStep ? (
                  <Button
                    variant="primary"
                    loading={isActionLoading}
                    disabled={loading || (editingEmp && !hasUnsavedEditChanges)}
                    onClick={handleSubmit}
                    className="h-12 rounded-2xl px-7 font-black text-base shadow-lg shadow-accent/20"
                  >
                    <Save size={20} className="ml-2" />
                    {editingEmp
                      ? hasUnsavedEditChanges
                        ? `حفظ ${editFieldChanges.length} تعديل`
                        : "لا توجد تعديلات جديدة"
                      : "اعتماد إضافة الموظف"}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    disabled={loading || isActionLoading}
                    onClick={handleNextStep}
                    className="h-12 rounded-2xl px-7 font-black text-base shadow-lg shadow-accent/20"
                  >
                    التالي
                    <ArrowLeft size={18} className="mr-2" />
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRManagement;
