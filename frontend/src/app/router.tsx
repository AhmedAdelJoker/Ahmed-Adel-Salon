import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { motion } from "framer-motion";
import { getHomePath, getProfilePath, hasRoleAccess } from "@/lib/access/roles";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import CommandPalette from "@/components/layout/CommandPalette";
import DynamicBackground from "@/components/layout/DynamicBackground";
import { cn } from "@/lib/core/utils";
import { AnimatePresence } from "framer-motion";
import { Scissors } from "lucide-react";

const PAGE_TITLES = Object.freeze({
  "/owner": "التقارير الإحصائية",
  "/owner/cashbox": "خزينة المحل",
  "/owner/employee-reports": "تقارير الموظفين",
  "/owner/hr": "إدارة الموارد البشرية",
  "/owner/hr/archive": "أرشيف الموظفين",
  "/owner/permissions": "صلاحيات الوصول",
  "/owner/financial": "التقارير المالية",
  "/owner/reports": "التقارير التشغيلية",
  "/owner/daily-summary": "الملخص التشغيلي اليومي",
  "/owner/financial-rules": "القواعد المالية",
  "/owner/alerts": "التنبيهات الذكية",
  "/owner/payroll": "إدارة الرواتب",
  "/owner/payroll/archive": "أرشيف الرواتب",
  "/owner/settings": "الإعدادات",
  "/owner/security-access": "الأمان والوصول",
  "/owner/connected-pages": "الصفحات المتصلة",
  "/owner/users": "إدارة المستخدمين",
  "/owner/services": "إدارة الخدمات",
  "/owner/adjustment-requests": "طلبات التعديل",
  "/owner/business-settings": "إعدادات النشاط",
  "/owner/working-hours": "ساعات العمل",
  "/owner/loyalty-settings": "نظام الولاء",
  "/owner/website-settings": "إعدادات الموقع",
  "/owner/customers/archive": "أرشيف العملاء",
  "/reception-board": "لوحة الاستقبال",
  "/manager": "لوحة المدير",
  "/settings": "الإعدادات الشخصية",
  "/attendance": "الحضور والانضباط",

  "/approvals": "مركز الموافقات",
  "/activity-logs": "سجلات النشاط",
  "/accountant": "المركز المالي",
  "/cashier": "لوحة الكاشير",
  "/pos": "نقطة البيع",
  "/bookings": "الحجوزات",
  "/customers": "العملاء",
  "/invoices": "الفواتير",
  "/invoices/archive": "أرشيف الفواتير",
  "/inventory": "المخزون",
  "/inventory/archive": "أرشيف المخزن",
  "/inventory/bundles": "باقات المنتجات",
  "/expenses": "المصروفات",
  "/expenses/archive": "أرشيف المصروفات",
  "/owner/expenses/archive": "أرشيف المصروفات",
  "/barber": "لوحة الحلاق",
  "/barber/workstation": "محطة العمل",
  "/barber/clients": "عملائي",
  "/barber/earnings": "أرباحي",
  "/barber/availability": "جدولي",
  "/barber/profile": "ملفي الشخصي",
  "/barber/bookings": "حجوزاتي",
  "/profile": "الملف الشخصي",
  "/login": "دخول النظام الآمن",
});

