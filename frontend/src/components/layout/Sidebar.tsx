import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  Activity,
  Clock,
  Users2,
  Banknote,
  CalendarDays,
  UserCircle,
  Globe,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { filterByRole, normalizeRole } from "@/lib/access/roles";

const roleLabel = (role) =>
  ({
    OWNER: "المالك",
    ADMIN: "مدير النظام",
    MANAGER: "المدير",
    CASHIER: "الكاشير",
    BARBER: "الخبير",
    ACCOUNTANT: "المحاسب",
  })[normalizeRole(role)] || "المستخدم";
import { cn } from "@/lib/core/utils";
import { staticURL } from "@/services/api";
import { AnimatePresence } from "framer-motion";

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
        key: "accountant-dash",
        label: "المركز المالي",
        to: "/accountant",
        icon: LayoutDashboard,
        roles: ["ACCOUNTANT"],
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
        roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
      },
      {
        key: "bookings",
        label: "الحجوزات",
        to: "/bookings",
        icon: Calendar,
        roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
      },
      {
        key: "schedule",
        label: "مخطط المواعيد",
        to: "/schedule",
        icon: LayoutGrid,
        roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
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
        label: "مركز القيادة والتحكم",
        to: "/owner/adjustment-requests",
        icon: ShieldCheck,
        roles: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"],
      },
    ],
  },
  {
    title: "قسم الحلاق",
    items: [
      {
        key: "barber-dashboard",
        label: "لوحة الحلاق",
        to: "/barber",
        icon: Scissors,
        roles: ["BARBER"],
      },
      {
        key: "barber-station",
        label: "محطة العمل",
        to: "/barber/workstation",
        icon: Clock,
        roles: ["BARBER"],
      },
      {
        key: "barber-clients",
        label: "عملائي",
        to: "/barber/clients",
        icon: Users2,
        roles: ["BARBER"],
      },
      {
        key: "barber-earnings",
        label: "أرباحي",
        to: "/barber/earnings",
        icon: Banknote,
        roles: ["BARBER"],
      },
      {
        key: "barber-availability",
        label: "جدولي",
        to: "/barber/availability",
        icon: CalendarDays,
        roles: ["BARBER"],
      },
      {
        key: "barber-profile",
        label: "ملفي الشخصي",
        to: "/barber/profile",
        icon: UserCircle,
        roles: ["BARBER"],
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
        roles: ["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT", "CASHIER"],
      },
      {
        key: "inventory",
        label: "المخزن",
        to: "/inventory",
        icon: Package,
        roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN", "ACCOUNTANT"],
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
        roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN", "ACCOUNTANT"],
      },
      {
        key: "cashbox",
        label: "خزينة المحل",
        to: "/owner/cashbox",
        icon: Wallet,
        roles: ["OWNER", "ADMIN", "CASHIER", "ACCOUNTANT"],
      },
      {
        key: "payroll",
        label: "الرواتب",
        to: "/owner/payroll",
        icon: Wallet,
        roles: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"],
      },
      {
        key: "reports",
        label: "التقارير التشغيلية",
        to: "/owner/reports",
        icon: FileBarChart2,
        roles: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"],
      },
      {
        key: "employee-reports",
        label: "تقارير الموظفين",
        to: "/owner/employee-reports",
        icon: Users,
        roles: ["OWNER", "ADMIN", "ACCOUNTANT"],
      },
      {
        key: "financial-reports",
        label: "التقارير المالية",
        to: "/owner/financial",
        icon: TrendingUp,
        roles: ["OWNER", "ADMIN", "ACCOUNTANT"],
      },
      {
        key: "daily-summary",
        label: "الملخص اليومي",
        to: "/owner/daily-summary",
        icon: Activity,
        roles: ["OWNER", "ADMIN", "ACCOUNTANT"],
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
        roles: ["OWNER", "ADMIN", "MANAGER"],
      },
      {
        key: "website-settings",
        label: "إعدادات الموقع",
        to: "/owner/website-settings",
        icon: Globe,
        roles: ["OWNER", "ADMIN"],
      },
      {
        key: "personal-settings",
        label: "الإعدادات الشخصية",
        to: "/settings",
        icon: UserCheck,
        roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "ACCOUNTANT"],
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
        roles: ["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT"],
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
        "group relative flex min-h-[3.25rem] items-center gap-4 rounded-xl px-4 py-2 text-[13px] font-bold transition-all duration-300",
        collapsed ? "justify-center" : "justify-start",
        active
          ? "bg-accent/10 text-accent shadow-[0_0_20px_rgba(212,175,55,0.1)] ring-1 ring-accent/20"
          : "text-muted hover:bg-white/5 hover:text-main",
      )}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute right-0 top-1/4 h-1/2 w-[3px] rounded-l-full bg-accent shadow-[0_0_10px_rgba(212,175,55,0.5)]"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}

      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-all duration-300 group-hover:scale-110",
          active
            ? "text-accent drop-shadow-[0_0_5px_rgba(212,175,55,0.3)]"
            : "text-muted/70 group-hover:text-accent",
        )}
        strokeWidth={2.5}
      />

      {!collapsed ? (
        <span
          className={cn(
            "truncate transition-colors duration-300",
            active ? "text-accent" : "text-muted/80 group-hover:text-main",
          )}
        >
          {item.label}
        </span>
      ) : null}

      {!collapsed && active && (
        <div className="mr-auto h-1 w-1 rounded-full bg-accent animate-pulse" />
      )}
    </NavLink>
  );

  if (!collapsed) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent
        side="left"
        align="center"
        className="bg-bg-card border-accent/20 text-accent font-bold"
      >
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
    const initialState = {};
    MENU_GROUPS.forEach((group) => {
      if (group.items.some((item) => isRouteActive(location, item.to))) {
        initialState[group.title] = true;
      }
    });
    return initialState;
  });

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
    if (visuallyCollapsed) return;
    setExpandedGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const getAvatarUrl = (): string | null => {
    const profileImage = user?.profile_image_url as string | undefined;
    if (!profileImage) return null;
    if (profileImage.startsWith("http")) return profileImage;
    return `${staticURL}${profileImage}`;
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

  return (
    <aside
      className={cn(
        "relative h-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-[100]",
        visuallyCollapsed ? "w-20" : "w-72",
      )}
      onMouseEnter={() => collapsed && setHoverExpanded(true)}
      onMouseLeave={() => setHoverExpanded(false)}
    >
      {/* Premium Glass Surface */}
      <div className="absolute inset-0 bg-bg-card/95 backdrop-blur-3xl border-l border-border/10 shadow-2xl" />

      {/* Decorative Gold Glow */}
      <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-accent/5 blur-[100px]" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent/5 blur-[100px]" />

      <div className="relative flex h-full flex-col">
        {/* Brand Section */}
        <div className="flex h-24 items-center justify-between px-6">
          {!visuallyCollapsed ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4"
            >
              <div className="relative group">
                <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-md group-hover:bg-accent/40 transition-all duration-500" />
                <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-bg-card to-bg-soft border border-accent/30 text-accent shadow-xl shadow-black/20">
                  <Scissors size={24} strokeWidth={2.5} />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-main leading-tight">
                  Barber Luxe
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/60">
                  Premium Suite
                </span>
              </div>
            </motion.div>
          ) : (
            <div className="mx-auto relative group">
              <div className="absolute inset-0 rounded-xl bg-accent/20 blur-sm" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-bg-card to-bg-soft border border-accent/30 text-accent">
                <Scissors size={20} strokeWidth={2.5} />
              </div>
            </div>
          )}

          {!visuallyCollapsed && (
            <button
              onClick={onToggleCollapsed}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-white/5 text-muted hover:text-accent hover:border-accent/40 hover:bg-accent/5 transition-all group"
            >
              <ChevronRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 custom-scrollbar scroll-smooth">
          {visibleGroups.map((group, gIdx) => {
            const isExpanded = visuallyCollapsed || expandedGroups[group.title];
            return (
              <div key={group.title} className="space-y-3">
                {!visuallyCollapsed && (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="flex w-full items-center justify-between px-3 py-1 text-right text-[11px] font-black uppercase tracking-[0.25em] text-muted/40 hover:text-accent transition-colors group/title"
                  >
                    <span className="group-hover/title:translate-x-1 transition-transform">
                      {group.title}
                    </span>
                    <ChevronDown
                      size={14}
                      className={cn(
                        "transition-transform duration-500 opacity-0 group-hover/title:opacity-100",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </button>
                )}

                <div className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {(isExpanded || visuallyCollapsed) && (
                      <motion.div
                        initial={
                          visuallyCollapsed ? false : { height: 0, opacity: 0 }
                        }
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          duration: 0.4,
                          ease: [0.34, 1.56, 0.64, 1],
                        }}
                        className="space-y-1 overflow-hidden"
                      >
                        {group.items.map((item, iIdx) => (
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
              </div>
            );
          })}
        </nav>

        {/* Footer / User Profile Section */}
        <div className="p-4 space-y-4">
          {!visuallyCollapsed && (
            <div className="relative group p-[1px] rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-accent/20 via-transparent to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-bg-soft/50 backdrop-blur-xl flex items-center gap-4 rounded-[calc(1rem-1px)] p-4 border border-border/50 transition-all group-hover:bg-bg-soft/80">
                <div className="relative h-12 w-12 shrink-0">
                  <div className="absolute inset-0 rounded-xl bg-accent/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-bg-card to-bg-soft text-accent font-bold border border-accent/20 shadow-lg">
                    {getAvatarUrl() ? (
                      <img
                        src={getAvatarUrl() ?? ""}
                        alt="User"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-base">{getInitials()}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -left-1 h-4 w-4 rounded-full border-2 border-bg-main bg-success shadow-sm shadow-success/40" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-black text-main tracking-tight leading-none mb-1.5">
                    {user?.full_name || user?.username}
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                    <div className="h-1 w-1 rounded-full bg-accent" />
                    <span className="text-[10px] text-accent font-black uppercase tracking-wider">
                      {roleLabel(user?.role)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => logout()}
            aria-label="تسجيل الخروج"
            className={cn(
              "group relative flex h-14 w-full items-center gap-4 rounded-2xl px-5 text-[13px] font-black text-danger/70 hover:text-danger hover:bg-danger/10 transition-all duration-300 overflow-hidden border border-transparent hover:border-danger/20",
              visuallyCollapsed ? "justify-center" : "justify-start",
            )}
          >
            <LogOut
              size={20}
              className="shrink-0 transition-transform group-hover:-translate-x-1"
            />
            {!visuallyCollapsed && (
              <div className="flex flex-col items-start">
                <span className="leading-none">تسجيل الخروج</span>
                <span className="text-[9px] opacity-50 uppercase tracking-widest mt-1">
                  End Session
                </span>
              </div>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
