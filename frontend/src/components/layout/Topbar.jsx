import {
  Menu,
  Search,
  X,
  Zap,
  User,
  Sun,
  Moon,
  LayoutDashboard,
  Users,
  Receipt,
  Scissors,
  Package,
  Calendar,
  Wallet,
  ShieldCheck,
  Settings,
  History,
  TrendingUp,
  FileBarChart2,
  ChevronDown,
  LogOut,
  Bell,
  BellDot,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useSocket } from "../../context/SocketContext";
import { useDebounce } from "../../hooks/useDebounce";
import { searchService } from "../../services/searchService";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  filterByRole,
  getHomePath,
  getProfilePath,
  getSettingsPath,
} from "../../lib/roleRoutes";
import { cn } from "../../lib/utils";

const SEARCHABLE_PAGES = [
  {
    label: "لوحة التحكم",
    to: "/owner",
    category: "نظام",
    icon: LayoutDashboard,
    roles: ["OWNER", "ADMIN"],
  },
  {
    label: "لوحة المدير",
    to: "/manager",
    category: "نظام",
    icon: LayoutDashboard,
    roles: ["MANAGER"],
  },
  {
    label: "لوحة الكاشير",
    to: "/cashier",
    category: "نظام",
    icon: LayoutDashboard,
    roles: ["CASHIER"],
  },
  {
    label: "لوحة الحلاق",
    to: "/barber",
    category: "نظام",
    icon: Scissors,
    roles: ["BARBER"],
  },
  {
    label: "الموظفون",
    to: "/owner/hr",
    category: "إدارة",
    icon: Users,
    roles: ["OWNER", "ADMIN", "MANAGER"],
  },
  {
    label: "نقطة البيع",
    to: "/pos",
    category: "تشغيل",
    icon: Receipt,
    roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"],
  },
  {
    label: "الحجوزات",
    to: "/bookings",
    category: "تشغيل",
    icon: Calendar,
    roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "BARBER"],
  },
  {
    label: "العملاء",
    to: "/customers",
    category: "تشغيل",
    icon: Users,
    roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"],
  },
  {
    label: "الخدمات",
    to: "/owner/settings?tab=services",
    category: "إدارة",
    icon: Scissors,
    roles: ["OWNER", "ADMIN"],
  },
  {
    label: "المخزون",
    to: "/inventory",
    category: "إدارة",
    icon: Package,
    roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"],
  },
  {
    label: "الفواتير",
    to: "/invoices",
    category: "مالية",
    icon: History,
    roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"],
  },
  {
    label: "المصروفات",
    to: "/expenses",
    category: "مالية",
    icon: Wallet,
    roles: ["OWNER", "ADMIN", "MANAGER", "CASHIER"],
  },
  {
    label: "الرواتب",
    to: "/owner/payroll",
    category: "مالية",
    icon: TrendingUp,
    roles: ["OWNER", "ADMIN"],
  },
  {
    label: "الصلاحيات",
    to: "/owner/permissions",
    category: "نظام",
    icon: ShieldCheck,
    roles: ["OWNER", "ADMIN"],
  },
  {
    label: "الإعدادات",
    to: "/owner/settings",
    category: "نظام",
    icon: Settings,
    roles: ["OWNER", "ADMIN"],
  },
  {
    label: "الصفحات الموصولة",
    to: "/owner/connected-pages",
    category: "نظام",
    icon: FileBarChart2,
    roles: ["OWNER", "ADMIN"],
  },
  {
    label: "الموقع العام والحجز",
    to: "/owner/business-settings",
    category: "إدارة",
    icon: Settings,
    roles: ["OWNER", "ADMIN"],
  },
  {
    label: "الخزنة",
    to: "/owner/cashbox",
    category: "مالية",
    icon: Wallet,
    roles: ["OWNER", "ADMIN"],
  },
  {
    label: "التفضيلات",
    to: "/owner/preferences",
    category: "نظام",
    icon: Settings,
    roles: ["OWNER", "ADMIN"],
  },
  {
    label: "المستخدمون",
    to: "/owner/users",
    category: "نظام",
    icon: Users,
    roles: ["OWNER", "ADMIN"],
  },
];

function roleLabel(role) {
  return (
    {
      owner: "المالك",
      admin: "مدير النظام",
      manager: "مدير",
      cashier: "كاشير",
      barber: "حلاق",
    }[String(role || "").toLowerCase()] || "مستخدم"
  );
}