const PAGE_SUBTITLES = Object.freeze({
  "/owner": "نظرة تشغيلية شاملة على الأداء اليومي.",
  "/manager": "متابعة التشغيل والفريق والنتائج.",
  "/accountant": "المركز المالي ومتابعة الحسابات.",
  "/customers": "إدارة بيانات العملاء وسجل الزيارات.",
  "/owner/services": "إدارة الخدمات والأسعار والتصنيفات.",
  "/bookings": "إدارة الحجوزات والمواعيد.",
  "/invoices": "الفواتير وتفاصيلها وإعادة الطباعة.",
  "/invoices/archive": "أرشيف الفواتير الشهري والإغلاقات.",
  "/inventory/archive": "سجل حركة المخزن والمنتجات المؤرشفة.",
  "/owner/customers/archive": "العملاء المؤرشفون واستعادتهم.",
  "/owner/reports": "تحليل الأداء التشغيلي المتقدم.",
  "/owner/business-settings": "بيانات الصالون والفاتورة والحجز العام.",
  "/owner/daily-summary": "الملخص التشغيلي الشامل لكافة الورديات والمصروفات.",
  "/owner/financial": "تحليل الإيرادات والمصروفات ومؤشرات الأداء.",
  "/pos": "إصدار الفواتير وإدارة المبيعات المباشرة.",
  "/inventory": "متابعة المنتجات والمخزون.",
  "/expenses": "تسجيل ومراجعة المصروفات.",
});

// Common Pages
const Login = lazy(() => import("@/pages/common/Login"));
const ActivityLogs = lazy(() => import("@/pages/common/ActivityLogs"));

// Owner Pages
const OwnerDashboard = lazy(() => import("@/pages/owner/ReportsDashboard"));
const HRManagement = lazy(() => import("@/pages/owner/HRManagement"));
const EmployeeArchive = lazy(() => import("@/pages/owner/EmployeeArchive"));
const PermissionsManagement = lazy(
  () => import("@/pages/owner/PermissionsManagement"),
);
const FinancialReports = lazy(() => import("@/pages/owner/FinancialReports"));
const EmployeeReports = lazy(() => import("@/pages/owner/EmployeeReports"));
const FinancialRules = lazy(() => import("@/pages/owner/FinancialRules"));
const DailySummaryReport = lazy(() => import("@/pages/owner/DailySummaryReport"));
const SmartAlerts = lazy(() => import("@/pages/owner/SmartAlerts"));
const Expenses = lazy(() => import("@/pages/owner/Expenses"));
const ExpensesArchive = lazy(() => import("@/pages/owner/ExpensesArchive"));
const Payroll = lazy(() => import("@/pages/owner/Payroll"));
const PayrollArchive = lazy(() => import("@/pages/owner/PayrollArchive"));
const OwnerSettings = lazy(() => import("@/pages/owner/Settings"));
const SecurityAccess = lazy(() => import("@/pages/owner/SecurityAccess"));
const ConnectedPages = lazy(() => import("@/pages/owner/ConnectedPages"));
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
const WebsiteSettingsPanel = lazy(
  () => import("@/pages/owner/WebsiteSettingsPanel"),
);
const CustomerArchive = lazy(() => import("@/pages/owner/CustomerArchive"));
// Manager Pages
const ManagerDashboard = lazy(
  () => import("@/pages/manager/ManagerDashboard"),
);
const AttendanceManagement = lazy(
  () => import("@/pages/manager/AttendanceManagement"),
);
const ApprovalCenter = lazy(() => import("@/pages/manager/ApprovalCenter"));

// Cashier Pages
const POS = lazy(() => import("@/pages/cashier/POS/index"));
const Bookings = lazy(() => import("@/pages/cashier/Bookings"));
const Inventory = lazy(() => import("@/pages/cashier/Inventory"));
const CashierDashboard = lazy(
  () => import("@/pages/cashier/CashierDashboard"),
);
const Customers = lazy(() => import("@/pages/cashier/Customers"));
const CustomerDetail = lazy(() => import("@/pages/cashier/CustomerDetail"));
const Invoices = lazy(() => import("@/pages/cashier/Invoices"));
const InvoiceArchive = lazy(
  () => import("@/pages/cashier/InvoiceArchive"),
);
const SuppliesArchive = lazy(
  () => import("@/pages/cashier/SuppliesArchive"),
);
const ProductBundles = lazy(
  () => import("@/pages/cashier/ProductBundles"),
);
const Schedule = lazy(() => import("@/pages/cashier/Schedule"));

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

