import {
  Banknote,
  Briefcase,
  Crown,
  DollarSign,
  FileText,
  Phone,
  Receipt,
  Scissors,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  UserPlus,
} from "lucide-react";

/**
 * Short, familiar terms on purpose: the owner picks from this list while hiring,
 * and no one calls a receptionist "منسق تجربة العملاء" in a working salon. The
 * `value` codes are what roles, permissions and blueprints hang off — only the
 * labels shown to people change here, never the values.
 */
export const JOB_TITLES = [
  { value: "owner", label: "المالك" },
  { value: "manager", label: "مدير" },
  { value: "accountant", label: "محاسب" },
  { value: "barber", label: "حلاق" },
  { value: "colorist", label: "أخصائي صبغة" },
  { value: "esthetician", label: "أخصائي بشرة" },
  { value: "barber_assistant", label: "مساعد فني" },
  { value: "cashier", label: "كاشير" },
  { value: "receptionist", label: "استقبال" },
  { value: "cleaner", label: "عامل نظافة" },
  { value: "other", label: "أخرى" },
];

export const JOB_TITLE_BLUEPRINTS: Record<
  string,
  {
    eyebrow: string;
    title: string;
    summary: string;
    focus: string[];
    accent: string;
    colors: { primary: string; secondary: string };
    icon: typeof Briefcase;
    cardBg: string;
    badgeClass: string;
  }
