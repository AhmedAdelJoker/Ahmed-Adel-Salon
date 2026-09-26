import { lazy, type ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  Banknote,
  Calendar,
  CalendarDays,
  Clock,
  FileBarChart2,
  Globe,
  History,
  LayoutDashboard,
  LayoutGrid,
  Package,
  Receipt,
  Scissors,
  Settings,
  ShieldCheck,
  Store,
  TrendingUp,
  Trophy,
  UserCheck,
  UserCircle,
  UserPlus,
  Users,
  Users2,
  Wallet,
  Zap,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                   Roles                                    */
/* -------------------------------------------------------------------------- */

export const ROLES = Object.freeze({
  OWNER: ["OWNER", "ADMIN"],
  MANAGEMENT: ["OWNER", "ADMIN", "MANAGER"],
  FINANCE: ["OWNER", "ADMIN", "ACCOUNTANT"],
  FINANCE_MGMT: ["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT"],
  FRONT_DESK: ["OWNER", "ADMIN", "MANAGER", "CASHIER"],
  FRONT_DESK_ACC: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "ACCOUNTANT"],
  OPERATIONS: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "BARBER"],
  BARBER_ONLY: ["BARBER"],
  EVERYONE: [
    "OWNER",
    "ADMIN",
    "MANAGER",
    "CASHIER",
    "BARBER",
    "ACCOUNTANT",
  ],
});

/* -------------------------------------------------------------------------- */
/*                                Nav taxonomy                                */
/* -------------------------------------------------------------------------- */

export const NAV_GROUPS = Object.freeze([
  { id: "operations", title: "التشغيل" },
  { id: "barber", title: "قسم الحلاق" },
  { id: "management", title: "الإدارة" },
  { id: "finance", title: "المالية والتقارير" },
  { id: "system", title: "النظام" },
] as const);

export type NavGroupId = (typeof NAV_GROUPS)[number]["id"];

export type SearchCategory =
  | "تشغيل"
  | "العملاء"
  | "الإدارة"
  | "المالية"
  | "النظام";

export interface AppNavSpec {
  /** Sidebar / mobile label. */
  label: string;
  icon: LucideIcon;
  group: NavGroupId;
  /** Sort position inside the group. */
  order: number;
  /**
   * Nav roles. Defaults to the route's own `roles`. Declared separately only
   * when the menu should be narrower or wider than the route guard.
   */
  roles?: readonly string[];
  /** Show in the mobile bottom bar. */
  mobile?: boolean;
  /** Order in the mobile bottom bar. */
  mobileOrder?: number;
  /** Hide the label in the mobile bar and rely on the icon only. */
  mobileIconOnly?: boolean;
  /** Command-palette grouping. Omit to keep the page out of the palette. */
  searchCategory?: SearchCategory;
}

export interface AppRoute {
  /** React Router path pattern, may contain params (`/customers/:id`). */
  path: string;
  /** Code-split page component. Omitted for redirect-only entries. */
  component?: ComponentType;
  /**
   * Roles allowed to render this route. `undefined` means "any authenticated
   * user". Use `public: true` for unauthenticated routes.
   */
  roles?: readonly string[];
  /** Route is reachable without authentication. */
  public?: boolean;
  /** When set, the route renders a redirect to this path instead of a page. */
  redirectTo?: string;
  title: string;
  subtitle?: string;
  nav?: AppNavSpec;
  /**
   * Path of the page this component is also embedded in as a tab/panel.
   * The route stays standalone; the registry just records the relationship so
   * the two entry points cannot drift apart.
   */
  embeddedIn?: string;
  /**
   * Permission-matrix key. Defaults to `path`. Must match an entry in
   * `PERMISSION_PAGES` so per-user overrides resolve for param routes.
   */
  permissionKey?: string;
  /**
   * Grouping shown in the permissions matrix. Derived from the nav group when
   * the page has one; drilldown pages declare it directly.
   */
  permissionCategory?: string;
}

/** Nav group -> permissions-matrix category. */
const PERMISSION_CATEGORY_BY_GROUP: Record<NavGroupId, string> = {
  operations: "تشغيل",
  barber: "تشغيل",
  management: "إدارة",
  finance: "مالية",
  system: "النظام",
};

export interface PermissionPage {
  id: string;
  label: string;
  category: string;
  icon: LucideIcon;
}

/* -------------------------------------------------------------------------- */
/*                              Component loaders                             */
/* -------------------------------------------------------------------------- */