const AccountantDashboard = lazy(
  () => import("@/pages/accountant/AccountantDashboard"),
);

// Operations
const ReceptionBoard = lazy(() => import("@/pages/cashier/ReceptionBoard"));
const Settings = lazy(() => import("@/pages/common/Settings"));

const ROLES = Object.freeze({
  OWNER: ["OWNER", "ADMIN"],
  MANAGEMENT: ["OWNER", "ADMIN", "MANAGER"],
  FINANCE: ["OWNER", "ADMIN", "ACCOUNTANT"],
  FINANCE_MGMT: ["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT"],
  FRONT_DESK: ["OWNER", "ADMIN", "MANAGER", "CASHIER"],
  FRONT_DESK_ACC: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "ACCOUNTANT"],
  OPERATIONS: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "BARBER"],
  BARBER_ONLY: ["BARBER"],
});

function RouteLoader() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center animate-fade-in"
      dir="rtl"
    >
      <div className="flex flex-col items-center gap-4 text-accent">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-soft">
          <Scissors className="h-8 w-8 animate-pulse" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-black text-main">Barber Luxe Pro</p>
          <p className="text-xs font-bold tracking-widest text-muted uppercase">
            جاري تأمين الجلسة...
          </p>
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ allowedRoles = [] }: { allowedRoles?: string[] }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <RouteLoader />;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.is_active === false) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ error: "account_disabled", from: location }}
      />
    );
  }

  if (
    allowedRoles?.length &&
    !hasRoleAccess(user, allowedRoles, location.pathname)
  ) {
    return <Navigate to={getHomePath(user.role)} replace />;
  }

  return <Outlet />;
}

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <RouteLoader />;
  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={getHomePath(user.role)} replace />;
}

function ProfileRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <RouteLoader />;
  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={getProfilePath(user.role)} replace />;
}

function TitleUpdater() {
  const location = useLocation();

  useEffect(() => {
    const baseTitle = "Barber Luxe Pro";
    const subTitle =
      PAGE_TITLES[location.pathname] || "النظام الإداري المتكامل";
    document.title = `${subTitle} | ${baseTitle}`;
  }, [location.pathname]);

  return null;
}

