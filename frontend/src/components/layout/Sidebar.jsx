import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Scissors,
  Receipt,
  LogOut,
  Package,
  Calendar,
  Settings,
  ShieldCheck,
  TrendingUp,
  Wallet,
  History,
  Zap,
  UserPlus,
  UserCheck,
  FileBarChart2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { filterByRole } from "../../lib/roleRoutes";
import { cn } from "../../lib/utils";
import { baseURL } from "../../services/api";

const STATIC_URL = baseURL.replace("/api/v1", "");

const MENU_GROUPS = [
  {
    title: "التشغيل",
    items: [
      {
        key: "owner-dash",
        label: "لوحة القيادة",
        to: "/owner",
        icon: LayoutDashboard,
        roles: ["OWNER", "ADMIN"],
      },
      {
        key: "manager-dash",
        label: "لوحة المدير",
        to: "/manager",
        icon: LayoutDashboard,
        roles: ["MANAGER"],
      },
      {
        key: "cashier-dash",
        label: "لوحة الكاشير",
        to: "/cashier",
        icon: LayoutDashboard,
        roles: ["CASHIER"],
      },
      {
        key: "barber-dash",
        label: "لوحة الحلاق",
        to: "/barber",
        icon: Scissors,
        roles: ["BARBER"],
      },
      {
        key: "pos",
        label: "نقطة البيع",
        to: "/pos",
        icon: Zap,
        roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
      },
      {
        key: "reception-board",
        label: "لوحة الاستقبال",
        to: "/reception-board",
        icon: LayoutGrid,
        roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN", "BARBER"],
      },
      {
        key: "bookings",
        label: "الحجوزات",
        to: "/bookings",
        icon: Calendar,
        roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN", "BARBER"],
      },
      {
        key: "customers",
        label: "العملاء",
        to: "/customers",
        icon: Users,
        roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
      },
      {
        key: "invoices",
        label: "الفواتير",
        to: "/invoices",
        icon: Receipt,
        roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
      },
      {
        key: "adjustment-requests",
        label: "طلبات التعديل",
        to: "/owner/adjustment-requests",
        icon: ShieldCheck,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
    ],
  },
  {
    title: "الإدارة",
    items: [
      {
        key: "hr",
        label: "إدارة الموظفين",
        to: "/owner/hr",
        icon: UserPlus,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "attendance",
        label: "الحضور والانضباط",
        to: "/attendance",
        icon: UserCheck,
        roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"],
      },
      {
        key: "inventory",
        label: "المخزن",
        to: "/inventory",
        icon: Package,
        roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
      },
    ],
  },
  {
    title: "المالية والتقارير",
    items: [
      {
        key: "expenses",
        label: "المصروفات",
        to: "/expenses",
        icon: TrendingUp,
        roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
      },
      {
        key: "payroll",
        label: "الرواتب",
        to: "/owner/payroll",
        icon: Wallet,
        roles: ["OWNER", "ADMIN"],
      },
      {
        key: "cashbox",
        label: "خزينة المحل",
        to: "/owner/cashbox",
        icon: TrendingUp,
        roles: ["OWNER", "ADMIN", "CASHIER"],
      },
      {
        key: "reports",
        label: "التقارير التشغيلية",
        to: "/owner/reports",
        icon: FileBarChart2,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "employee-reports",
        label: "تقارير الموظفين",
        to: "/owner/employee-reports",
        icon: Users,
        roles: ["OWNER", "ADMIN"],
      },
      {
        key: "financial-reports",
        label: "التقارير المالية",
        to: "/owner/financial",
        icon: TrendingUp,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "financial-rules",
        label: "القواعد المالية",
        to: "/owner/financial-rules",
        icon: ShieldCheck,
        roles: ["OWNER", "ADMIN"],
      },
    ],
  },
  {
    title: "النظام",
    items: [
      {
        key: "settings",
        label: "إعدادات المحل",
        to: "/owner/settings",
        icon: Settings,
        roles: ["OWNER", "ADMIN"],
      },
      {
        key: "personal-settings",
        label: "الإعدادات الشخصية",
        to: "/settings",
        icon: UserCheck,
        roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "BARBER"],
      },
      {
        key: "security-access",
        label: "الأمان والوصول",
        to: "/owner/security-access",
        icon: ShieldCheck,
        roles: ["OWNER", "ADMIN"],
      },
      {
        key: "alerts",
        label: "التنبيهات الذكية",
        to: "/owner/alerts",
        icon: Zap,
        roles: ["OWNER", "ADMIN"],
      },
      {
        key: "activity",
        label: "سجلات الرقابة",
        to: "/activity-logs",
        icon: History,
        roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"],
      },
    ],
  },
];

