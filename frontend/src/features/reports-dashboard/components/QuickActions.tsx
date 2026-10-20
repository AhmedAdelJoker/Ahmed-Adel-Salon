import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";

import { ContentPanel } from "@/components/shared/PremiumUI";
import { cn } from "@/lib/core/utils";
import { useAuth } from "@/context/AuthContext";
import { hasRoleAccess } from "@/lib/access/roles";
import { getQuickNavItems } from "@/app/route-registry";

export interface QuickActionsProps {
  onNavigate: (to: string) => void;
}

// Presentation only. Which routes appear is decided by the `quick` flag in the
// route registry, and which of those the user may open is decided by the same
// `hasRoleAccess` check the sidebar uses.
//
// These eight paths were previously written out by hand here, next to labels
// and paths that the registry already owned. Two lists of the same navigation
// is two things to update: a route renamed in the registry left this grid
// pointing at a path the sidebar no longer shows, under a label nothing else in
// the product used.
const TONES = [
  "bg-primary/10 text-primary border-primary/20",
  "bg-info/10 text-info border-info/20",
  "bg-warning/10 text-warning border-warning/20",
  "bg-success/10 text-success border-success/20",
  "bg-danger/10 text-danger border-danger/20",
] as const;

export function QuickActions({ onNavigate }: QuickActionsProps) {
  const { user } = useAuth();

  const items = useMemo(
    () =>
      getQuickNavItems().filter((item) =>
        hasRoleAccess(user, item.roles as string[], item.to),
      ),
    [user],
  );

  // A grid with nothing in it is worse than no grid. Renders nothing rather than
  // an empty panel titled "quick access".
  if (items.length === 0) return null;

  return (
    <ContentPanel title={undefined} subtitle={undefined} actions={undefined} className={undefined}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent/10 text-accent">
            <ArrowUpRight size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black tracking-tight text-main truncate">وصول سريع</h3>
            <p className="text-xs font-bold text-muted">اختصارات لأهم العمليات اليومية</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        {items.map((item, idx) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.to)}
            className={cn(
              "group flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-4 transition-all duration-300",
              "hover:border-primary/20 hover:bg-primary/5 hover:shadow-lg hover:-translate-y-0.5",
              TONES[idx % TONES.length],
            )}
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <div
              className={cn(
                "rounded-xl p-3 transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:rotate-3",
                TONES[idx % TONES.length].split(" ").slice(0, 2).join(" "),
              )}
            >
              <item.icon size={22} strokeWidth={2} />
            </div>
            <span className="text-[10px] font-black tracking-wider text-muted group-hover:text-primary truncate">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </ContentPanel>
  );
}