> = {
  manager: {
    eyebrow: "قيادة استراتيجية",
    title: "مدير",
    summary:
      "المسؤول عن تحقيق الأهداف التشغيلية، قيادة الفريق، واعتماد التقارير الإدارية والخصومات.",
    focus: ["إدارة العمليات", "اعتماد التقارير", "تطوير الفريق"],
    accent: "bg-primary",
    colors: { primary: "primary", secondary: "info" },
    icon: Briefcase,
    cardBg: "bg-soft",
    badgeClass: "bg-primary-soft text-primary border-primary/20",
  },
  accountant: {
    eyebrow: "حوكمة مالية",
    title: "محاسب",
    summary:
      "صلاحية كاملة لمراجعة التدفقات النقدية، تقديم التقارير التحليلية، وتدقيق كشوف الرواتب قبل التنفيذ.",
    focus: ["التدقيق المالي", "تحليل الربحية", "الرقابة النقدية"],
    accent: "bg-info",
    colors: { primary: "info", secondary: "primary" },
    icon: Banknote,
    cardBg: "bg-soft",
    badgeClass: "bg-info-soft text-info border-info/20",
  },
  barber: {
    eyebrow: "هندسة المظهر",
    title: "حلاق",
    summary:
      "خبير شامل في فنون الحلاقة، تصفيف الشعر، ونحت اللحية بأعلى معايير الإتقان.",
    focus: ["قص وتصفيف الشعر", "نحت اللحية", "علاجات الشعر"],
    accent: "bg-warning",
    colors: { primary: "warning", secondary: "primary" },
    icon: Scissors,
    cardBg: "bg-soft",
    badgeClass: "bg-warning-soft text-warning border-warning/20",
  },
  cashier: {
    eyebrow: "إدارة النقدية",
    title: "كاشير",
    summary:
      "إدارة عمليات الدفع، إغلاق الورديات، والتأكد من مطابقة المبالغ النقدية.",
    focus: ["نقاط البيع", "تحصيل المدفوعات", "تقفيل الوردية"],
    accent: "bg-success",
    colors: { primary: "success", secondary: "info" },
    icon: Receipt,
    cardBg: "bg-soft",
    badgeClass: "bg-success-soft text-success border-success/20",
  },
  colorist: {
    eyebrow: "فن الألوان",
    title: "أخصائي صبغة",
    summary:
      "أخصائي في كيمياء الألوان ومعالجة الشعر التالف بأحدث البروتوكولات الصحية.",
    focus: ["صبغ الشعر", "معالجة البروتين", "كيمياء الألوان"],
    accent: "bg-primary",
    colors: { primary: "primary", secondary: "info" },
    icon: Sparkles,
    cardBg: "bg-soft",
    badgeClass: "bg-primary-soft text-primary border-primary/20",
  },
  esthetician: {
    eyebrow: "صحة البشرة",
    title: "أخصائي بشرة",
    summary:
      "تقديم خدمات تنظيف البشرة العميق والترطيب الفاخر باستخدام تقنيات Spa المتقدمة.",
    focus: ["تنظيف البشرة", "أقنعة النضارة", "مساج الوجه"],
    accent: "bg-info",
    colors: { primary: "info", secondary: "success" },
    icon: Sparkles,
    cardBg: "bg-soft",
    badgeClass: "bg-info-soft text-info border-info/20",
  },
  barber_assistant: {
    eyebrow: "إسناد فني",
    title: "مساعد فني",
    summary:
      "دعم لوجستي وفني كامل لخبراء الحلاقة، ضمان راحة العميل في منطقة الغسيل والتحضير.",
    focus: ["تحضير العميل", "تقنيات الغسيل", "تنظيم الأدوات"],
    accent: "bg-info",
    colors: { primary: "info", secondary: "success" },
    icon: UserPlus,
    cardBg: "bg-soft",
    badgeClass: "bg-info-soft text-info border-info/20",
  },
  receptionist: {
    eyebrow: "إدارة التجربة",
    title: "استقبال",
    summary: "نقطة الاتصال الأولى لضمان رحلة عميل سلسة، من الحجز وحتى الوداع.",
    focus: ["لباقة الاستقبال", "إدارة الحجوزات", "تحليل الرضا"],
    accent: "bg-info",
    colors: { primary: "info", secondary: "success" },
    icon: Phone,
    cardBg: "bg-soft",
    badgeClass: "bg-info-soft text-info border-info/20",
  },
  cleaner: {
    eyebrow: "معايير السلامة",
    title: "عامل نظافة",
    summary:
      "المسؤول عن بيئة العمل المعقمة، سلامة المرافق، والمظهر العام للصالون.",
    focus: ["تعقيم مستمر", "صحة المرافق", "إدارة المستهلكات"],
    accent: "bg-muted",
    colors: { primary: "muted", secondary: "muted" },
    icon: Trash2,
    cardBg: "bg-soft",
    badgeClass: "bg-soft text-muted border-border",
  },
  owner: {
    eyebrow: "القيادة العليا",
    title: "المالك",
    summary: "المسؤول عن الرؤية الاستراتيجية وتوسع العلامة التجارية.",
    focus: ["الرؤية الشاملة", "توسع الأعمال", "الرقابة الكلية"],
    accent: "bg-main",
    colors: { primary: "main", secondary: "muted" },
    icon: Crown,
    cardBg: "bg-soft",
    badgeClass: "bg-main text-inverse border-main",
  },
  other: {
    eyebrow: "كادر مخصص",
    title: "موظف خاص",
    summary: "مهام إضافية وتخصصات نادرة حسب متطلبات نمو العمل.",
    focus: ["مرونة المهام"],
    accent: "bg-muted/50",
    colors: { primary: "muted", secondary: "muted" },
    icon: User,
    cardBg: "bg-soft",
    badgeClass: "bg-soft text-muted border-border",
  },
};

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "دوام كامل" },
  { value: "part_time", label: "دوام جزئي" },
  { value: "temporary", label: "مؤقت" },
];

export const ROLES = [
  { value: "owner", label: "مالك (صلاحيات كاملة)" },
  { value: "manager", label: "مدير" },
  { value: "accountant", label: "محاسب" },
  { value: "cashier", label: "كاشير" },
  { value: "barber", label: "حلاق" },
  // `barber_assistant` is a job title, not a system role. It was listed here
  // and the backend has no such `UserRole`, so picking it sent an invalid role
  // and the whole create failed with 400. A barber assistant logs in as
  // `barber`; see `JOB_TITLE_TO_USER_ROLE`.
];

export const ASSISTANT_TASKS = [
  "غسيل الشعر",
  "تجهيز العميل",
  "تنظيف الأدوات",
  "تحضير الكرسي",
  "مساعدة في الخدمات الطويلة",
  "تنظيف منطقة العمل",
  "أخرى",
];

export const defaultForm = {
  fullName: "",
  displayName: "",
  phonePrimary: "",
  phoneSecondary: "",
  email: "",
  // Only meaningful for temporary/part-time; the Work step shows the field for
  // those and leaves it out otherwise.
  contractEndDate: "",
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
  // Local date, not `new Date().toISOString()` — that is UTC, so in Egypt
  // (UTC+2/3) a late-evening create stamped the previous day as the hire date.
  hireDate: new Date().toLocaleDateString("en-CA"),
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
  // A valid system role from the start. This used to be "employee", which the
  // backend rejects — see `JOB_TITLE_TO_USER_ROLE`.
  role: "barber",
  serviceIds: [],
};