function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const toggleSidebar = useCallback(() => {
    setMobileSidebarOpen((current) => !current);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      className="app-shell relative flex h-dvh w-full overflow-hidden bg-slate-100 dark:bg-slate-950"
      dir="rtl"
    >
      <DynamicBackground />

      <aside
        className={cn(
          "app-shell__sidebar-slot relative z-40 hidden lg:flex h-full shrink-0 transition-all duration-500 ease-in-out",
          sidebarCollapsed ? "w-24" : "w-84",
        )}
        onMouseEnter={() => setSidebarCollapsed(false)}
        onMouseLeave={() => setSidebarCollapsed(true)}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => {}}
          onNavigate={() => setMobileSidebarOpen(false)}
        />
      </aside>

      <div className="app-shell__body relative z-20 flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="z-30 shrink-0 border-b border-border/40 bg-white/90 backdrop-blur-xl dark:bg-slate-900/90">
          <Header
            title={PAGE_TITLES[location.pathname] || "صالون برو"}
            subtitle={
              PAGE_SUBTITLES[location.pathname] || "إدارة ذكية ومتكاملة."
            }
            onOpenSidebar={toggleSidebar}
          />
        </header>

        <main
          className="app-shell__main mobile-bottom-safe flex-1 min-h-0 relative h-full w-full overflow-y-auto scroll-smooth bg-slate-50/50 dark:bg-transparent"
          id="main-content"
        >
          <div className="app-shell__content min-h-full w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <Suspense fallback={<RouteLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <MobileNav />
      <CommandPalette />

      <AnimatePresence>
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-100 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 right-0 z-101 w-[min(88vw,22rem)] p-3 shadow-2xl"
            >
              <Sidebar
                collapsed={false}
                onToggleCollapsed={() => setMobileSidebarOpen(false)}
                onNavigate={() => setMobileSidebarOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <TitleUpdater />
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route element={<RequireAuth />}>
            <Route element={<MainLayout />}>
              <Route path="/profile" element={<ProfileRedirect />} />
              <Route path="/settings" element={<Settings />} />

              <Route element={<RequireAuth allowedRoles={ROLES.OWNER} />}>
                <Route path="/owner" element={<OwnerDashboard />} />
                <Route
                  path="/dashboard"
                  element={<Navigate to="/owner" replace />}
                />
                <Route
                  path="/owner/permissions"
                  element={<PermissionsManagement />}
                />
                <Route
                  path="/owner/financial-rules"
                  element={<FinancialRules />}
                />
                <Route
                  path="/owner/loyalty-settings"
                  element={<LoyaltySettingsPanel />}
                />
                <Route path="/owner/alerts" element={<SmartAlerts />} />
                <Route
                  path="/owner/connected-pages"
                  element={<ConnectedPages />}
                />
                <Route
                  path="/owner/preferences"
                  element={
                    <Navigate to="/owner/settings?tab=preferences" replace />
                  }
                />
                <Route
                  path="/owner/users"
                  element={<Navigate to="/owner/settings?tab=users" replace />}
                />
                <Route
                  path="/owner/services"
                  element={<ServicesManagement />}
                />
                <Route
                  path="/owner/business-settings"
                  element={<BusinessSettingsPage />}
                />
                <Route
                  path="/owner/website-settings"
                  element={
                    <WebsiteSettingsPanel
                      onSaved={() => {}}
                      onChangeDraft={() => {}}
                    />
                  }
                />
              </Route>

              {/* Settings: OWNER full, MANAGER limited to hours tab (filtered inside component) */}
              <Route
                element={
                  <RequireAuth
                    allowedRoles={[...ROLES.OWNER, "MANAGER"]}
                  />
                }
              >
                <Route path="/owner/settings" element={<OwnerSettings />} />
              </Route>

              {/* HR: Sidebar promises MANAGER — Route matches Sidebar */}
              <Route
                element={
                  <RequireAuth
                    allowedRoles={[...ROLES.OWNER, "MANAGER"]}
                  />
                }
              >
                <Route path="/owner/hr" element={<HRManagement />} />
                <Route path="/owner/hr/archive" element={<EmployeeArchive />} />
                <Route
                  path="/owner/working-hours"
                  element={<Navigate to="/owner/settings?tab=hours" replace />}
                />
              </Route>

              {/* Finance shared with ACCOUNTANT + MANAGER per Sidebar */}
              <Route
                element={<RequireAuth allowedRoles={ROLES.FINANCE_MGMT} />}
              >
                <Route path="/owner/payroll" element={<Payroll />} />
                <Route
                  path="/owner/payroll/archive"
                  element={<PayrollArchive />}
                />
                <Route
                  path="/owner/adjustment-requests"
                  element={<InvoiceAdjustmentRequests />}
                />
              </Route>
              <Route element={<RequireAuth allowedRoles={ROLES.FINANCE} />}>
                <Route path="/owner/financial" element={<FinancialReports />} />
                <Route
                  path="/owner/employee-reports"
                  element={<EmployeeReports />}
                />
                <Route
                  path="/owner/daily-summary"
                  element={<DailySummaryReport />}
                />
              </Route>
              <Route
                element={<RequireAuth allowedRoles={ROLES.FINANCE_MGMT} />}
              >
                <Route path="/owner/reports" element={<OperationalReports />} />
              </Route>

              {/* Cashbox: single definition (fixes duplicate) */}
              <Route
                element={
                  <RequireAuth
                    allowedRoles={[...ROLES.OWNER, "CASHIER", "ACCOUNTANT"]}
                  />
                }
              >
                <Route path="/owner/cashbox" element={<Cashbox />} />
              </Route>

              {/* Accountant home */}
              <Route
                element={
                  <RequireAuth
                    allowedRoles={["OWNER", "ADMIN", "ACCOUNTANT"]}
                  />
                }
              >
                <Route path="/accountant" element={<AccountantDashboard />} />
                <Route
                  path="/accountant-dashboard"
                  element={<Navigate to="/accountant" replace />}
                />
              </Route>

              <Route
                element={
                  <RequireAuth
                    allowedRoles={[...ROLES.MANAGEMENT, "CASHIER", "ACCOUNTANT"]}
                  />
                }
              >
                <Route path="/manager" element={<ManagerDashboard />} />
                <Route
                  path="/manager-dashboard"
                  element={<Navigate to="/manager" replace />}
                />
                <Route path="/attendance" element={<AttendanceManagement />} />
                <Route path="/approvals" element={<ApprovalCenter />} />
                <Route
                  path="/owner/security-access"
                  element={<SecurityAccess />}
                />
                <Route path="/expenses/archive" element={<ExpensesArchive />} />
                <Route
                  path="/owner/expenses/archive"
                  element={<ExpensesArchive />}
                />
              </Route>

              {/* Activity Logs accessible to Management + Cashier + Accountant */}
              <Route
                element={
                  <RequireAuth
                    allowedRoles={[...ROLES.MANAGEMENT, "CASHIER", "ACCOUNTANT"]}
                  />
                }
              >
                <Route path="/activity-logs" element={<ActivityLogs />} />
              </Route>

              <Route element={<RequireAuth allowedRoles={ROLES.FRONT_DESK} />}>
                <Route path="/cashier" element={<CashierDashboard />} />
                <Route
                  path="/cashier-dashboard"
                  element={<Navigate to="/cashier" replace />}
                />
                <Route path="/pos" element={<POS />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/invoices" element={<Invoices />} />
              </Route>
              <Route
                element={<RequireAuth allowedRoles={ROLES.FRONT_DESK_ACC} />}
              >
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/expenses" element={<Expenses />} />
              </Route>

              {/* Archive + detail routes (fixes broken navigates) */}
              <Route
                element={<RequireAuth allowedRoles={ROLES.FRONT_DESK_ACC} />}
              >
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route
                  path="/owner/customers/archive"
                  element={<CustomerArchive />}
                />
                <Route
                  path="/invoices/archive"
                  element={<InvoiceArchive />}
                />
                <Route
                  path="/invoice-archive"
                  element={<Navigate to="/invoices/archive" replace />}
                />
                <Route
                  path="/inventory/archive"
                  element={<SuppliesArchive />}
                />
                <Route
                  path="/inventory/bundles"
                  element={<ProductBundles />}
                />
              </Route>

              <Route element={<RequireAuth allowedRoles={ROLES.OPERATIONS} />}>
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/reception-board" element={<ReceptionBoard />} />
                <Route
                  path="/appointments"
                  element={<Navigate to="/bookings" replace />}
                />
              </Route>

              <Route element={<RequireAuth allowedRoles={ROLES.OPERATIONS} />}>
                <Route path="/schedule" element={<Schedule />} />
              </Route>

              <Route element={<RequireAuth allowedRoles={ROLES.BARBER_ONLY} />}>
                <Route path="/barber" element={<BarberDashboard />} />
                <Route
                  path="/barber-dashboard"
                  element={<Navigate to="/barber" replace />}
                />
                <Route
                  path="/barber/workstation"
                  element={<BarberWorkStation />}
                />
                <Route path="/barber/clients" element={<BarberClients />} />
                <Route path="/barber/earnings" element={<BarberEarnings />} />
                <Route
                  path="/barber/availability"
                  element={<BarberAvailability />}
                />
                <Route path="/barber/profile" element={<BarberProfile />} />
                <Route path="/barber/bookings" element={<BarberBookings />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
