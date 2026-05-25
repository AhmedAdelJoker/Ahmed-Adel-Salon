import { NavLink } from "react-router-dom";
import { Home, Zap, Calendar, Users, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";

const MOBILE_LINKS = [
  {
    icon: Home,
    label: "الرئيسية",
    to: "/cashier",
    roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
  },
  {
    icon: Zap,
    label: "الكاشير",
    to: "/pos",
    roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
  },
  {
    icon: Calendar,
    label: "الحجوزات",
    to: "/bookings",
    roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN", "BARBER"],
  },
  {
    icon: Users,
    label: "العملاء",
    to: "/customers",
    roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
  },
  {
    icon: ShoppingBag,
    label: "المخزن",
    to: "/inventory",
    roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN"],
  },
];

export default function MobileNav() {
  const { user } = useAuth();

  const filteredLinks = MOBILE_LINKS.filter(
    (link) => !link.roles || link.roles.includes(user?.role?.toUpperCase()),
  );

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 lg:hidden">
      <div className="mx-auto max-w-[34rem] rounded-[2rem] border border-slate-200/70 bg-white/90 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-2xl backdrop-blur-2xl dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="grid h-auto grid-cols-5 gap-1">
          {filteredLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "relative flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-[1.35rem] px-1 py-2 text-center transition-all duration-300",
                    isActive
                      ? "bg-indigo-50 text-indigo-600 shadow-sm dark:bg-sky-400/10 dark:text-sky-400"
                      : "text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] font-black leading-none">
                      {link.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="mobile-nav-indicator"
                        className="absolute top-0 h-1 w-8 rounded-full bg-indigo-600 dark:bg-sky-400"
                      />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