// Common
const Login = lazy(() => import("@/pages/common/Login"));
const PersonalSettings = lazy(() => import("@/pages/common/Settings"));
const ActivityLogs = lazy(() => import("@/pages/common/ActivityLogs"));

// Owner
const OwnerDashboard = lazy(() => import("@/pages/owner/ReportsDashboard"));
const HRManagement = lazy(() => import("@/pages/owner/HRManagement"));
const EmployeeArchive = lazy(() => import("@/pages/owner/EmployeeArchive"));
const PermissionsManagement = lazy(
  () => import("@/pages/owner/PermissionsManagement"),
);
const FinancialReports = lazy(() => import("@/pages/owner/FinancialReports"));
const EmployeeReports = lazy(() => import("@/pages/owner/EmployeeReports"));
const FinancialRules = lazy(() => import("@/pages/owner/FinancialRules"));
const DailySummaryReport = lazy(
  () => import("@/pages/owner/DailySummaryReport"),
);
const SmartAlerts = lazy(() => import("@/pages/owner/SmartAlerts"));
const Expenses = lazy(() => import("@/pages/owner/Expenses"));
const ExpensesArchive = lazy(() => import("@/pages/owner/ExpensesArchive"));
const Payroll = lazy(() => import("@/pages/owner/Payroll"));
const PayrollArchive = lazy(() => import("@/pages/owner/PayrollArchive"));
const OwnerSettings = lazy(() => import("@/pages/owner/Settings"));
const SecurityAccess = lazy(() => import("@/pages/owner/SecurityAccess"));
const Cashbox = lazy(() => import("@/pages/owner/Cashbox"));
const ServicesManagement = lazy(
  () => import("@/pages/owner/ServicesManagement"),
);
const InvoiceAdjustmentRequests = lazy(
  () => import("@/pages/owner/InvoiceAdjustmentRequests"),
);
const BusinessSettingsPage = lazy(
  () => import("@/pages/owner/BusinessSettingsPage"),
);
const OperationalReports = lazy(
  () => import("@/pages/owner/OperationalReports"),
);
const LoyaltySettingsPanel = lazy(
  () => import("@/pages/owner/LoyaltySettingsPanel"),
);
const OwnerWebsiteSettingsPage = lazy(
  () => import("@/pages/owner/OwnerWebsiteSettingsPage"),
);
const CustomerArchive = lazy(() => import("@/pages/owner/CustomerArchive"));

// Manager
const ManagerDashboard = lazy(
  () => import("@/pages/manager/ManagerDashboard"),
);
const AttendanceManagement = lazy(
  () => import("@/pages/manager/AttendanceManagement"),
);
const ApprovalCenter = lazy(() => import("@/pages/manager/ApprovalCenter"));

// Cashier / front desk
const POS = lazy(() => import("@/pages/cashier/POS/index"));
const Bookings = lazy(() => import("@/pages/cashier/Bookings"));
const Inventory = lazy(() => import("@/pages/cashier/Inventory"));
const CashierDashboard = lazy(
  () => import("@/pages/cashier/CashierDashboard"),
);
const Customers = lazy(() => import("@/pages/cashier/Customers"));
const CustomerDetail = lazy(() => import("@/pages/cashier/CustomerDetail"));
const Invoices = lazy(() => import("@/pages/cashier/Invoices"));
const InvoiceArchive = lazy(() => import("@/pages/cashier/InvoiceArchive"));
const SuppliesArchive = lazy(() => import("@/pages/cashier/SuppliesArchive"));
const ProductBundles = lazy(() => import("@/pages/cashier/ProductBundles"));
const Schedule = lazy(() => import("@/pages/cashier/Schedule"));
const ReceptionBoard = lazy(() => import("@/pages/cashier/ReceptionBoard"));

// Barber
const BarberDashboard = lazy(() => import("@/pages/barber/BarberDashboard"));
const BarberWorkStation = lazy(
  () => import("@/pages/barber/BarberWorkStation"),
);
const BarberClients = lazy(() => import("@/pages/barber/BarberClients"));
const BarberEarnings = lazy(() => import("@/pages/barber/BarberEarnings"));
const BarberAvailability = lazy(
  () => import("@/pages/barber/BarberAvailability"),
);
const BarberProfile = lazy(() => import("@/pages/barber/BarberProfile"));
const BarberBookings = lazy(() => import("@/pages/barber/BarberBookings"));

// Accountant
const AccountantDashboard = lazy(
  () => import("@/pages/accountant/AccountantDashboard"),
);

