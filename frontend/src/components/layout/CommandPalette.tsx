import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { hasRoleAccess } from "@/lib/access/roles";
import {
  getSearchCategories,
  getSearchEntries,
  type NavItem,
} from "@/app/route-registry";

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handleCustomOpen = () => setOpen(true);

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleCustomOpen);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleCustomOpen);
    };
  }, []);

  const roleFiltered = useMemo(
    () =>
      // The palette used to be a static list with no role filter, so any role
      // could jump to owner-only pages and get bounced by the guard.
      getSearchEntries().filter((entry: NavItem) =>
        hasRoleAccess(user, entry.roles as string[], entry.to),
      ),
    [user],
  );

  const filteredLinks = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return roleFiltered;

    return roleFiltered.filter((entry) =>
      `${entry.label} ${entry.searchCategory ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [query, roleFiltered]);

  const groupedLinks = useMemo(() => {
    const order = getSearchCategories();
    return filteredLinks.reduce<Record<string, NavItem[]>>(
      (accumulator, entry) => {
        const key = entry.searchCategory ?? "";
        accumulator[key] = accumulator[key] || [];
        accumulator[key].push(entry);
        return accumulator;
      },
      {},
    );
  }, [filteredLinks]);

  const handleSelect = (to: string) => {
    navigate(to);
    setOpen(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-xl border-none bg-transparent p-0 shadow-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">البحث السريع</DialogTitle>
        <DialogDescription className="sr-only">
          انتقال سريع بين الصفحات والإجراءات الأساسية.
        </DialogDescription>

        <div className="overflow-hidden rounded-premium border border-border bg-card shadow-premium">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <Search size={18} className="text-primary" />
            <input
              autoFocus
              aria-label="البحث السريع عن صفحة أو مهمة"
              placeholder="ابحث عن صفحة أو مهمة..."
              className="flex-1 bg-transparent text-right text-sm font-bold text-main outline-none placeholder:text-muted/60"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="rounded border border-border bg-soft px-1.5 py-0.5 text-[10px] font-bold text-muted">
              ESC
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {filteredLinks.length ? (
              Object.entries(groupedLinks)
                .sort(
                  ([a], [b]) =>
                    getSearchCategories().indexOf(
                      a as never,
                    ) - getSearchCategories().indexOf(b as never),
                )
                .map(([category, links]) => (
                  <section key={category} className="mb-2 last:mb-0">
                    <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-muted/60">
                      {category}
                    </div>
                    <div className="space-y-0.5">
                      {links.map((link) => {
                        const Icon = link.icon;
                        return (
                          <button
                            key={link.to}
                            type="button"
                            onClick={() => handleSelect(link.to)}
                            className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-right transition hover:bg-soft"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded bg-soft text-muted group-hover:text-primary">
                                <Icon size={16} />
                              </div>
                              <div className="text-left">
                                <div className="text-sm font-bold text-main">
                                  {link.label}
                                </div>
                              </div>
                            </div>
                            <ChevronRight
                              size={14}
                              className="text-muted/40"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center p-6 text-center text-muted">
                <Search size={32} className="mb-2 opacity-20" />
                <p className="text-sm font-bold">لا توجد نتائج مطابقة</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
