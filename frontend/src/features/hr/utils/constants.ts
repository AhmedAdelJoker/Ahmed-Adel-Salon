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
    accent: "bg-indigo-600",
    colors: { primary: "indigo", secondary: "slate" },
    icon: Briefcase,
    cardBg: "bg-indigo-50/10",
    badgeClass: "bg-indigo-100/50 text-indigo-700 border-indigo-200",
  },
  accountant: {
    eyebrow: "حوكمة مالية",
    title: "المراقب المالي",
    summary:
      "صلاحية كاملة لمراجعة التدفقات النقدية، تقديم التقارير التحليلية، وتدقيق كشوف الرواتب قبل التنفيذ.",
    focus: ["التدقيق المالي", "تحليل الربحية", "الرقابة النقدية"],
    accent: "bg-slate-800",
    colors: { primary: "slate", secondary: "indigo" },
    icon: Banknote,
    cardBg: "bg-slate-100/10",
    badgeClass: "bg-slate-900 text-white border-slate-900",
  },
  barber: {
    eyebrow: "هندسة المظهر",
    title: "Master Barber",
    summary:
      "خبير شامل في فنون الحلاقة، تصفيف الشعر، ونحت اللحية بأعلى معايير الإتقان.",
    focus: ["قص وتصفيف الشعر", "نحت اللحية", "علاجات الشعر"],
    accent: "bg-amber-500",
    colors: { primary: "amber", secondary: "orange" },
    icon: Scissors,
    cardBg: "bg-amber-50/10",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
  },
  cashier: {
    eyebrow: "إدارة النقدية",
    title: "مسؤول الصندوق",
    summary:
      "إدارة عمليات الدفع، إغلاق الورديات، والتأكد من مطابقة المبالغ النقدية.",
    focus: ["نقاط البيع", "تحصيل المدفوعات", "تقفيل الوردية"],
    accent: "bg-emerald-600",
    colors: { primary: "emerald", secondary: "teal" },
    icon: Receipt,
    cardBg: "bg-emerald-50/10",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  colorist: {
    eyebrow: "فن الألوان",
    title: "خبير الصبغ",
    summary:
      "أخصائي في كيمياء الألوان ومعالجة الشعر التالف بأحدث البروتوكولات الصحية.",
    focus: ["صبغ الشعر", "معالجة البروتين", "كيمياء الألوان"],
    accent: "bg-purple-600",
    colors: { primary: "purple", secondary: "pink" },
    icon: Sparkles,
    cardBg: "bg-purple-50/10",
    badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
  },
  esthetician: {
    eyebrow: "صحة البشرة",
    title: "أخصائي تجميل",
    summary:
      "تقديم خدمات تنظيف البشرة العميق والترطيب الفاخر باستخدام تقنيات Spa المتقدمة.",
    focus: ["تنظيف البشرة", "أقنعة النضارة", "مساج الوجه"],
    accent: "bg-emerald-500",
    colors: { primary: "emerald", secondary: "blue" },
    icon: Sparkles,
    cardBg: "bg-emerald-50/10",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  barber_assistant: {
    eyebrow: "إسناد فني",
    title: "مساعد فني",
    summary:
      "دعم لوجستي وفني كامل لخبراء الحلاقة، ضمان راحة العميل في منطقة الغسيل والتحضير.",
    focus: ["تحضير العميل", "تقنيات الغسيل", "تنظيم الأدوات"],
    accent: "bg-emerald-500",
    colors: { primary: "emerald", secondary: "teal" },
    icon: UserPlus,
    cardBg: "bg-emerald-50/10",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  receptionist: {
    eyebrow: "إدارة التجربة",
    title: "سفير الخدمة",
    summary: "نقطة الاتصال الأولى لضمان رحلة عميل سلسة، من الحجز وحتى الوداع.",
    focus: ["لباقة الاستقبال", "إدارة الحجوزات", "تحليل الرضا"],
    accent: "bg-cyan-500",
    colors: { primary: "cyan", secondary: "blue" },
    icon: Phone,
    cardBg: "bg-cyan-50/10",
    badgeClass: "bg-cyan-100 text-cyan-700 border-cyan-200",
  },
  cleaner: {
    eyebrow: "معايير السلامة",
    title: "مشرف الصحة",
    summary:
      "المسؤول عن بيئة العمل المعقمة، سلامة المرافق، والمظهر العام للصالون.",
    focus: ["تعقيم مستمر", "صحة المرافق", "إدارة المستهلكات"],
    accent: "bg-teal-600",
    colors: { primary: "gray", secondary: "teal" },
    icon: Trash2,
    cardBg: "bg-teal-50/10",
    badgeClass: "bg-teal-100 text-teal-700 border-teal-200",
  },
  owner: {
    eyebrow: "القيادة العليا",
    title: "المالك المستثمر",
    summary: "المسؤول عن الرؤية الاستراتيجية وتوسع العلامة التجارية.",
    focus: ["الرؤية الشاملة", "توسع الأعمال", "الرقابة الكلية"],
    accent: "bg-slate-900",
    colors: { primary: "slate", secondary: "gray" },
    icon: Crown,
    cardBg: "bg-slate-100/10",
    badgeClass: "bg-slate-900 text-white border-slate-900",
  },
  other: {
    eyebrow: "كادر مخصص",
    title: "موظف خاص",
    summary: "مهام إضافية وتخصصات نادرة حسب متطلبات نمو العمل.",
    focus: ["مرونة المهام"],
    accent: "bg-slate-400",
    colors: { primary: "slate", secondary: "gray" },
    icon: User,
    cardBg: "bg-slate-50/10",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
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
  "flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-500 uppercase";
export const FIELD_INPUT_CLASS =
  "h-12 rounded-xl border-slate-200 bg-white/50 px-4 font-bold text-slate-900 shadow-sm transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100";
export const FIELD_TEXTAREA_CLASS =
  "w-full rounded-xl border-slate-200 bg-white/50 p-4 text-sm font-bold text-slate-900 shadow-sm transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 resize-none";
export const FIELD_SELECT_CLASS =
  "h-12 rounded-xl border-slate-200 bg-white/50 px-4 font-bold text-slate-900 shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";
