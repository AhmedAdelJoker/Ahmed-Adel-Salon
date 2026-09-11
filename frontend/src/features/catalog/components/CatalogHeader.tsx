/** Catalog CatalogHeader (moved from ServicesManagement page, no logic changes). */
import { motion } from "framer-motion";
import { Plus, RefreshCw, Search, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PremiumUI";
import { cn } from "@/lib/core/utils";
import { TABS } from "@/features/catalog/constants";

export default function CatalogHeader({
  activeTab,
  onTabChange,
  searchTerm,
  onSearchChange,
  refreshing,
  onRefresh,
  onCreate,
}: {
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
    <>
      <PageHeader
        title="إدارة الخدمات"
        subtitle="إدارة الخدمات، التصنيفات، العروض، وربط استهلاك المنتجات من مساحة تشغيلية واحدة."
        badge="كتالوج العمليات"
        icon={Zap}
        actions={
          <Button
            onClick={onCreate}
            className="h-11 px-8 shadow-accent"
          >
            {activeTab === "services"
              ? "إضافة خدمة"
              : activeTab === "categories"
                ? "إضافة تصنيف"
                : "إضافة عرض"}{" "}
            <Plus className="mr-2" size={18} />
          </Button>
        }
      />

      {/* Advanced Tabs Navigation */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex bg-card/80 backdrop-blur-md border border-border/50 p-1.5 rounded-2xl shadow-soft">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => onTabChange(tab.key)}
                  className={cn(
                    "relative flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300",
                    isActive
                      ? "bg-white dark:bg-black/40 text-main shadow-premium border border-border/10 scale-105 z-10"
                      : "text-muted hover:text-main hover:bg-soft",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                      isActive ? tab.bg : "bg-transparent",
                    )}
                  >
                    <Icon
                      size={16}
                      className={isActive ? tab.color : "text-muted"}
                    />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute inset-0 bg-primary/5 rounded-xl -z-10"
                      initial={false}
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <div className="h-1 w-12 rounded-full bg-border/40" />
            <Badge
              variant="outline"
              className="h-9 rounded-xl px-4 font-black uppercase tracking-widest text-[9px] bg-card/50"
            >
              كتالوج العمليات النشط
            </Badge>
          </div>
        </div>

        {/* Toolbar: Search and Global Actions */}
        <div className="flex flex-col lg:flex-row items-center gap-4">
          <div className="relative flex-1 w-full group">
            <Search
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors duration-300"
              size={18}
            />
            <Input
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-14 w-full pr-12 rounded-[18px] border-border/60 bg-card shadow-soft-sm focus:bg-white dark:focus:bg-black/20 focus:ring-4 focus:ring-primary/5 text-sm font-bold transition-all duration-300"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-soft flex items-center justify-center text-muted hover:text-main transition-colors"
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
              className="h-14 flex-1 lg:flex-initial rounded-[18px] border-border/60 bg-card px-6 font-black text-xs uppercase tracking-widest hover:bg-soft transition-all"
            >
              <RefreshCw
                size={16}
                className={cn("ml-2", refreshing && "animate-spin")}
              />
              تحديث البيانات
            </Button>

            <Button
              onClick={onCreate}
              className="h-14 flex-1 lg:flex-initial rounded-[18px] px-8 font-black text-xs uppercase tracking-widest shadow-premium hover:scale-[1.02] transition-all"
            >
              <Plus size={18} className="ml-2" />
              {activeTab === "services"
                ? "���� ���"
                : activeTab === "categories"
                  ? "���� �����"
                  : "�묟� ��"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
