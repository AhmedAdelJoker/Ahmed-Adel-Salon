import { useAuth } from "../../context/AuthContext";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import DynamicBackground from "./DynamicBackground";
import { usePreferences } from "../../context/PreferencesContext";

const PAGE_TITLES = {
  "/dashboard": "لوحة التحكم",
  "/owner": "لوحة التحكم",
  "/manager": "لوحة التحكم",
  "/customers": "العملاء",
  "/services": "الخدمات",
  "/barbers": "الحلاقون",
  "/appointments": "الحجوزات",
  "/bookings": "الحجوزات",
  "/sessions": "الجلسات",
  "/invoices": "الفواتير",
  "/reports": "التقارير",
  "/owner/financial": "التقارير المالية",
  "/pos": "نقطة البيع",
  "/inventory": "المخزون",
  "/expenses": "المصروفات",
  "/profile": "الملف الشخصي",
  "/settings": "الإعدادات",
  "/owner/settings": "الإعدادات",
  "/activity-log": "سجل النشاط",
};

const PAGE_SUBTITLES = {
  "/dashboard": "نظرة سريعة على أرقام الصالون.",
  "/owner": "نظرة تشغيلية شاملة على الأداء اليومي.",
  "/manager": "متابعة التشغيل والفريق والنتائج.",
  "/customers": "إدارة بيانات العملاء وسجل الزيارات.",
  "/services": "إدارة الخدمات والأسعار والتصنيفات.",
  "/barbers": "إدارة الحلاقين والخبراء.",
  "/appointments": "إدارة الحجوزات والمواعيد.",
  "/bookings": "إدارة الحجوزات والمواعيد.",
  "/sessions": "الجلسات الحالية.",
  "/invoices": "الفواتير وتفاصيلها وإعادة الطباعة.",
  "/reports": "التقارير والتحليلات.",
  "/owner/financial": "تحليل الإيرادات والمصروفات ومؤشرات الأداء.",
  "/pos": "إصدار الفواتير وإدارة المبيعات المباشرة.",
  "/inventory": "متابعة المنتجات والمخزون.",
  "/expenses": "تسجيل ومراجعة المصروفات.",
  "/profile": "بيانات الحساب.",
  "/settings": "الإعدادات والتفضيلات.",
  "/owner/settings": "إعدادات النظام والخدمات والتفضيلات.",
  "/activity-log": "سجل النشاط داخل النظام.",
};

const resolveRouteMeta = (pathname, dictionary, fallback) => {
  if (dictionary[pathname]) return dictionary[pathname];
  const matchedKey = Object.keys(dictionary)
    .filter((key) => pathname === key || pathname.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];
  return matchedKey ? dictionary[matchedKey] : fallback;
};

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const { loading } = useAuth();
  const { preferences } = usePreferences();
  const isDark = preferences?.theme !== "light";

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);
  const handleToggleCollapsed = useCallback(
    () => setSidebarCollapsed((v) => !v),
    [],
  );

  const pageTitle = useMemo(
    () => resolveRouteMeta(location.pathname, PAGE_TITLES, "Barber Luxe"),
    [location.pathname],
  );

  const pageSubtitle = useMemo(
    () => resolveRouteMeta(location.pathname, PAGE_SUBTITLES, ""),
    [location.pathname],
  );

  return (
    <div className="app-shell fixed inset-0 h-[100vh] w-[100vw] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-700" data-theme={isDark ? "dark" : "light"} dir="rtl">
      <DynamicBackground />

      <div className="app-shell__layout relative z-10 flex h-[100vh] w-[100vw] max-w-[1920px] mx-auto overflow-hidden p-[1.5rem] md:p-[2rem] lg:p-[2.5rem] gap-[1.5rem]">
        {/* ─── Desktop sidebar ─── */}
        <div className="app-shell__sidebar-slot hidden lg:flex h-full shrink-0">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapsed={handleToggleCollapsed}
            onNavigate={handleCloseSidebar}
          />
        </div>

        {/* ─── Main content area ─── */}
        <div className="app-shell__body flex-1 flex flex-col min-w-0 h-full gap-[1.5rem]">
          <div className="shrink-0 h-[5rem] md:h-[6rem]">
            <Header
              title={pageTitle}
              subtitle={pageSubtitle}
              onOpenSidebar={() => setSidebarOpen(true)}
            />
          </div>

          <main className="app-shell__main flex-1 min-h-0 relative bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 overflow-hidden" id="main-content">
            <div className="h-full w-full overflow-y-auto custom-scrollbar scroll-smooth p-[1.5rem] md:p-[2.5rem] lg:p-[3rem] animate-fade-up">
              {children}
            </div>
          </main>
        </div>

        {/* ─── Mobile drawer ─── */}
        {sidebarOpen && (
          <div
            className="app-shell__mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="القائمة الجانبية"
          >
            {/* Backdrop */}
            <button
              type="button"
              className="app-shell__drawer-backdrop"
              aria-label="إغلاق القائمة"
              disabled={loading}
              onClick={handleCloseSidebar}
            />
            {/* Drawer panel */}
            <div className="app-shell__drawer-panel">
              <Sidebar
                collapsed={false}
                onToggleCollapsed={handleCloseSidebar}
                onNavigate={handleCloseSidebar}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

