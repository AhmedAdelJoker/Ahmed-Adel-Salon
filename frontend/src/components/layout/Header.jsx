import {
  Menu,
  User,
  Sun,
  Moon,
  Bell,
  Search,
  Command,
  Zap,
  ChevronDown,
  LayoutGrid,
  Calendar,
  Package,
  Receipt,
  ArrowRight,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { normalizeRole } from "../../lib/roleRoutes";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { Badge } from "../ui/badge";

export default function Header({
  title = "Salon Management Pro",
  subtitle = "إدارة وتشغيل الصالون من مكان واحد.",
  onOpenSidebar = () => {},
}) {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { preferences, toggleTheme } = usePreferences();

  const isDark = preferences?.theme !== "light";
  const displayName = user?.full_name || user?.username || "المستخدم";

  const staticUrl = (
    import.meta.env.VITE_API_URL || "import.meta.env.VITE_API_URL/api/v1"
  ).replace("/api/v1", "");

  const getAvatarUrl = () => {
    if (!user?.profile_image_url) return null;
    if (user.profile_image_url.startsWith("http"))
      return user.profile_image_url;
    return `${staticUrl}${user.profile_image_url}`;
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

  const role = normalizeRole(user?.role);
  // All operational roles see the Command Hub
  const hasHubAccess = ["CASHIER", "MANAGER", "OWNER", "ADMIN"].includes(role);
  // POS quick button is specifically for Cashiers and Admins
  const hasQuickPOSAccess = ["CASHIER", "OWNER", "ADMIN"].includes(role);

  const openCommandPalette = () => {
    const event =
      typeof window.CustomEvent === "function"
        ? new window.CustomEvent("open-command-palette")
        : (() => {
            const evt = document.createEvent("CustomEvent");
            evt.initCustomEvent("open-command-palette", false, false, null);
            return evt;
          })();

    window.dispatchEvent(event);
  };

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = new Intl.DateTimeFormat("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(currentTime);

  const formattedDate = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(currentTime);

  return (
    <header
      className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 md:px-8 lg:px-10"
      dir="rtl"
    >
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <button
          type="button"
          disabled={loading}
          onClick={onOpenSidebar}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/60 bg-white dark:border-slate-800/60 dark:bg-slate-900 lg:hidden tap-active transition-all"
          aria-label="فتح القائمة"
        >
          <Menu size={20} className="text-slate-600 dark:text-slate-400" />
        </button>

        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-xl font-black leading-none tracking-tight text-slate-900 dark:text-white sm:text-2xl lg:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden max-w-[42rem] text-xs font-bold tracking-[0.18em] text-slate-500 md:block lg:text-sm">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex w-full items-center justify-end gap-2 sm:gap-3 lg:w-auto">
        {/* Live Clock Section */}
        <div className="hidden items-center gap-3 px-4 py-2 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/40 dark:border-white/5 xl:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-sky-400/10 dark:text-sky-400">
            <Clock size={16} />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
              {formattedTime}
            </span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {formattedDate}
            </span>
          </div>
        </div>

        {hasQuickPOSAccess && (
          <button
            onClick={() => navigate("/pos")}
            className="hidden h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-4 text-xs font-black tracking-widest text-white shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 hover:bg-indigo-700 lg:flex"
          >
            <Zap size={16} fill="currentColor" />
            نقطة البيع
          </button>
        )}

        <button
          onClick={openCommandPalette}
          className="hidden h-11 items-center justify-center rounded-2xl border border-slate-200/50 bg-white/70 px-4 text-slate-500 shadow-sm backdrop-blur-xl transition-all hover:border-indigo-600/30 hover:text-indigo-600 md:flex xl:hidden dark:border-slate-800/50 dark:bg-slate-900/55 dark:hover:text-sky-400"
          aria-label="فتح البحث السريع"
        >
          <Search size={18} />
        </button>

        <button
          onClick={openCommandPalette}
          className="hidden h-12 w-[min(20rem,32vw)] items-center gap-4 rounded-2xl border border-slate-200/40 bg-white/40 px-5 text-slate-400 backdrop-blur-xl transition-all hover:border-indigo-600/30 hover:bg-white/60 xl:flex dark:border-slate-800/40 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
        >
          <Search
            size={18}
            strokeWidth={2.5}
            className="text-indigo-600 dark:text-sky-400"
          />
          <span className="flex-1 text-right text-xs font-black tracking-widest opacity-60">
            البحث السريع...
          </span>
          <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1 text-[10px] font-black text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
            <Command size={10} />
            <span>K</span>
          </div>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={toggleTheme}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/60 bg-white text-slate-500 shadow-sm transition-all hover:text-indigo-600 dark:border-slate-800/60 dark:bg-slate-900 dark:hover:text-sky-400 tap-active"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {hasHubAccess && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/60 bg-white text-slate-500 shadow-sm transition-all hover:text-indigo-600 dark:border-slate-800/60 dark:bg-slate-900 dark:hover:text-sky-400 tap-active">
                  <Bell
                    size={22}
                    className="group-hover:rotate-12 transition-transform"
                  />
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-950 shadow-lg shadow-rose-500/40">
                    5
                  </span>
                  <span className="absolute right-3 top-3 flex h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-950 animate-ping" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[min(92vw,380px)] overflow-hidden border-none p-0 shadow-2xl"
                align="end"
              >
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-5">
                  <div className="flex items-center justify-between text-white">
                    <div className="space-y-0.5">
                      <h3 className="font-black text-sm tracking-tight">
                        مركز القيادة والعمليات
                      </h3>
                      <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest text-indigo-100">
                        الحالة المباشرة للنظام
                      </p>
                    </div>
                    <Badge className="bg-white/20 text-white border-none backdrop-blur-md font-black text-[9px]">
                      5 تنبيهات نشطة
                    </Badge>
                  </div>
                </div>

                <div className="p-2 space-y-1 max-h-[450px] overflow-y-auto no-scrollbar">
                  <DropdownMenuLabel className="px-3 pt-3 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    {role === "OWNER" || role === "ADMIN"
                      ? "نظرة عامة على المؤسسة"
                      : role === "MANAGER"
                        ? "متابعة التشغيل"
                        : "مهامي اليومية"}
                  </DropdownMenuLabel>

                  {/* Role-Based Operational Items */}
                  {(role === "CASHIER" ||
                    role === "ADMIN" ||
                    role === "OWNER") && (
                    <DropdownMenuItem
                      onClick={() => navigate("/pos")}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer group"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                        <Zap size={20} fill="currentColor" />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs">نقطة البيع</span>
                          <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-lg">
                            نشط الآن
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold truncate">
                          الوردية الحالية مستمرة بنجاح
                        </span>
                      </div>
                    </DropdownMenuItem>
                  )}

                  {(role === "CASHIER" ||
                    role === "MANAGER" ||
                    role === "ADMIN" ||
                    role === "OWNER") && (
                    <DropdownMenuItem
                      onClick={() => navigate("/bookings")}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer group"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400 group-hover:scale-105 transition-transform">
                        <Calendar size={20} />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs">الحجوزات</span>
                          <Badge className="bg-amber-500 text-white border-none text-[8px] h-4 font-black">
                            2 جديد
                          </Badge>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold truncate">
                          12 موعد مجدول لهذا اليوم
                        </span>
                      </div>
                    </DropdownMenuItem>
                  )}

                  {(role === "MANAGER" ||
                    role === "ADMIN" ||
                    role === "OWNER" ||
                    role === "CASHIER") && (
                    <DropdownMenuItem
                      onClick={() => navigate("/inventory")}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer group"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400 group-hover:scale-105 transition-transform">
                        <Package size={20} />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs">
                            إدارة المخزون
                          </span>
                          <Badge className="bg-rose-500 text-white border-none text-[8px] h-4 font-black">
                            3 نواقص
                          </Badge>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold truncate">
                          منتجات وصلت للحد الحرج!
                        </span>
                      </div>
                    </DropdownMenuItem>
                  )}

                  {(role === "MANAGER" ||
                    role === "ADMIN" ||
                    role === "OWNER") && (
                    <DropdownMenuItem
                      onClick={() => navigate("/attendance")}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer group"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-400 group-hover:scale-105 transition-transform">
                        <User size={20} />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs">
                            حضور الموظفين
                          </span>
                          <span className="text-[9px] font-black text-slate-400">
                            95% انضباط
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold truncate">
                          جميع الموظفين حاضرين الآن
                        </span>
                      </div>
                    </DropdownMenuItem>
                  )}

                  {(role === "OWNER" || role === "ADMIN") && (
                    <DropdownMenuItem
                      onClick={() => navigate("/owner/financial")}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer group"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                        <Receipt size={20} />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs">
                            الأداء المالي
                          </span>
                          <span className="text-[9px] font-black text-emerald-500">
                            ↑ 12%
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold truncate">
                          نمو إيجابي في الإيرادات اليومية
                        </span>
                      </div>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator className="my-2 bg-slate-100 dark:bg-white/5" />

                  <DropdownMenuLabel className="px-3 pt-1 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    تنبيهات النظام
                  </DropdownMenuLabel>

                  <div className="px-2 space-y-2 pb-3">
                    {/* Activity Feed for Everyone with Hub Access */}
                    <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                          عملية POS
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">
                          منذ 12 دقيقة
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                        إصدار فاتورة جديدة #INV-4022
                      </p>
                    </div>

                    {(role === "OWNER" ||
                      role === "ADMIN" ||
                      role === "MANAGER") && (
                      <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-indigo-600 dark:text-sky-400">
                            رقابة إدارية
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">
                            منذ 5 دقائق
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                          تم تعديل أسعار "خدمة حلاقة مميزة"
                        </p>
                      </div>
                    )}

                    {(role === "OWNER" || role === "ADMIN") && (
                      <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/10 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-rose-600 dark:text-rose-400">
                            تنبيه مالي
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">
                            الآن
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                          تجاوز المصروفات النثرية الحد المسموح
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5">
                  <button
                    onClick={() => navigate("/activity-logs")}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black text-indigo-600 dark:text-sky-400 hover:bg-indigo-600 hover:text-white transition-all"
                  >
                    <span>فتح سجل الرقابة الكامل</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Profile Section */}
          <button
            onClick={() => navigate("/settings")}
            className="group hidden h-11 min-w-0 items-center gap-3 rounded-2xl border border-slate-200/60 bg-white px-3 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800/60 dark:bg-slate-900 dark:hover:bg-slate-800 md:flex"
          >
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-indigo-100 text-indigo-600 transition-transform group-hover:scale-110 dark:bg-sky-400/10 dark:text-sky-400">
              {getAvatarUrl() ? (
                <img
                  src={getAvatarUrl()}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[10px] font-black">{getInitials()}</span>
              )}
            </div>
            <div className="flex min-w-0 flex-col items-start text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">
                الملف الشخصي
              </span>
              <span className="max-w-[7rem] truncate text-xs font-black leading-none text-slate-700 dark:text-slate-200">
                {displayName}
              </span>
            </div>
            <ChevronDown
              size={14}
              className="text-slate-400 transition-transform group-hover:translate-y-0.5"
            />
          </button>
        </div>
      </div>
    </header>
  );
}