const isRouteActive = (location, path) => {
  if (path === "/") return location.pathname === "/";
  if (["/owner", "/manager", "/cashier", "/barber"].includes(path)) {
    return location.pathname === path;
  }
  return location.pathname === path || location.pathname.startsWith(`${path}/`);
};

function SidebarLink({ item, active, collapsed, onNavigate }) {
  const Icon = item.icon;
  const content = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "sidebar-item group relative flex min-h-[3.35rem] items-center gap-3 rounded-[1.35rem] px-3 py-2.5 text-sm font-black transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] tap-active",
        collapsed ? "justify-center" : "justify-start",
        active && "active",
      )}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active-pill"
          className="absolute inset-0 z-0 rounded-[1.35rem] bg-indigo-600/10 dark:bg-sky-400/10"
          transition={{ type: "spring", stiffness: 240, damping: 24 }}
        />
      )}
      <span className="sidebar-item__icon-wrap">
        <Icon
          className="sidebar-item__icon relative z-10 h-5 w-5 shrink-0"
          strokeWidth={1.85}
        />
      </span>
      {!collapsed ? (
        <motion.span
          initial={{ opacity: 0, x: -16, filter: "blur(8px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="sidebar-item__label relative z-10 truncate"
        >
          {item.label}
        </motion.span>
      ) : null}
    </NavLink>
  );

  if (!collapsed) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="left" align="center">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

export default function Sidebar({
  collapsed = false,
  onToggleCollapsed = () => {},
  onNavigate = () => {},
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();

  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => {
    // Default: expand sections that contain the active route
    const initialState = {};
    MENU_GROUPS.forEach((group) => {
      if (group.items.some((item) => isRouteActive(location, item.to))) {
        initialState[group.title] = true;
      }
    });
    return initialState;
  });

  const hoverPreviewActive = collapsed && hoverExpanded;
  const visuallyCollapsed = collapsed && !hoverExpanded;

  const visibleGroups = useMemo(
    () =>
      MENU_GROUPS.map((group) => ({
        ...group,
        items: filterByRole(group.items, user),
      })).filter((group) => group.items.length > 0),
    [user],
  );

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = { ...prev };
      visibleGroups.forEach((group) => {
        if (group.items.some((item) => isRouteActive(location, item.to))) {
          next[group.title] = true;
        }
      });
      return next;
    });
  }, [location.pathname, visibleGroups]);

  const toggleGroup = (title) => {
    if (visuallyCollapsed) return; // Don't toggle if collapsed
    setExpandedGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const getAvatarUrl = () => {
    if (!user?.profile_image_url) return null;
    if (user.profile_image_url.startsWith("http"))
      return user.profile_image_url;
    return `${STATIC_URL}${user.profile_image_url}`;
  };

  const getInitials = () => {
    const name = user?.full_name || user?.username || "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const handleProfileNavigation = () => {
    navigate("/settings");
    onNavigate();
  };

  return (
    <aside
      className={cn(
        "sidebar-modern relative flex h-full min-h-full w-full flex-col overflow-hidden text-gray-700 shadow-2xl dark:text-gray-200",
        visuallyCollapsed ? "lg:w-[6.35rem]" : "lg:w-[21rem]",
        "transition-[width,transform,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
      )}
      onMouseEnter={() => collapsed && setHoverExpanded(true)}
      onMouseLeave={() => setHoverExpanded(false)}
      dir="rtl"
    >
      <div aria-hidden="true" className="sidebar-modern__edge" />
      <div aria-hidden="true" className="sidebar-modern__glow" />
      <div aria-hidden="true" className="sidebar-modern__surface" />

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="sidebar-logo flex items-center gap-4 border-b border-slate-200/40 dark:border-slate-800/40 px-5 py-6">
          <motion.div
            whileHover={{ rotate: 180, scale: 1.08 }}
            transition={{ type: "spring", stiffness: 220, damping: 15 }}
            className="relative flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-[1.6rem] bg-indigo-600 dark:bg-sky-400 text-white dark:text-slate-900 shadow-xl shadow-indigo-500/30 dark:shadow-sky-400/20"
          >
            <Scissors size={24} strokeWidth={2.5} className="relative z-10" />
          </motion.div>

          {!visuallyCollapsed ? (
            <motion.div
              initial={{ opacity: 0, x: 18, filter: "blur(10px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0 flex-1"
            >
              <div className="truncate text-lg font-black leading-none tracking-tight text-slate-900 dark:text-white">
                صالون برو
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.8)]" />
                <div className="truncate text-[10px] font-black uppercase tracking-widest text-slate-400">
                  الإصدار المميز
                </div>
              </div>
            </motion.div>
          ) : null}

          {!visuallyCollapsed && (
            <button
              onClick={onToggleCollapsed}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-muted transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:text-accent hover:shadow-[0_0_24px_rgba(124,58,237,0.25)] dark:bg-white/[0.05]"
              aria-label="تصغير القائمة الجانبية"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        {visuallyCollapsed ? (
          <div className="px-4 pt-3">
            <motion.div
              initial={{ opacity: 0.35, scaleX: 0.8 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
              className="mx-auto h-10 w-1 rounded-full bg-gradient-to-b from-accent via-cyan-300 to-emerald-300 shadow-[0_0_20px_rgba(124,58,237,0.45)]"
            />
          </div>
        ) : null}

        <nav className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-6">
          {visibleGroups.map((group) => {
            const isExpanded =
              visuallyCollapsed ||
              hoverPreviewActive ||
              expandedGroups[group.title];
            return (
              <div key={group.title} className="space-y-1">
                {!visuallyCollapsed ? (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="group flex w-full items-center justify-between rounded-2xl px-4 py-3 text-right transition-all duration-300 hover:bg-white/10 dark:hover:bg-white/[0.05]"
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.32em] text-muted/70 group-hover:text-accent">
                      {group.title}
                    </span>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="text-muted/40 group-hover:text-accent"
                    >
                      <ChevronDown size={14} />
                    </motion.div>
                  </button>
                ) : (
                  <div className="mx-auto my-4 h-px w-9 bg-gradient-to-r from-transparent via-accent/45 to-transparent" />
                )}

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, y: -8 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0, y: -8 }}
                      transition={{
                        height: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                        opacity: { duration: 0.24 },
                        y: { duration: 0.26 },
                      }}
                      className="overflow-hidden space-y-1.5"
                    >
                      {group.items.map((item) => (
                        <SidebarLink
                          key={item.key}
                          item={item}
                          active={isRouteActive(location, item.to)}
                          collapsed={visuallyCollapsed}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/[0.15] p-4 dark:border-white/[0.08] space-y-3">
          {!visuallyCollapsed && (
            <button
              type="button"
              onClick={handleProfileNavigation}
              className="group mb-2 flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-2 py-2 text-right transition-all hover:bg-white/10"
            >
              <div className="h-10 w-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 font-black overflow-hidden border border-indigo-500/20">
                {getAvatarUrl() ? (
                  <img
                    src={getAvatarUrl()}
                    alt="User"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs">{getInitials()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-white truncate">
                  {user?.full_name || user?.username}
                </p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  {user?.role === "OWNER" || user?.role === "ADMIN"
                    ? "مدير عام"
                    : user?.role === "MANAGER"
                      ? "مدير فرع"
                      : user?.role === "BARBER"
                        ? "خبير"
                        : "موظف"}
                </p>
              </div>
            </button>
          )}

          {visuallyCollapsed && (
            <button
              onClick={onToggleCollapsed}
              className="mb-2 flex h-12 w-full items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/10 text-muted transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:text-accent hover:shadow-[0_0_24px_rgba(124,58,237,0.24)] dark:bg-white/[0.05]"
              aria-label="توسيع القائمة الجانبية"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => logout()}
            className={cn(
              "flex min-h-12 w-full items-center gap-4 rounded-[1.35rem] border border-red-500/10 bg-red-500/[0.06] px-4 py-2.5 text-sm font-black text-red-500 transition-all duration-300 hover:-translate-y-0.5 hover:border-red-500/30 hover:bg-red-500/10 hover:shadow-[0_0_24px_rgba(239,68,68,0.16)]",
              visuallyCollapsed ? "justify-center" : "justify-start",
            )}
          >
            <LogOut size={22} strokeWidth={2} className="shrink-0" />
            {!visuallyCollapsed ? <span>تسجيل الخروج</span> : null}
          </button>
        </div>
      </div>
    </aside>
  );
}
