import { useAuth } from "@/context/AuthContext";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import DynamicBackground from "@/components/layout/DynamicBackground";
import CommandPalette from "@/components/layout/CommandPalette";
import { usePreferences } from "@/context/PreferencesContext";
import { AnimatePresence } from "framer-motion";

const PAGE_TITLES = {
  "/dashboard": "لوحة التحكم",
  "/owner": "المركز القيادي",
  "/manager": "إدارة العمليات",
  "/customers": "قاعدة العملاء",
  "/services": "قائمة الخدمات",
  "/barbers": "طاقم العمل",
  "/appointments": "جدول المواعيد",
  "/bookings": "نظام الحجز",
  "/sessions": "الجلسات النشطة",
  "/invoices": "السجل المالي",
  "/reports": "التحليلات الذكية",
  "/owner/financial": "الأداء المالي",
  "/pos": "نقطة البيع الذكية",
  "/inventory": "إدارة المخزون",
  "/expenses": "سجل المصروفات",
  "/profile": "الملف الشخصي",
  "/settings": "الإعدادات العامة",
  "/owner/settings": "تخصيص النظام",
  "/activity-log": "سجلات الرقابة",
};

const PAGE_SUBTITLES = {
  "/dashboard": "نظرة بانورامية على أداء الصالون.",
  "/owner": "تحكم كامل في كافة مفاصل المنظومة.",
  "/manager": "متابعة دقيقة للفريق ومؤشرات الأداء.",
  "/customers": "إدارة تجربة العملاء وبناء الولاء.",
  "/services": "تخصيص الخدمات والأسعار التنافسية.",
  "/barbers": "متابعة أداء ومواعيد طاقم العمل.",
  "/appointments": "تنظيم التدفق اليومي للعملاء.",
  "/bookings": "إدارة الطلبات والحجوزات المستقبلية.",
  "/sessions": "متابعة الخدمات قيد التنفيذ الآن.",
  "/invoices": "إدارة المعاملات المالية والفواتير.",
  "/reports": "تقارير متقدمة لاتخاذ قرارات مدروسة.",
  "/owner/financial": "تحليل التدفقات النقدية والربحية.",
  "/pos": "واجهة بيع سريعة ومتكاملة.",
  "/inventory": "مراقبة مستويات المنتجات والمستهلكات.",
  "/expenses": "متابعة الإنفاق والتحكم في التكاليف.",
  "/profile": "تخصيص بياناتك الشخصية.",
  "/settings": "إدارة تفضيلات الواجهة واللغة.",
  "/owner/settings": "إعدادات متقدمة للخدمات والسياسات.",
  "/activity-log": "تتبع كافة العمليات لضمان الشفافية.",
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
  const isBarberRoute = location.pathname.startsWith("/barber");
  // Barber pages always render in default (light) mode
  const isDark = isBarberRoute ? false : preferences?.theme !== "light";

  useEffect(() => {
    if (!isBarberRoute) return;

    const root = document.documentElement;
    const body = document.body;
    const prevRootTheme = root.getAttribute("data-theme");
    const prevBodyTheme = body.getAttribute("data-theme");

    root.classList.remove("dark");
    root.classList.add("light");
    body.classList.remove("dark");
    body.classList.add("light");
    root.setAttribute("data-theme", "light");
    body.setAttribute("data-theme", "light");

    return () => {
      if (prevRootTheme) root.setAttribute("data-theme", prevRootTheme);
      if (prevBodyTheme) body.setAttribute("data-theme", prevBodyTheme);
      const wasDark = prevRootTheme === "dark" || prevBodyTheme === "dark";
      root.classList.toggle("dark", wasDark);
      root.classList.toggle("light", !wasDark);
      body.classList.toggle("dark", wasDark);
      body.classList.toggle("light", !wasDark);
    };
  }, [isBarberRoute]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
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
    <div className="app-shell" data-theme={isDark ? "dark" : "light"} dir="rtl">
      <DynamicBackground />
      <CommandPalette />

      <div className="app-shell__layout">
        {/* Desktop Sidebar Slot */}
        <div className="app-shell__sidebar-slot hidden lg:block">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapsed={handleToggleCollapsed}
            onNavigate={handleCloseSidebar}
          />
        </div>

        {/* Unified Body Column */}
        <div className="app-shell__body">
          <Header
            title={pageTitle}
            subtitle={pageSubtitle}
            onOpenSidebar={() => setSidebarOpen(true)}
          />

          {/* Internally scrollable main area */}
          <main className="app-shell__main custom-scrollbar">
            <div className="app-shell__content p-4 lg:p-6 animate-fade-up">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <div className="app-shell__mobile-drawer lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="app-shell__drawer-backdrop"
                onClick={handleCloseSidebar}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="app-shell__drawer-panel"
              >
                <Sidebar
                  collapsed={false}
                  onToggleCollapsed={handleCloseSidebar}
                  onNavigate={handleCloseSidebar}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
