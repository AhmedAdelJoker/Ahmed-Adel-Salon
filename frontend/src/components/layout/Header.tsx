import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronDown,
  Command,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  User,
  Wallet,
  Clock as ClockIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";
import { useSalon } from "@/context/SalonContext";
import { staticURL } from "@/services/api";
import { formatCurrency } from "@/lib/core/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getHomePath, normalizeRole } from "@/lib/access/roles";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";

const roleLabel = (role) =>
  ({
    OWNER: "المالك",
    ADMIN: "مدير النظام",
    MANAGER: "المدير",
    CASHIER: "الكاشير",
    BARBER: "الخبير",
    ACCOUNTANT: "المحاسب",
  })[normalizeRole(role)] || "المستخدم";

export default function Header({
  title = "Barber Luxe",
  subtitle = "Premium Management Suite",
  onOpenSidebar = () => {},
}) {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const { preferences, toggleTheme } = usePreferences();
  const { valutBalance, vaultCashBalance } = useSalon();

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isDark = preferences?.theme !== "light";
  const role = normalizeRole(user?.role);
  const displayName = user?.full_name || user?.username || "المستخدم";

  const getAvatarUrl = (): string | null => {
    const profileImage = user?.profile_image_url as string | undefined;
    if (!profileImage) return null;
    if (profileImage.startsWith("http")) return profileImage;
    return `${staticURL}${profileImage}`;
  };

  const getInitials = () => {
    const name = displayName;
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const openCommandPalette = () => {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  };

  return (
    <header
      className="relative z-50 flex min-h-16 w-full min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border/5 bg-bg-card/40 px-3 py-3 backdrop-blur-xl sm:min-h-20 sm:px-6 lg:flex-nowrap lg:px-8"
    >
      {/* Decorative Top Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[1px] w-1/2 bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
        <button
          onClick={onOpenSidebar}
          aria-label="فتح القائمة الجانبية"
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-border/50 text-muted hover:text-accent hover:border-accent/40 lg:hidden transition-all"
        >
          <Menu size={20} />
        </button>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex min-w-0 flex-col"
        >
          <h1 className="text-[14px] font-black tracking-normal text-main leading-tight drop-shadow-sm sm:text-[15px]">
            {title}
          </h1>
          {subtitle && (
            <div className="mt-1 flex min-w-0 items-start gap-2">
              <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent/60" />
              <p className="text-[9px] font-black uppercase tracking-normal text-accent/70">
                {subtitle}
              </p>
            </div>
          )}
        </motion.div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4 lg:flex-none lg:gap-6">
        {/* Search Command Button (full on desktop, icon-only on smaller screens) */}
        <button
          onClick={openCommandPalette}
          aria-label="فتح البحث الذكي"
          className="focus-ring flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 border border-border/40 text-muted hover:text-accent hover:border-accent/30 hover:bg-accent/5 transition-all lg:hidden"
        >
          <Search size={18} />
        </button>
        <button
          onClick={openCommandPalette}
          aria-label="فتح البحث الذكي"
          className="focus-ring hidden lg:flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-border/40 text-muted/60 hover:text-main hover:border-accent/50 hover:bg-accent/5 transition-all group shadow-sm"
        >
          <Search
            size={14}
            className="group-hover:text-accent group-hover:scale-110 transition-all"
          />
          <span className="text-[11px] font-black uppercase tracking-widest">
            البحث الذكي
          </span>
          <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-bg-main/50 px-2 py-0.5 text-[9px] font-black text-muted/80 group-hover:text-accent transition-colors">
            <Command size={9} /> K
          </div>
        </button>

        {/* Real-time Status Widgets */}
        <div className="hidden xl:flex min-w-0 items-center gap-4">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-bg-soft/40 border border-border/30 shadow-inner group">
            <div className="relative">
              <div className="absolute inset-0 bg-accent/20 blur-sm rounded-full animate-pulse" />
              <ClockIcon size={14} className="relative text-accent" />
            </div>
            <span className="text-[13px] font-black text-main tabular-nums tracking-tight">
              {currentTime.toLocaleTimeString("ar-EG", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>

          {(role === "OWNER" ||
            role === "CASHIER" ||
            role === "ADMIN" ||
            role === "ACCOUNTANT") && (
            <div
              onClick={() => navigate("/owner/cashbox")}
              title="الخزنة المركزية — مرتبط بالخزنة (نقدي + رقمي)"
              className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-accent/5 border border-accent/20 shadow-sm group hover:bg-accent/10 transition-all cursor-pointer"
            >
              <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
                <Wallet size={16} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[9px] font-black text-accent/60 uppercase tracking-widest mb-1.5">
                  الخزنة • Vault
                </span>
                <span className="text-[14px] font-black text-main tabular-nums drop-shadow-sm">
                  {formatCurrency(valutBalance)}
                </span>
                <span className="text-[9px] font-bold text-muted hidden xl:block">
                  نقدي {formatCurrency(vaultCashBalance)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="h-8 w-[1px] bg-border/40 mx-2 hidden sm:block" />

        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <button
            onClick={toggleTheme}
            aria-label={isDark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 border border-border/40 text-muted hover:text-accent hover:border-accent/30 hover:bg-accent/5 transition-all"
          >
            {isDark ? (
              <Sun size={18} strokeWidth={2.5} />
            ) : (
              <Moon size={18} strokeWidth={2.5} />
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="قائمة المستخدم"
                aria-haspopup="menu"
                className="flex min-w-0 items-center gap-2 rounded-2xl border border-transparent p-1.5 transition-all hover:border-border/40 hover:bg-white/5 sm:gap-4 sm:pl-4 group">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-accent/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-gradient-to-br from-bg-card to-bg-soft text-accent font-black border border-accent/30 shadow-md">
                    {getAvatarUrl() ? (
                      <img
                        src={getAvatarUrl() ?? ""}
                        alt={displayName}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs">
                        {getInitials()}
                      </span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -left-1 h-3.5 w-3.5 rounded-full border-2 border-bg-card bg-success" />
                </div>
                <div className="hidden min-w-0 max-w-36 flex-col items-start text-right sm:flex lg:max-w-44">
                  <span className="max-w-full text-[13px] font-black text-main leading-tight group-hover:text-accent transition-colors">
                    {displayName}
                  </span>
                  <span className="max-w-full text-[10px] font-bold text-accent/60 uppercase tracking-normal mt-0.5">
                    {roleLabel(user?.role)}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className="text-muted/40 group-hover:text-accent transition-all"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 p-3 bg-bg-card/95 backdrop-blur-2xl border-accent/20 shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 duration-200"
            >
              <DropdownMenuLabel className="px-3 pb-3 pt-1">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-black text-main tracking-tight">
                    {displayName}
                  </span>
                  <div className="inline-flex w-fit items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                    <div className="h-1 w-1 rounded-full bg-accent" />
                    <span className="text-[9px] font-black text-accent uppercase tracking-widest">
                      {user?.email || roleLabel(user?.role)}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/20 my-2" />
              <div className="space-y-1">
                <DropdownMenuItem
                  onClick={() => navigate(getHomePath(role))}
                  className="rounded-xl py-2.5 font-bold cursor-pointer hover:bg-accent/5 focus:bg-accent/5 focus:text-accent group"
                >
                  <LayoutDashboard
                    size={16}
                    className="ml-3 text-muted/60 group-hover:text-accent transition-colors"
                  />
                  <span className="text-[13px]">لوحة التحكم</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/settings")}
                  className="rounded-xl py-2.5 font-bold cursor-pointer hover:bg-accent/5 focus:bg-accent/5 focus:text-accent group"
                >
                  <User
                    size={16}
                    className="ml-3 text-muted/60 group-hover:text-accent transition-colors"
                  />
                  <span className="text-[13px]">إعدادات الحساب</span>
                </DropdownMenuItem>
              </div>
              <DropdownMenuSeparator className="bg-border/20 my-2" />
              <DropdownMenuItem
                onClick={() => logout()}
                className="rounded-xl py-3 font-black text-danger/80 hover:text-danger hover:bg-danger/10 focus:text-danger focus:bg-danger/10 cursor-pointer group"
              >
                <LogOut
                  size={16}
                  className="ml-3 group-hover:-translate-x-1 transition-transform"
                />
                <span className="text-[13px]">تسجيل الخروج</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
