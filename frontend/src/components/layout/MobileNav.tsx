import { NavLink, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/core/utils";
import { getHomePath, hasRoleAccess } from "@/lib/access/roles";
import { getMobileNavItems } from "@/app/route-registry";

export function getMobileHomePath(role: unknown): string {
  return getHomePath(role);
}

export default function MobileNav() {
  const { user } = useAuth();
  const location = useLocation();

  const links = useMemo(
    () =>
      getMobileNavItems()
        .filter((item) => hasRoleAccess(user, item.roles as string[], item.to))
        // The registry marks each role's dashboard with mobileOrder 1 and
        // single-role navs, so every role keeps a home entry. Previously BARBER
        // got no home button at all because its entries were all sub-pages.
        .sort((a, b) => a.order - b.order),
    [user],
  );

  const gridCols =
    links.length <= 1
      ? "grid-cols-1"
      : links.length === 2
        ? "grid-cols-2"
        : links.length === 3
          ? "grid-cols-3"
          : links.length === 4
            ? "grid-cols-4"
            : "grid-cols-5";

  if (links.length === 0) return null;

  return (
    <nav
      aria-label="التنقل السريع"
      className="fixed inset-x-4 bottom-4 z-50 lg:hidden"
    >
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card/90 px-2 py-2 shadow-premium backdrop-blur-xl">
        <div className={`grid gap-1 ${gridCols}`}>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive =
              location.pathname === link.to ||
              location.pathname.startsWith(`${link.to}/`);
            return (
              <NavLink
                key={link.to}
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
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2.5 : 2}
                  aria-hidden="true"
                />
                <span className="text-[10px] font-bold">{link.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