export type FormStepId =
  | "personal"
  | "work"
  | "system"
  | "skills"
  | "financial"
  | "assistant"
  | "documents";

export interface FormStep {
  id: FormStepId;
  label: string;
  icon: typeof User;
}

/**
 * Which job titles each step applies to, and why.
 *
 * These steps used to vanish silently: pick "مدير" and "المؤهلات والخدمات" and
 * "نظام المساعدين" were simply not there, with nothing on screen to say so. The
 * owner filling the form had no way to tell a deliberate skip from a broken
 * stepper, and no way to find out whether the data they had just typed would be
 * kept. Naming the rule here means the UI can both hide the step and explain
 * the hiding.
 *
 * A step absent from this map is always shown.
 */
export const FORM_STEP_RULES: Partial<
  Record<FormStepId, { jobTitles: string[]; reason: string }>
> = {
  skills: {
    jobTitles: ["barber", "colorist", "esthetician"],
    reason:
      "المؤهلات والخدمة تُسجَّل لمقدمي الخدمة (حلاق، صبغة، بشرة) فقط.",
  },
  assistant: {
    jobTitles: ["barber_assistant"],
    reason: "ربط المساعد بالحلاق المسؤول لا ينطبق إلا على مسار المساعد.",
  },
};

export const FORM_TABS: FormStep[] = [
  { id: "personal", label: "الهوية الشخصية", icon: User },
  { id: "work", label: "المسار الوظيفي", icon: Briefcase },
  /*
    The system step comes third, before the role-specific ones. The role chosen
    in "work" decides visibility, the login account and the linked user's role,
    so it is the decision the rest of the form hangs off — asking for it after
    the financial and skills steps meant an owner who changed their mind had to
    walk back through two steps they had already filled in.
  */
  { id: "system", label: "بوابة النظام", icon: ShieldCheck },
  { id: "skills", label: "المؤهلات والخدمات", icon: Scissors },
  { id: "financial", label: "الهيكل المالي", icon: DollarSign },
  { id: "assistant", label: "نظام المساعدين", icon: UserPlus },
  { id: "documents", label: "الأرشيف الرقمي", icon: FileText },
];

export function isFormStepVisible(stepId: FormStepId, jobTitle?: string | null): boolean {
  const rule = FORM_STEP_RULES[stepId];
  if (!rule) return true;
  return rule.jobTitles.includes(String(jobTitle ?? ""));
}

/** The steps this job title actually asks for, in order. */
export function visibleFormTabs(jobTitle?: string | null): FormStep[] {
  return FORM_TABS.filter((tab) => isFormStepVisible(tab.id, jobTitle));
}

/**
 * The steps dropped for this job title, each with the reason, so the wizard can
 * say "these are not missing, they do not apply to this role".
 */
export function hiddenFormSteps(
  jobTitle?: string | null,
): Array<{ id: FormStepId; label: string; reason: string }> {
  return FORM_TABS.filter((tab) => !isFormStepVisible(tab.id, jobTitle)).map(
    (tab) => ({
      id: tab.id,
      label: tab.label,
      reason: FORM_STEP_RULES[tab.id]?.reason ?? "",
    }),
  );
}

export const FIELD_LABEL_CLASS =
  "flex items-center gap-2 text-[10px] font-black tracking-widest text-muted uppercase";
export const FIELD_INPUT_CLASS =
  "h-12 rounded-xl border-border bg-soft px-4 font-bold text-main shadow-sm transition-all focus:border-accent focus:bg-card focus:ring-4 focus:ring-accent/10";
export const FIELD_TEXTAREA_CLASS =
  "w-full rounded-xl border-border bg-soft p-4 text-sm font-bold text-main shadow-sm transition-all focus:border-accent focus:bg-card focus:ring-4 focus:ring-accent/10 resize-none";
export const FIELD_SELECT_CLASS =
  "h-12 rounded-xl border-border bg-soft px-4 font-bold text-main shadow-sm focus:border-accent focus:ring-4 focus:ring-accent/10";