/* -------------------------------------------------------------------------- */
/*                             THE route registry                             */
/* -------------------------------------------------------------------------- */

/**
 * Single source of truth for every navigable surface in the app.
 *
 * The router, the sidebar, the mobile bottom bar, the command palette, the
 * header title and the permission matrix all derive from this list. Adding a
 * page here makes it appear everywhere at once; nothing needs to be registered
 * in a second place, so the menus cannot drift from the guards.
 */
export const APP_ROUTES: readonly AppRoute[] = [
  /* ------------------------------- public -------------------------------- */
  {
    path: "/login",
    component: Login,
    public: true,
    title: "دخول النظام الآمن",
  },

  /* ----------------------------- operations ------------------------------ */
  {
    path: "/owner",
    component: OwnerDashboard,
    roles: ROLES.OWNER,
    title: "التقارير الإحصائية",
    subtitle: "نظرة تشغيلية شاملة على الأداء اليومي.",
    nav: {
      label: "لوحة القيادة",
      icon: LayoutDashboard,
      group: "operations",
      order: 1,
      mobile: true,
      mobileOrder: 1,
      searchCategory: "المالية",
    },
  },
  {
    path: "/manager",
    component: ManagerDashboard,
    roles: ROLES.MANAGEMENT,
    title: "لوحة المدير",
    subtitle: "متابعة التشغيل والفريق والنتائج.",
    nav: {
      label: "لوحة المدير",
      icon: LayoutDashboard,
      group: "operations",
      order: 2,
      roles: ["MANAGER"],
      mobile: true,
      mobileOrder: 1,
    },
  },
  {
    path: "/cashier",
    component: CashierDashboard,
    roles: ROLES.FRONT_DESK,
    title: "لوحة الكاشير",
    nav: {
      label: "لوحة الكاشير",
      icon: LayoutDashboard,
      group: "operations",
      order: 3,
      roles: ["CASHIER"],
      mobile: true,
      mobileOrder: 1,
    },
  },
  {
    path: "/accountant",
    component: AccountantDashboard,
    roles: ["OWNER", "ADMIN", "ACCOUNTANT"],
    title: "المركز المالي",
    subtitle: "المركز المالي ومتابعة الحسابات.",
    nav: {
      label: "المركز المالي",
      icon: LayoutDashboard,
      group: "operations",
      order: 4,
      roles: ["ACCOUNTANT"],
      mobile: true,
      mobileOrder: 1,
    },
  },
  {
    path: "/pos",
    component: POS,
    roles: ROLES.FRONT_DESK,
    title: "نقطة البيع",
    subtitle: "إصدار الفواتير وإدارة المبيعات المباشرة.",
    nav: {
      label: "نقطة البيع",
      icon: Zap,
      group: "operations",
      order: 5,
      roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
      mobile: true,
      mobileOrder: 2,
      searchCategory: "تشغيل",
    },
  },
  {
    path: "/reception-board",
    component: ReceptionBoard,
    roles: ROLES.OPERATIONS,
    title: "لوحة الاستقبال",
    nav: {
      label: "لوحة الاستقبال",
      icon: LayoutGrid,
      group: "operations",
      order: 6,
      roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
      searchCategory: "تشغيل",
    },
  },
  {
    path: "/bookings",
    component: Bookings,
    roles: ROLES.OPERATIONS,
    title: "الحجوزات",
    subtitle: "إدارة الحجوزات والمواعيد.",
    nav: {
      label: "الحجوزات",
      icon: Calendar,
      group: "operations",
      order: 7,
      roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
      mobile: true,
      mobileOrder: 3,
      searchCategory: "تشغيل",
    },
  },
  {
    path: "/schedule",
    component: Schedule,
    roles: ROLES.OPERATIONS,
    title: "مخطط المواعيد",
    nav: {
      label: "مخطط المواعيد",
      icon: LayoutGrid,
      group: "operations",
      order: 8,
      roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
      searchCategory: "تشغيل",
    },
  },
  {
    path: "/customers",
    component: Customers,
    roles: ROLES.FRONT_DESK,
    title: "العملاء",
    subtitle: "إدارة بيانات العملاء وسجل الزيارات.",
    nav: {
      label: "العملاء",
      icon: Users,
      group: "operations",
      order: 9,
      roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
      mobile: true,
      mobileOrder: 4,
      searchCategory: "العملاء",
    },
  },
  {
    path: "/invoices",
    component: Invoices,
    roles: ROLES.FRONT_DESK,
    title: "الفواتير",
    subtitle: "الفواتير وتفاصيلها وإعادة الطباعة.",
    nav: {
      label: "الفواتير",
      icon: Receipt,
      group: "operations",
      order: 10,
      roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
      searchCategory: "المالية",
    },
  },
  {
    path: "/owner/adjustment-requests",
    component: InvoiceAdjustmentRequests,
    roles: ROLES.FINANCE_MGMT,
    title: "طلبات التعديل",
    nav: {
      label: "مركز القيادة والتحكم",
      icon: ShieldCheck,
      group: "operations",
      order: 11,
      roles: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"],
      searchCategory: "المالية",
    },
  },
  {
    path: "/approvals",
    component: ApprovalCenter,
    roles: [...ROLES.MANAGEMENT, "CASHIER", "ACCOUNTANT"],
    title: "مركز الموافقات",
    nav: {
      label: "مركز الموافقات",
      icon: ShieldCheck,
      group: "operations",
      order: 12,
    },
  },

  /* -------------------------------- barber -------------------------------- */
  {
    path: "/barber",
    component: BarberDashboard,
    roles: ROLES.BARBER_ONLY,
    title: "لوحة الحلاق",
    nav: {
      label: "لوحة الحلاق",
      icon: Scissors,
      group: "barber",
      order: 1,
      mobile: true,
      mobileOrder: 1,
    },
  },
  {
    path: "/barber/workstation",
    component: BarberWorkStation,
    roles: ROLES.BARBER_ONLY,
    title: "محطة العمل",
    nav: {
      label: "محطة العمل",
      icon: Clock,
      group: "barber",
      order: 2,
      mobile: true,
      mobileOrder: 2,
    },
  },
  {
    path: "/barber/clients",
    component: BarberClients,
    roles: ROLES.BARBER_ONLY,
    title: "عملائي",
    nav: {
      label: "عملائي",
      icon: Users2,
      group: "barber",
      order: 3,
      mobile: true,
      mobileOrder: 3,
    },
  },
  {
    path: "/barber/earnings",
    component: BarberEarnings,
    roles: ROLES.BARBER_ONLY,
    title: "أرباحي",
    nav: {
      label: "أرباحي",
      icon: Banknote,
      group: "barber",
      order: 4,
      mobile: true,
      mobileOrder: 4,
    },
  },
  {
    path: "/barber/availability",
    component: BarberAvailability,
    roles: ROLES.BARBER_ONLY,
    title: "جدولي",
    nav: {
      label: "جدولي",
      icon: CalendarDays,
      group: "barber",
      order: 5,
    },
  },
  {
    path: "/barber/profile",
    component: BarberProfile,
    roles: ROLES.BARBER_ONLY,
    title: "ملفي الشخصي",
    nav: {
      label: "ملفي الشخصي",
      icon: UserCircle,
      group: "barber",
      order: 6,
    },
  },
  {
    path: "/barber/bookings",
    component: BarberBookings,
    roles: ROLES.BARBER_ONLY,
    title: "حجوزاتي",
    nav: {
      label: "حجوزاتي",
      icon: Calendar,
      group: "barber",
      order: 7,
    },
  },

  /* ------------------------------ management ------------------------------ */
  {
    path: "/owner/hr",
    component: HRManagement,
    roles: [...ROLES.OWNER, "MANAGER"],
    title: "إدارة الموارد البشرية",
    nav: {
      label: "إدارة الموظفين",
      icon: UserPlus,
      group: "management",
      order: 1,
      roles: ["OWNER", "ADMIN", "MANAGER"],
      searchCategory: "الإدارة",
    },
  },
  {
    path: "/attendance",
    component: AttendanceManagement,
    roles: [...ROLES.MANAGEMENT, "CASHIER", "ACCOUNTANT"],
    title: "الحضور والانضباط",
    nav: {
      label: "الحضور والانضباط",
      icon: UserCheck,
      group: "management",
      order: 2,
      roles: ["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT", "CASHIER"],
      searchCategory: "الإدارة",
    },
  },
  {
    path: "/inventory",
    component: Inventory,
    roles: ROLES.FRONT_DESK_ACC,
    title: "المخزون",
    subtitle: "متابعة المنتجات والمخزون.",
    nav: {
      label: "المخزن",
      icon: Package,
      group: "management",
      order: 3,
      roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN", "ACCOUNTANT"],
      mobile: true,
      mobileOrder: 5,
      searchCategory: "تشغيل",
    },
  },

  /* -------------------------------- finance -------------------------------- */
  {
    path: "/expenses",
    component: Expenses,
    roles: ROLES.FRONT_DESK_ACC,
    title: "المصروفات",
    subtitle: "تسجيل ومراجعة المصروفات.",
    nav: {
      label: "المصروفات",
      icon: TrendingUp,
      group: "finance",
      order: 1,
      roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN", "ACCOUNTANT"],
      searchCategory: "المالية",
    },
  },
  {
    path: "/owner/cashbox",
    component: Cashbox,
    roles: [...ROLES.OWNER, "CASHIER", "ACCOUNTANT"],
    title: "خزينة المحل",
    nav: {
      label: "خزينة المحل",
      icon: Wallet,
      group: "finance",
      order: 2,
      roles: ["OWNER", "ADMIN", "CASHIER", "ACCOUNTANT"],
    },
  },
  {
    path: "/owner/payroll",
    component: Payroll,
    roles: ROLES.FINANCE_MGMT,
    title: "إدارة الرواتب",
    nav: {
      label: "الرواتب",
      icon: Wallet,
      group: "finance",
      order: 3,
      roles: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"],
    },
  },
  {
    path: "/owner/reports",
    component: OperationalReports,
    roles: ROLES.FINANCE_MGMT,
    title: "التقارير التشغيلية",
    subtitle: "تحليل الأداء التشغيلي المتقدم.",
    nav: {
      label: "التقارير التشغيلية",
      icon: FileBarChart2,
      group: "finance",
      order: 4,
      roles: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"],
      searchCategory: "المالية",
    },
  },
  {
    path: "/owner/employee-reports",
    component: EmployeeReports,
    roles: ROLES.FINANCE,
    title: "تقارير الموظفين",
    nav: {
      label: "تقارير الموظفين",
      icon: Users,
      group: "finance",
      order: 5,
      roles: ["OWNER", "ADMIN", "ACCOUNTANT"],
    },
  },
  {
    path: "/owner/financial",
    component: FinancialReports,
    roles: ROLES.FINANCE,
    title: "التقارير المالية",
    subtitle: "تحليل الإيرادات والمصروفات ومؤشرات الأداء.",
    nav: {
      label: "التقارير المالية",
      icon: TrendingUp,
      group: "finance",
      order: 6,
      roles: ["OWNER", "ADMIN", "ACCOUNTANT"],
      searchCategory: "المالية",
    },
  },
  {
    path: "/owner/daily-summary",
    component: DailySummaryReport,
    roles: ROLES.FINANCE,
    title: "الملخص التشغيلي اليومي",
    subtitle: "الملخص التشغيلي الشامل لكافة الورديات والمصروفات.",
    nav: {
      label: "الملخص اليومي",
      icon: Activity,
      group: "finance",
      order: 7,
      roles: ["OWNER", "ADMIN", "ACCOUNTANT"],
    },
  },
  {
    path: "/owner/financial-rules",
    component: FinancialRules,
    roles: ROLES.OWNER,
    title: "القواعد المالية",
    nav: {
      label: "القواعد المالية",
      icon: ShieldCheck,
      group: "finance",
      order: 8,
      roles: ["OWNER", "ADMIN"],
    },
  },

  /* --------------------------------- system -------------------------------- */
  {
    path: "/owner/settings",
    component: OwnerSettings,
    roles: [...ROLES.OWNER, "MANAGER"],
    title: "الإعدادات",
    nav: {
      label: "إعدادات المحل",
      icon: Settings,
      group: "system",
      order: 1,
      roles: ["OWNER", "ADMIN", "MANAGER"],
      searchCategory: "النظام",
    },
  },
  {
    path: "/owner/business-settings",
    component: BusinessSettingsPage,
    roles: ROLES.OWNER,
    title: "إعدادات النشاط",
    subtitle: "بيانات الصالون والفاتورة والحجز العام.",
    embeddedIn: "/owner/settings",
    nav: {
      label: "بيانات المنشأة",
      icon: Store,
      group: "system",
      order: 2,
      roles: ["OWNER", "ADMIN"],
      searchCategory: "النظام",
    },
  },
  {
    path: "/owner/services",
    component: ServicesManagement,
    roles: ROLES.OWNER,
    title: "إدارة الخدمات",
    subtitle: "إدارة الخدمات والأسعار والتصنيفات.",
    embeddedIn: "/owner/settings",
    nav: {
      label: "الخدمات والعروض",
      icon: Scissors,
      group: "system",
      order: 3,
      roles: ["OWNER", "ADMIN"],
    },
  },
  {
    path: "/owner/website-settings",
    component: OwnerWebsiteSettingsPage,
    roles: ROLES.OWNER,
    title: "إعدادات الموقع",
    embeddedIn: "/owner/settings",
    nav: {
      label: "إعدادات الموقع",
      icon: Globe,
      group: "system",
      order: 4,
      roles: ["OWNER", "ADMIN"],
    },
  },
  {
    path: "/owner/loyalty-settings",
    component: LoyaltySettingsPanel,
    roles: ROLES.OWNER,
    title: "نظام الولاء",
    embeddedIn: "/owner/settings",
    nav: {
      label: "نظام الولاء",
      icon: Trophy,
      group: "system",
      order: 5,
      roles: ["OWNER", "ADMIN"],
    },
  },
  {
    path: "/owner/permissions",
    component: PermissionsManagement,
    roles: ROLES.OWNER,
    title: "صلاحيات الوصول",
    nav: {
      label: "صلاحيات الوصول",
      icon: ShieldCheck,
      group: "system",
      order: 6,
      roles: ["OWNER", "ADMIN"],
    },
  },
  {
    path: "/owner/security-access",
    component: SecurityAccess,
    roles: [...ROLES.MANAGEMENT, "CASHIER", "ACCOUNTANT"],
    title: "الأمان والوصول",
    embeddedIn: "/owner/settings",
    nav: {
      label: "الأمان والوصول",
      icon: ShieldCheck,
      group: "system",
      order: 7,
      roles: ["OWNER", "ADMIN"],
    },
  },
  {
    path: "/owner/alerts",
    component: SmartAlerts,
    roles: ROLES.OWNER,
    title: "التنبيهات الذكية",
    nav: {
      label: "التنبيهات الذكية",
      icon: Zap,
      group: "system",
      order: 8,
      roles: ["OWNER", "ADMIN"],
    },
  },
  {
    path: "/settings",
    component: PersonalSettings,
    roles: ROLES.EVERYONE,
    title: "الإعدادات الشخصية",
    nav: {
      label: "الإعدادات الشخصية",
      icon: UserCheck,
      group: "system",
      order: 9,
      roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "ACCOUNTANT"],
    },
  },
  {
    path: "/activity-logs",
    component: ActivityLogs,
    roles: [...ROLES.MANAGEMENT, "CASHIER", "ACCOUNTANT"],
    title: "سجلات النشاط",
    nav: {
      label: "سجلات الرقابة",
      icon: History,
      group: "system",
      order: 10,
      roles: ["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT"],
    },
  },

  /* ---------------------- drill-downs (no menu entry) ---------------------- */
  {
    path: "/customers/:id",
    component: CustomerDetail,
    roles: ROLES.FRONT_DESK_ACC,
    title: "ملف العميل",
    permissionCategory: "تشغيل",
  },
  {
    path: "/owner/customers/archive",
    component: CustomerArchive,
    roles: ROLES.FRONT_DESK_ACC,
    title: "أرشيف العملاء",
    subtitle: "العملاء المؤرشفون واستعادتهم.",
    permissionCategory: "تشغيل",
  },
  {
    path: "/invoices/archive",
    component: InvoiceArchive,
    roles: ROLES.FRONT_DESK_ACC,
    title: "أرشيف الفواتير",
    subtitle: "أرشيف الفواتير الشهري والإغلاقات.",
    permissionCategory: "مالية",
  },
  {
    path: "/inventory/archive",
    component: SuppliesArchive,
    roles: ROLES.FRONT_DESK_ACC,
    title: "أرشيف المخزن",
    subtitle: "سجل حركة المخزن والمنتجات المؤرشفة.",
    permissionCategory: "تشغيل",
  },
  {
    path: "/inventory/bundles",
    component: ProductBundles,
    roles: ROLES.FRONT_DESK_ACC,
    title: "باقات المنتجات",
    permissionCategory: "تشغيل",
  },
  {
    path: "/expenses/archive",
    component: ExpensesArchive,
    roles: [...ROLES.MANAGEMENT, "CASHIER", "ACCOUNTANT"],
    title: "أرشيف المصروفات",
    permissionCategory: "مالية",
  },
  {
    path: "/owner/expenses/archive",
    component: ExpensesArchive,
    roles: [...ROLES.MANAGEMENT, "CASHIER", "ACCOUNTANT"],
    title: "أرشيف المصروفات",
  },
  {
    path: "/owner/hr/archive",
    component: EmployeeArchive,
    roles: [...ROLES.OWNER, "MANAGER"],
    title: "أرشيف الموظفين",
    permissionCategory: "إدارة",
  },
  {
    path: "/owner/payroll/archive",
    component: PayrollArchive,
    roles: ROLES.FINANCE_MGMT,
    title: "أرشيف الرواتب",
    permissionCategory: "مالية",
  },

  /* ------------------------------ legacy aliases --------------------------- */
  // Guards are kept on the aliases so a role that cannot open the target is
  // stopped here, exactly as before, instead of bouncing through it.
  { path: "/profile", redirectTo: "/settings", title: "الملف الشخصي" },
  {
    path: "/dashboard",
    redirectTo: "/owner",
    roles: ROLES.OWNER,
    title: "لوحة القيادة",
  },
  {
    path: "/manager-dashboard",
    redirectTo: "/manager",
    roles: [...ROLES.MANAGEMENT, "CASHIER", "ACCOUNTANT"],
    title: "لوحة المدير",
  },
  {
    path: "/cashier-dashboard",
    redirectTo: "/cashier",
    roles: ROLES.FRONT_DESK,
    title: "لوحة الكاشير",
  },
  {
    path: "/barber-dashboard",
    redirectTo: "/barber",
    roles: ROLES.BARBER_ONLY,
    title: "لوحة الحلاق",
  },
  {
    path: "/accountant-dashboard",
    redirectTo: "/accountant",
    roles: ["OWNER", "ADMIN", "ACCOUNTANT"],
    title: "المركز المالي",
  },
  {
    path: "/appointments",
    redirectTo: "/bookings",
    roles: ROLES.OPERATIONS,
    title: "الحجوزات",
  },
  {
    path: "/invoice-archive",
    redirectTo: "/invoices/archive",
    roles: ROLES.FRONT_DESK_ACC,
    title: "أرشيف الفواتير",
  },
  {
    path: "/owner/preferences",
    redirectTo: "/owner/settings?tab=preferences",
    roles: ROLES.OWNER,
    title: "التفضيلات",
  },
  {
    path: "/owner/users",
    redirectTo: "/owner/settings?tab=users",
    roles: ROLES.OWNER,
    title: "إدارة المستخدمين",
  },
  {
    path: "/owner/working-hours",
    redirectTo: "/owner/settings?tab=hours",
    roles: [...ROLES.OWNER, "MANAGER"],
    title: "ساعات العمل",
  },
] as const;

