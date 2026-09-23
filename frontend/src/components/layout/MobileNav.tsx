import { NavLink, useLocation } from "react-router-dom";
import { Home, ShoppingBag, Briefcase, Wallet, Users as UsersIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/core/utils";
import { Calendar, Users, Zap } from "lucide-react";

const HOME_BY_ROLE: Record<string, string> = {
  OWNER: "/owner",
  ADMIN: "/owner",
  MANAGER: "/manager",
  CASHIER: "/cashier",
  ACCOUNTANT: "/accountant",
  BARBER: "/barber",
};

export function getMobileHomePath(role: unknown): string {
  return HOME_BY_ROLE[String(role ?? "").toUpperCase()] ?? "/cashier";
}

const MOBILE_LINKS = [
  {
    icon: Home,
    label: "الرئيسية",
    to: "__HOME__",
    roles: ["CASHIER", "MANAGER", "OWNER", "ADMIN", "ACCOUNTANT"],
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
    icon: Briefcase,
    label: "محطتي",
    to: "/barber/workstation",
    roles: ["BARBER"],
  },
  {
    icon: Wallet,
    label: "أرباحي",
    to: "/barber/earnings",
    roles: ["BARBER"],
  },
  {
    icon: UsersIcon,
    label: "عملائي",
    to: "/barber/clients",
    roles: ["BARBER"],
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
  const location = useLocation();
  const role = String(user?.role ?? "").toUpperCase();
  const homePath = getMobileHomePath(role);

  const resolvedLinks = MOBILE_LINKS.map((link) =>
    link.to === "__HOME__" ? { ...link, to: homePath } : link,
  ).filter(
    (link) => !link.roles || link.roles.includes(role),
  );
  const gridCols =
    resolvedLinks.length <= 1
      ? "grid-cols-1"
      : resolvedLinks.length === 2
        ? "grid-cols-2"
        : resolvedLinks.length === 3
          ? "grid-cols-3"
          : resolvedLinks.length === 4
            ? "grid-cols-4"
            : "grid-cols-5";

  return (
    <nav aria-label="التنقل السريع" className="fixed inset-x-4 bottom-4 z-50 lg:hidden">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card/90 px-2 py-2 shadow-premium backdrop-blur-xl">
        <div className={`grid gap-1 ${gridCols}`}>
          {resolvedLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              location.pathname === link.to ||
              location.pathname.startsWith(`${link.to}/`);
            return (
              <NavLink
                key={link.label + link.to}
                to={link.to}
                aria-label={link.label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl py-2 transition-all",
                  isActive
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:bg-soft",
                )}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                <span className="text-[10px] font-bold">{link.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
