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

export const JOB_TITLES = [
  { value: "owner", label: "المالك والمستثمر (Principal Owner)" },
  { value: "manager", label: "مدير عمليات التشغيل (Operations Manager)" },
  {
    value: "accountant",
    label: "المحاسب المالي والإداري (Financial & Admin Accountant)",
  },
  {
    value: "barber",
    label: "أخصائي حلاقة وتصفيف الشعر وعناية باللحية (Master Barber)",
  },
  { value: "colorist", label: "أخصائي تلوين ومعالجة الشعر (Color Specialist)" },
  {
    value: "esthetician",
    label: "أخصائي عناية بالبشرة والوجه (Skin Care Expert)",
  },
  {
    value: "barber_assistant",
    label: "مساعد فني / مسؤول تحضير (Technical Assistant)",
  },
  { value: "cashier", label: "كاشير ومسؤول صندوق (Cashier & POS)" },
  {
    value: "receptionist",
    label: "منسق تجربة العملاء (Guest Experience Coordinator)",
  },
  { value: "cleaner", label: "مسؤول مرافق وتعقيم (Sanitation Officer)" },
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
    title: "مدير تنفيذي",
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
    title: "المراقب المالي",
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
    title: "Master Barber",
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
    title: "مسؤول الصندوق",
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
    title: "خبير الصبغ",
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
    title: "أخصائي تجميل",
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
    title: "سفير الخدمة",
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
    title: "مشرف الصحة",
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
    title: "المالك المستثمر",
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
  { value: "owner", label: "Owner (المالك المستثمر)" },
  { value: "manager", label: "Manager (المدير التنفيذي)" },
  { value: "accountant", label: "Accountant (المحاسب المالي)" },
  { value: "cashier", label: "Cashier (الكاشير)" },
  { value: "barber", label: "Barber (حلاق)" },
  { value: "barber_assistant", label: "Barber Assistant (مساعد الحلاق)" },
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
  serviceIds: [],
};

export const FORM_TABS = [
  { id: "personal", label: "الهوية الشخصية", icon: User },
  { id: "work", label: "المسار الوظيفي", icon: Briefcase },
  { id: "skills", label: "المؤهلات والخدمات", icon: Scissors },
  { id: "financial", label: "الهيكل المالي", icon: DollarSign },
  { id: "assistant", label: "نظام المساعدين", icon: UserPlus },
  { id: "documents", label: "الأرشيف الرقمي", icon: FileText },
  { id: "system", label: "بوابة النظام", icon: ShieldCheck },
];

export const FIELD_LABEL_CLASS =
  "flex items-center gap-2 text-[10px] font-black tracking-widest text-muted uppercase";
export const FIELD_INPUT_CLASS =
  "h-12 rounded-xl border-border bg-soft px-4 font-bold text-main shadow-sm transition-all focus:border-accent focus:bg-card focus:ring-4 focus:ring-accent/10";
export const FIELD_TEXTAREA_CLASS =
  "w-full rounded-xl border-border bg-soft p-4 text-sm font-bold text-main shadow-sm transition-all focus:border-accent focus:bg-card focus:ring-4 focus:ring-accent/10 resize-none";
export const FIELD_SELECT_CLASS =
  "h-12 rounded-xl border-border bg-soft px-4 font-bold text-main shadow-sm focus:border-accent focus:ring-4 focus:ring-accent/10";