/* -------------------------------------------------------------------------- */
/*                              Derived helpers                               */
/* -------------------------------------------------------------------------- */

const PAGE_ROUTES = APP_ROUTES.filter(
  (route) => !route.public && !route.redirectTo,
);

const NAV_ROUTES = PAGE_ROUTES.filter((route) => route.nav);

/** Match a concrete pathname against a React Router path pattern. */
function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+*?^${}()|[\]\\]/g, "\\$&")
    .replace(/:[A-Za-z0-9_]+/g, "[^/]+");
  return new RegExp(`^${escaped}/?$`);
}

const PATTERN_CACHE = new Map<string, RegExp>();

function patternCache(pattern: string): RegExp {
  let re = PATTERN_CACHE.get(pattern);
  if (!re) {
    re = patternToRegExp(pattern);
    PATTERN_CACHE.set(pattern, re);
  }
  return re;
}

/**
 * Resolve a live pathname to its registry entry.
 *
 * This is what fixes param routes (`/customers/42`) and the permission lookup,
 * both of which previously compared raw pathnames against static keys.
 */
export function matchRoute(pathname: string): AppRoute | undefined {
  if (!pathname) return undefined;
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  // Exact hit wins, so a static route is never swallowed by a param route.
  const exact = APP_ROUTES.find((route) => route.path === normalized);
  if (exact) return exact;

  return APP_ROUTES.find(
    (route) => route.path.includes(":") && patternCache(route.path).test(normalized),
  );
}

