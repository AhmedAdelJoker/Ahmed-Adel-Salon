/** Catalog CatalogHeader — unified with Settings tabs. */
import { Plus, RefreshCw, Search, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PremiumUI";
import { cn } from "@/lib/core/utils";
import { TABS } from "@/features/catalog/constants";

export default function CatalogHeader({
  hideHeader = false,
  activeTab,
  onTabChange,
  searchTerm,
  onSearchChange,
  refreshing,
  onRefresh,
  onCreate,
}: {
  hideHeader?: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  const searchPlaceholder =
    activeTab === "services"
      ? "ابحث عن خدمة أو تصنيف..."
      : activeTab === "categories"
        ? "ابحث عن تصنيف..."
        : "ابحث عن عرض أو خدمة مشمولة...";
  return (
    <div className="flex flex-col gap-4">
      {!hideHeader && (
        <PageHeader
          title="إدارة الخدمات"
          subtitle="إدارة الخدمات، التصنيفات، العروض، وربط استهلاك المنتجات من مساحة تشغيلية واحدة."
          badge="كتالوج العمليات"
          icon={Zap}
          actions={
            <Button onClick={onCreate} className="h-11 px-8 shadow-accent">
              {activeTab === "services"
                ? "إضافة خدمة"
                : activeTab === "categories"
                  ? "إضافة تصنيف"
                  : "إضافة عرض"}{" "}
              <Plus className="mr-2" size={18} />
            </Button>
          }
        />
      )}

      {/* Tabs — neutral like Settings/WorkingHours */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div
            className="flex gap-1.5 p-1.5 bg-soft rounded-2xl border border-border w-fit"
            role="tablist"
            aria-label="أقسام الكتالوج"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onTabChange(tab.key)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black transition-all",
                    isActive
                      ? "bg-card text-main shadow-sm border border-border"
                      : "text-muted hover:text-main",
                  )}
                >
                  <Icon size={14} className={isActive ? tab.color : "text-muted"} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-4 shrink-0">
            <div className="h-1 w-12 rounded-full bg-border/40" />
            <Badge
              variant="outline"
              className="h-9 rounded-xl px-4 font-black tracking-widest text-[9px] bg-card/50"
            >
              كتالوج العمليات النشط
            </Badge>
          </div>
        </div>

        {/* Toolbar: Search + refresh (create lives in PageHeader when visible) */}
        <div className="flex flex-col lg:flex-row items-center gap-3">
          <div className="relative flex-1 w-full group">
            <Search
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors"
              size={16}
            />
            <Input
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 w-full pr-12 rounded-xl border-border/60 bg-card text-sm font-bold focus:bg-card transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-soft flex items-center justify-center text-muted hover:text-main transition-colors"
                aria-label="مسح البحث"
              >
                <XCircle size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Button
              variant="outline"
              onClick={() => onRefresh()}
              disabled={refreshing}
              className="h-11 flex-1 lg:flex-initial rounded-xl border-border/60 bg-card px-6 font-black text-xs hover:bg-soft"
            >
              <RefreshCw size={15} className={cn("ml-2", refreshing && "animate-spin")} />
              تحديث
            </Button>
            {hideHeader && (
              <Button onClick={onCreate} className="h-11 flex-1 lg:flex-initial rounded-xl px-6 font-black text-xs shadow-sm">
                <Plus size={16} className="ml-2" />
                {activeTab === "services"
                  ? "إضافة خدمة"
                  : activeTab === "categories"
                    ? "إضافة تصنيف"
                    : "إضافة عرض"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
