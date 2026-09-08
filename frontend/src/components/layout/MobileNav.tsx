import { NavLink } from "react-router-dom";
import { Home, ShoppingBag } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/core/utils";
import { Calendar, Users, Zap } from "lucide-react";

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
    (link) => !link.roles || link.roles.includes(String(user?.role ?? "").toUpperCase()),
  );

  return (
    <nav className="fixed inset-x-4 bottom-4 z-50 lg:hidden">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card/90 px-2 py-2 shadow-premium backdrop-blur-xl">
        <div className="grid grid-cols-5 gap-1">
          {filteredLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-1 rounded-xl py-2 transition-all",
                    isActive
                      ? "bg-primary-soft text-primary"
                      : "text-muted hover:bg-soft",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] font-bold">{link.label}</span>
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
