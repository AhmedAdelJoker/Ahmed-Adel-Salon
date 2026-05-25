export const NAV_ITEMS = [
  {
    key: "owner-dashboard",
    label: "لوحة المالك",
    shortLabel: "الرئيسية",
    hint: "نظرة تنفيذية على الأداء",
    to: "/dashboard",
    icon: "LayoutDashboard",
    roles: ["owner"],
    keywords: ["dashboard", "owner", "overview", "لوحة", "الرئيسية"],
  },
  {
    key: "manager-dashboard",
    label: "لوحة المدير",
    shortLabel: "الرئيسية",
    hint: "متابعة التشغيل اليومي",
    to: "/manager-dashboard",
    icon: "LayoutDashboard",
    roles: ["manager"],
    keywords: ["dashboard", "manager", "operations", "لوحة", "الإدارة"],
  },
  {
    key: "cashier-dashboard",
    label: "لوحة الكاشير",
    shortLabel: "الرئيسية",
    hint: "الفواتير والحجوزات السريعة",
    to: "/cashier-dashboard",
    icon: "LayoutDashboard",
    roles: ["cashier"],
    keywords: ["dashboard", "cashier", "billing", "لوحة", "الكاشير"],
  },
  {
    key: "barber-dashboard",
    label: "لوحة الحلاق",
    shortLabel: "الرئيسية",
    hint: "حضورك وجلساتك الحالية",
    to: "/barber-dashboard",
    icon: "LayoutDashboard",
    roles: ["barber"],
    keywords: ["dashboard", "barber", "presence", "لوحة", "الحلاق"],
  },
  {
    key: "appointments",
    label: "الحجوزات",
    shortLabel: "الحجوزات",
    hint: "تأكيد ومتابعة المواعيد",
    to: "/appointments",
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
    key: "sessions",
    label: "الجلسات",
    shortLabel: "الجلسات",
    hint: "العمل الجاري داخل الصالون",
    to: "/sessions",
    icon: "ClipboardList",
    roles: ["owner", "manager", "cashier", "barber"],
    keywords: ["sessions", "work", "الجلسات", "الخدمة"],
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
    to: "/services",
    icon: "Scissors",
    roles: ["owner", "manager", "cashier"],
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
    to: "/financial-reports",
    icon: "BarChart3",
    roles: ["owner", "manager"],
    keywords: ["reports", "finance", "revenue", "التقارير", "المالية"],
  },
  {
    key: "payroll",
    label: "الرواتب",
    shortLabel: "الرواتب",
    hint: "دورة الرواتب والتصدير",
    to: "/payroll",
    icon: "Archive",
    roles: ["owner"],
    keywords: ["payroll", "salary", "archive", "الرواتب", "المرتبات"],
  },
  {
    key: "barbers",
    label: "الحلاقون",
    shortLabel: "الحلاقون",
    hint: "إدارة الفريق وساعات العمل",
    to: "/barbers",
    icon: "ShieldCheck",
    roles: ["owner", "manager"],
    keywords: ["barbers", "team", "staff", "الحلاقون", "الفريق"],
  },
  {
    key: "users",
    label: "المستخدمون والصلاحيات",
    shortLabel: "المستخدمون",
    hint: "التحكم في الأدوار والدخول",
    to: "/users",
    icon: "KeyRound",
    roles: ["owner", "manager"],
    keywords: ["users", "roles", "permissions", "المستخدمون", "الصلاحيات"],
  },
  {
    key: "business-settings",
    label: "إعدادات النشاط",
    shortLabel: "النشاط",
    hint: "معلومات الصالون وساعات العمل",
    to: "/business-settings",
    icon: "Settings",
    roles: ["owner", "manager"],
    keywords: ["business", "settings", "salon", "الإعدادات", "النشاط"],
  },
  {
    key: "preferences",
    label: "التفضيلات",
    shortLabel: "التفضيلات",
    hint: "الثيم واللغة والتنبيهات",
    to: "/preferences",
    icon: "SlidersHorizontal",
    roles: ["owner", "manager", "cashier", "barber"],
    keywords: ["preferences", "theme", "language", "التفضيلات", "اللغة"],
  },
  {
    key: "profile",
    label: "الملف الشخصي",
    shortLabel: "الملف",
    hint: "بيانات الحساب",
    to: "/profile",
    icon: "UserCircle",
    roles: ["owner", "manager", "cashier", "barber"],
    keywords: ["profile", "account", "الملف", "الحساب"],
  },
];

export function getNavigationItems(role) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function getDashboardPath(role) {
  switch (role) {
    case "barber":
      return "/barber-dashboard";
    case "cashier":
      return "/cashier-dashboard";
    case "manager":
      return "/manager-dashboard";
    case "owner":
      return "/dashboard";
    default:
      return "/profile";
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
      to: "/booking",
      icon: "Sparkles",
      roles: ["owner", "manager", "cashier", "barber"],
      keywords: ["booking", "public", "reserve", "الحجز", "العميل"],
    },
  ];
}