export default function Topbar({
  onToggleSidebar = () => {},
  mobileSidebarOpen = false,
}) {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const { theme, toggleTheme } = usePreferences();
  const { notifications = [], clearNotifications = () => {} } =
    useSocket() || {};

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [apiResults, setApiResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [currentTime, setCurrentTime] = useState(new Date());
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  const displayName =
    user?.fullName || user?.full_name || user?.username || "مستخدم";
  const role = String(user?.role || "").toUpperCase();
  const isDark = theme === "dark";

  const filteredPages = useMemo(() => {
    const visiblePages = filterByRole(SEARCHABLE_PAGES, user);
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return visiblePages
      .filter((page) =>
        `${page.label} ${page.category}`.toLowerCase().includes(query),
      )
      .slice(0, 5);
  }, [user, searchQuery]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedSearchQuery || debouncedSearchQuery.trim().length < 2) {
        setApiResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const results = await searchService.universalSearch(debouncedSearchQuery);
        setApiResults(results);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    };
    fetchResults();
  }, [debouncedSearchQuery]);

  const allResults = useMemo(() => {
    // Combine filteredPages and apiResults
    const pagesWithSource = filteredPages.map(p => ({ ...p, type: 'page' }));
    return [...pagesWithSource, ...apiResults];
  }, [filteredPages, apiResults]);

  const TYPE_ICONS = {
    page: LayoutDashboard,
    customer: Users,
    employee: User,
    invoice: Receipt,
    service: Scissors,
    product: Package,
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setShowSearchResults(true);
      }
      if (event.key === "Escape") {
        setShowSearchResults(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formattedTime = new Intl.DateTimeFormat("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(currentTime);

  const formattedDate = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(currentTime);

  const goTo = (path) => {
    if (!path) return;
    navigate(path);
    setShowSearchResults(false);
    setSearchQuery("");
  };

  return (
    <header
      className="topbar topbar-modern sticky top-0 z-40 flex w-full flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border border-white/40 bg-white/70 px-3 py-3 shadow-[0_22px_55px_-32px_rgba(15,23,42,0.32)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#07111d]/70 dark:shadow-[0_28px_60px_-34px_rgba(2,8,23,0.85)] sm:px-4 lg:flex-nowrap lg:gap-6 lg:px-6 lg:py-4"
      dir="rtl"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4 lg:gap-6">
        <button
          type="button"
          disabled={loading}
          onClick={onToggleSidebar}
          aria-label={mobileSidebarOpen ? "إغلاق القائمة" : "فتح القائمة"}
          className="topbar__icon-btn topbar-modern__icon-btn flex h-11 w-11 shrink-0 items-center justify-center lg:hidden"
        >
          <Menu size={22} />
        </button>

        <div
          className="relative hidden w-full max-w-xl md:block xl:max-w-2xl"
          ref={searchRef}
        >
          <Search
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 transition-colors duration-300",
              showSearchResults ? "text-accent" : "text-muted",
            )}
            size={18}
          />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery || ""}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
            placeholder="البحث الذكي عن أي شيء... (Ctrl+K)"
            className="h-12 w-full rounded-2xl border border-slate-200/40 bg-white/55 pr-12 text-sm font-bold text-slate-900 placeholder:text-slate-400/60 transition-all focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600/20 dark:border-slate-800/40 dark:bg-slate-900/40 dark:text-slate-100"
          />
          {searchQuery ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setSearchQuery("");
                setShowSearchResults(false);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted transition hover:text-red-500"
              aria-label="مسح البحث"
            >
              <X size={15} />
            </button>
          ) : null}

          <AnimatePresence>
            {showSearchResults && searchQuery.trim() ? (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute left-0 right-0 top-full z-[9999] mt-2 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#171717]"
              >
                <div className="max-h-[420px] overflow-y-auto p-2 custom-scrollbar">
                  {isSearching && allResults.length === 0 ? (
                    <div className="p-8 text-center animate-pulse">
                      <p className="text-sm font-bold text-gray-500">
                        جاري البحث...
                      </p>
                    </div>
                  ) : allResults.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10">
                        <Search size={20} className="text-gray-400" />
                      </div>
                      <p className="text-sm font-black text-gray-900 dark:text-gray-50">
                        لا توجد نتائج لـ "{searchQuery}"
                      </p>
                      <p className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                        جرّب اسم صفحة، عميل، أو رقم فاتورة.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#6D28D9] dark:text-[#22D3EE]">
                        نتائج البحث
                      </div>
                      <div className="space-y-1">
                        {allResults.map((result, idx) => {
                          const Icon =
                            result.icon || TYPE_ICONS[result.type] || Search;
                          return (
                            <motion.button
                              key={result.to + idx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              type="button"
                              disabled={loading}
                              onClick={() => goTo(result.to)}
                              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition hover:bg-purple-50 dark:hover:bg-cyan-400/10"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-gray-50 text-gray-500 transition group-hover:text-[#6D28D9] dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:group-hover:text-[#22D3EE]">
                                <Icon size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-black text-gray-900 dark:text-gray-50">
                                  {result.label}
                                </div>
                                <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                  {result.category || result.type}
                                  {result.sub ? ` • ${result.sub}` : ""}
                                </div>
                              </div>
                              <div className="text-[10px] font-black opacity-0 transition group-hover:opacity-100 text-[#6D28D9] dark:text-[#22D3EE]">
                                انتقال ←
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            inputRef.current?.focus();
            setShowSearchResults(true);
          }}
          className="topbar-modern__icon-btn flex h-11 w-11 items-center justify-center md:hidden"
          aria-label="فتح البحث"
        >
          <Search size={18} />
        </button>
      </div>

      <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 sm:gap-3">
        <div className="hidden flex-col items-end xl:flex">
          <span className="text-sm font-black text-gray-950 dark:text-gray-50">
            {formattedTime}
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {formattedDate}
          </span>
        </div>

        <div className="hidden h-8 w-px bg-black/10 dark:bg-white/10 sm:block" />

        <button
          type="button"
          disabled={loading}
          onClick={toggleTheme}
          className="topbar-modern__icon-btn flex h-11 w-11 items-center justify-center"
          aria-label="تبديل الثيم"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="topbar-modern__icon-btn relative flex h-11 w-11 items-center justify-center"
              aria-label="الإشعارات"
            >
              {notifications.some((n) => !n.isRead) ? (
                <BellDot size={18} className="animate-bounce" />
              ) : (
                <Bell size={18} />
              )}
              {notifications.some((n) => !n.isRead) && (
                <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#121212]" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 p-0 overflow-hidden rounded-3xl border-none shadow-2xl"
          >
            <div className="p-4 bg-primary text-white flex items-center justify-between">
              <span className="font-black text-sm">مركز الإشعارات</span>
              {notifications.length > 0 && (
                <button
                  disabled={loading}
                  onClick={clearNotifications}
                  className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition font-bold"
                >
                  مسح الكل
                </button>
              )}
            </div>
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Bell className="mx-auto text-gray-300" size={32} />
                  <p className="text-xs font-bold text-gray-400">
                    لا توجد إشعارات حالياً
                  </p>
                </div>
              ) : (
                notifications.slice(0, 20).map((n, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-4 border-b border-black/5 flex gap-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/5",
                      !n.isRead && "bg-primary/5",
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Zap size={14} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-gray-900 dark:text-white leading-relaxed">
                        {n.message || n.event}
                      </p>
                      <span className="text-[9px] font-bold text-gray-400 mt-1 block">
                        {n.time || "الآن"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          disabled={loading}
          onClick={() => goTo("/pos")}
          className="topbar-modern__cta hidden h-11 items-center gap-2 rounded-2xl px-4 sm:flex"
        >
          <Zap size={16} />
          <span className="text-xs font-black">نقطة البيع</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="topbar-modern__profile flex h-12 min-w-0 items-center gap-2 rounded-2xl px-2.5 text-gray-900 transition sm:gap-3"
            >
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-purple-50 text-[#6D28D9] dark:bg-cyan-400/10 dark:text-[#22D3EE]">
                {user?.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={18} />
                )}
              </div>
              <div className="hidden min-w-0 text-right sm:block">
                <div className="max-w-[120px] truncate text-sm font-black lg:max-w-[150px]">
                  {displayName}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#6D28D9] dark:text-[#22D3EE]">
                  {roleLabel(user?.role)}
                </div>
              </div>
              <ChevronDown
                size={15}
                className="hidden text-gray-400 sm:block"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={loading}
              onClick={() => goTo(getHomePath(user?.role))}
            >
              <LayoutDashboard size={16} />
              لوحة البداية
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={loading}
              onClick={() => goTo(getProfilePath(user?.role))}
            >
              <User size={16} />
              الملف الشخصي
            </DropdownMenuItem>
            {getSettingsPath(user?.role) ? (
              <DropdownMenuItem
                disabled={loading}
                onClick={() => goTo(getSettingsPath(user?.role))}
              >
                <Settings size={16} />
                الإعدادات
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={loading}
              onClick={() => logout()}
              className="text-red-600 focus:text-red-600 dark:text-red-300 dark:focus:text-red-300"
            >
              <LogOut size={16} />
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