/** Permission-matrix key for a route (params collapsed to the pattern). */
export function permissionKeyFor(route: AppRoute): string {
  return route.permissionKey ?? route.path;
}

/**
 * Permission key for a live pathname. Falls back to the raw pathname when the
 * path is not in the registry, preserving the previous behaviour for
 * server-defined permission keys that predate the registry.
 */
export function permissionKeyForPath(pathname: string): string {
  const route = matchRoute(pathname);
  return route ? permissionKeyFor(route) : pathname;
}

export function resolvePageMeta(
  pathname: string,
): { title: string; subtitle?: string } {
  const route = matchRoute(pathname);
  if (!route) return { title: "النظام الإداري المتكامل" };
  return {
    title: route.title,
    subtitle: route.subtitle,
  };
}

export interface NavItem {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  roles: readonly string[];
  searchCategory?: SearchCategory;
}

/** Sidebar items grouped and sorted, ready to render. */
export function getNavGroups(): { id: NavGroupId; title: string; items: NavItem[] }[] {
  return NAV_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    items: NAV_ROUTES.filter((route) => route.nav!.group === group.id)
      .slice()
      .sort((a, b) => a.nav!.order - b.nav!.order)
      .map((route) => ({
        key: route.path,
        label: route.nav!.label,
        to: route.path,
        icon: route.nav!.icon,
        roles: route.nav!.roles ?? route.roles ?? ROLES.EVERYONE,
        searchCategory: route.nav!.searchCategory,
      })),
  })).filter((group) => group.items.length > 0);
}

