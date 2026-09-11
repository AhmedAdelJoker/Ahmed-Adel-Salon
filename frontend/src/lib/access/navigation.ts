export const NAV_ITEMS = [
  {
    key: "owner-dashboard",
    label: "لوحة المالك",
    shortLabel: "الرئيسية",
    hint: "نظرة تنفيذية على الأداء",
    to: "/owner",
    icon: "LayoutDashboard",
    roles: ["owner"],
    keywords: ["dashboard", "owner", "overview", "لوحة", "الرئيسية"],
  },
  {
    key: "manager-dashboard",
    label: "لوحة المدير",
    shortLabel: "الرئيسية",
    hint: "متابعة التشغيل اليومي",
    to: "/manager",
    icon: "LayoutDashboard",
    roles: ["manager"],
    keywords: ["dashboard", "manager", "operations", "لوحة", "الإدارة"],
  },
  {
    key: "cashier-dashboard",
    label: "لوحة الكاشير",
    shortLabel: "الرئيسية",
    hint: "الفواتير والحجوزات السريعة",
    to: "/cashier",
    icon: "LayoutDashboard",
    roles: ["cashier"],
    keywords: ["dashboard", "cashier", "billing", "لوحة", "الكاشير"],
  },
  {
    key: "barber-dashboard",
    label: "لوحة الحلاق",
    shortLabel: "الرئيسية",
    hint: "حضورك وجلساتك الحالية",
    to: "/barber",
    icon: "LayoutDashboard",
    roles: ["barber"],
    keywords: ["dashboard", "barber", "presence", "لوحة", "الحلاق"],
  },
  {
    key: "appointments",
    label: "الحجوزات",
    shortLabel: "الحجوزات",
    hint: "تأكيد ومتابعة المواعيد",
    to: "/bookings",
    icon: "CalendarDays",
    roles: ["owner", "manager", "cashier", "barber"],
    keywords: ["appointments", "booking", "calendar", "الحجوزات", "المواعيد"],
  },
  {
    key: "schedule",
    label: "الجدول",
    shortLabel: "الجدول",
    hint: "لوحة السحب والإفلات",
    to: "/schedule",
    icon: "CalendarRange",
    roles: ["owner", "manager", "cashier", "barber"],
    keywords: ["schedule", "planner", "drag", "الجدول", "التخطيط"],
  },
  {
    key: "reception-board",
    label: "لوحة الاستقبال",
    shortLabel: "الاستقبال",
    hint: "متابعة الطابور والحضور اليومي",
    to: "/reception-board",
    icon: "ClipboardList",
    roles: ["owner", "manager", "cashier", "barber"],
    keywords: ["reception", "queue", "الاستقبال", "الطابور"],
  },
  {
    key: "customers",
    label: "العملاء",
    shortLabel: "العملاء",
    hint: "قاعدة العملاء ووسائل التواصل",
    to: "/customers",
    icon: "Users",
    roles: ["owner", "manager", "cashier"],
    keywords: ["customers", "clients", "crm", "العملاء", "الزبائن"],
  },
  {
    key: "services",
    label: "الخدمات",
    shortLabel: "الخدمات",
    hint: "كتالوج الخدمات والأسعار",
    to: "/owner/services",
    icon: "Scissors",
    roles: ["owner"],
    keywords: ["services", "catalog", "haircut", "الخدمات", "الأسعار"],
  },
  {
    key: "inventory",
    label: "المخزون",
    shortLabel: "المخزون",
    hint: "المنتجات والكميات",
    to: "/inventory",
    icon: "Boxes",
    roles: ["owner", "manager", "cashier"],
    keywords: ["inventory", "stock", "products", "المخزون", "المنتجات"],
  },
  {
    key: "invoices",
    label: "الفواتير",
    shortLabel: "الفواتير",
    hint: "مركز الفوترة والدفع",
    to: "/invoices",
    icon: "Receipt",
    roles: ["owner", "manager", "cashier"],
    keywords: ["invoice", "billing", "payments", "الفواتير", "الدفع"],
  },
  {
    key: "expenses",
    label: "المصروفات",
    shortLabel: "المصروفات",
    hint: "متابعة الأرشيف والتصدير",
    to: "/expenses",
    icon: "Wallet",
    roles: ["owner", "manager"],
    keywords: ["expenses", "costs", "archive", "المصروفات", "الأرشيف"],
  },
  {
    key: "financial-reports",
    label: "التقارير المالية",
    shortLabel: "التقارير",
    hint: "الإيرادات وصافي الربح",
    to: "/owner/financial",
    icon: "BarChart3",
    roles: ["owner"],
    keywords: ["reports", "finance", "revenue", "التقارير", "المالية"],
  },
  {
    key: "payroll",
    label: "الرواتب",
    shortLabel: "الرواتب",
    hint: "دورة الرواتب والتصدير",
    to: "/owner/payroll",
    icon: "Archive",
    roles: ["owner"],
    keywords: ["payroll", "salary", "archive", "الرواتب", "المرتبات"],
  },
  {
    key: "hr",
    label: "إدارة الموظفين",
    shortLabel: "الموظفون",
    hint: "إدارة الفريق وساعات العمل",
    to: "/owner/hr",
    icon: "ShieldCheck",
    roles: ["owner"],
    keywords: ["barbers", "team", "staff", "الحلاقون", "الفريق"],
  },
  {
    key: "users",
    label: "المستخدمون والصلاحيات",
    shortLabel: "المستخدمون",
    hint: "التحكم في الأدوار والدخول",
    to: "/owner/settings?tab=users",
    icon: "KeyRound",
    roles: ["owner"],
    keywords: ["users", "roles", "permissions", "المستخدمون", "الصلاحيات"],
  },
  {
    key: "business-settings",
    label: "إعدادات النشاط",
    shortLabel: "النشاط",
    hint: "معلومات الصالون وساعات العمل",
    to: "/owner/business-settings",
    icon: "Settings",
    roles: ["owner"],
    keywords: ["business", "settings", "salon", "الإعدادات", "النشاط"],
  },
  {
    key: "accountant",
    label: "المركز المالي",
    shortLabel: "المالية",
    hint: "متابعة الحسابات والمصروفات",
    to: "/accountant",
    icon: "Wallet",
    roles: ["accountant"],
    keywords: ["accountant", "finance", "المحاسب", "المالية"],
  },
  {
    key: "preferences",
    label: "التفضيلات",
    shortLabel: "التفضيلات",
    hint: "الثيم واللغة والتنبيهات",
    to: "/settings",
    icon: "SlidersHorizontal",
    roles: ["owner", "manager", "cashier", "barber", "accountant"],
    keywords: ["preferences", "theme", "language", "التفضيلات", "اللغة"],
  },
  {
    key: "profile",
    label: "الملف الشخصي",
    shortLabel: "الملف",
    hint: "بيانات الحساب",
    to: "/settings",
    icon: "UserCircle",
    roles: ["owner", "manager", "cashier", "barber", "accountant"],
    keywords: ["profile", "account", "الملف", "الحساب"],
  },
];

export function normalizeNavRole(role: unknown): string {
  return String(role ?? "").trim().toLowerCase();
}

export function getNavigationItems(role) {
  const normalized = normalizeNavRole(role);
  return NAV_ITEMS.filter((item) =>
    item.roles.map((r) => normalizeNavRole(r)).includes(normalized),
  );
}

export function getDashboardPath(role) {
  switch (normalizeNavRole(role)) {
    case "barber":
      return "/barber";
    case "cashier":
      return "/cashier";
    case "manager":
      return "/manager";
    case "owner":
    case "admin":
      return "/owner";
    case "accountant":
      return "/accountant";
    default:
      return "/settings";
  }
}

export function buildQuickLinks(role) {
  const items = getNavigationItems(role);

  return [
    ...items,
    {
      key: "public-booking",
      label: "الحجز العام",
      shortLabel: "الحجز العام",
      hint: "فتح صفحة حجز العملاء",
      to: "/bookings",
      icon: "Sparkles",
      roles: ["owner", "manager", "cashier", "barber"],
      keywords: ["booking", "public", "reserve", "الحجز", "العميل"],
    },
  ];
}
