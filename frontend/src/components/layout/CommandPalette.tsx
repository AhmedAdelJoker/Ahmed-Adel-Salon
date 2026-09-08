import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronRight,
  Package,
  Scissors,
  Search,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const QUICK_LINKS = [
  { icon: Zap, label: "نقطة البيع", to: "/pos", category: "تشغيل" },
  { icon: Calendar, label: "الحجوزات", to: "/bookings", category: "تشغيل" },
  {
    icon: Users,
    label: "العملاء",
    to: "/customers",
    category: "علاقات العملاء",
  },
  {
    icon: Scissors,
    label: "الخدمات والعروض",
    to: "/owner/settings?tab=services",
    category: "الإدارة",
  },
  { icon: Package, label: "المخزون", to: "/inventory", category: "الإدارة" },
  { icon: Wallet, label: "المصروفات", to: "/expenses", category: "المالية" },
  {
    icon: TrendingUp,
    label: "التقارير التشغيلية",
    to: "/owner/reports",
    category: "المالية",
  },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (event) => {
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

  const filteredLinks = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return QUICK_LINKS;

    return QUICK_LINKS.filter((link) =>
      `${link.label} ${link.category}`.toLowerCase().includes(term),
    );
  }, [query]);

  interface QuickLink {
    to: string;
    label: string;
    category: string;
    icon?: React.ComponentType<{ size?: number | string; className?: string }>;
    [key: string]: unknown;
  }

  const groupedLinks = useMemo(() => {
    return filteredLinks.reduce<Record<string, QuickLink[]>>((accumulator, link) => {
      const key = String((link as QuickLink).category || "");
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(link as QuickLink);
      return accumulator;
    }, {});
  }, [filteredLinks]);

  const handleSelect = (to) => {
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
              Object.entries(groupedLinks).map(([category, links]) => (
                <section key={category} className="mb-2 last:mb-0">
                  <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-muted/60">
                    {category}
                  </div>
                  <div className="space-y-0.5">
                    {links.map((link) => (
                      <button
                        key={link.to}
                        type="button"
                        onClick={() => handleSelect(link.to)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right transition hover:bg-soft"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-soft text-muted group-hover:text-primary">
                            {link.icon ? <link.icon size={16} /> : null}
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-bold text-main">
                              {link.label}
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-muted/40" />
                      </button>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center text-center text-muted p-6">
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