/** Every menu item across all groups, flattened. */
export function getAllNavItems(): NavItem[] {
  return getNavGroups().flatMap((group) => group.items);
}

/** Mobile bottom-bar items for a role, sorted. */
export function getMobileNavItems(): (NavItem & { order: number })[] {
  return NAV_ROUTES.filter((route) => route.nav?.mobile)
    .map((route) => ({
      key: route.path,
      label: route.nav!.label,
      to: route.path,
      icon: route.nav!.icon,
      roles: route.nav!.roles ?? route.roles ?? ROLES.EVERYONE,
      searchCategory: route.nav!.searchCategory,
      order: route.nav!.mobileOrder ?? route.nav!.order,
    }))
    .sort((a, b) => a.order - b.order);
}

/** Command-palette entries, optionally narrowed to one category. */
export function getSearchEntries(category?: SearchCategory): NavItem[] {
  return NAV_ROUTES.filter((route) => route.nav?.searchCategory)
    .filter((route) => !category || route.nav!.searchCategory === category)
    .map((route) => ({
      key: route.path,
      label: route.nav!.label,
      to: route.path,
      icon: route.nav!.icon,
      roles: route.nav!.roles ?? route.roles ?? ROLES.EVERYONE,
      searchCategory: route.nav!.searchCategory,
    }));
}

export function getSearchCategories(): SearchCategory[] {
  const seen = new Set<SearchCategory>();
  for (const route of NAV_ROUTES) {
    if (route.nav?.searchCategory) seen.add(route.nav.searchCategory);
  }
  return NAV_GROUPS.length
    ? (["تشغيل", "العملاء", "الإدارة", "المالية", "النظام"] as SearchCategory[]).filter(
        (category) => seen.has(category),
      )
    : [];
}

/**
 * Permissions-matrix rows, derived from the registry.
 *
 * The matrix used to be a hand-maintained list that silently fell behind the
 * router: seventeen menu pages had no row, so an owner could not grant or
 * revoke them per user. Deriving it here makes that class of drift impossible.
 */
export function getPermissionPages(): PermissionPage[] {
  return PAGE_ROUTES.filter((route) => route.nav || route.permissionCategory)
    .map((route) => ({
      id: permissionKeyFor(route),
      label: route.nav?.label ?? route.title,
      category:
        route.permissionCategory ??
        (route.nav ? PERMISSION_CATEGORY_BY_GROUP[route.nav.group] : ""),
      icon: route.nav?.icon ?? Archive,
    }))
    .sort((a, b) => a.category.localeCompare(b.category, "ar"));
}

export { PAGE_ROUTES, NAV_ROUTES };

/** Every path the app answers on, used by the registry integrity test. */
export function getAllPaths(): string[] {
  return APP_ROUTES.map((route) => route.path);
}

/** Groups re-exported so callers do not need the raw icon import. */
export const NAV_ICONS = {
  Activity,
  Archive,
  Banknote,
  Calendar,
  CalendarDays,
  Clock,
  FileBarChart2,
  Globe,
  History,
  LayoutDashboard,
  LayoutGrid,
  Package,
  Receipt,
  Scissors,
  Settings,
  ShieldCheck,
  Store,
  TrendingUp,
  Trophy,
  UserCheck,
  UserCircle,
  UserPlus,
  Users,
  Users2,
  Wallet,
  Zap,
};
