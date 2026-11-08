import { useAuth } from "@/context/AuthContext";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Store,
  Users,
  Zap,
  Lock,
  ChevronRight,
  ShieldCheck,
  Trophy,
  Settings as SettingsIcon,
  Globe,
  Bell,
  Activity,
  Clock,
  Scissors,
  Image as ImageIcon,
  Upload,
  MessageCircle,
  MapPin,
  Receipt,
  Coins,
  ExternalLink,
  Percent,
  Target,
} from "lucide-react";
import api, { staticURL } from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import {
  errorHeadline,
  isConflict,
  toErrorLines,
  type ApiErrorLine,
} from "@/lib/core/apiErrors";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PageHeader,
  PremiumCard,
  ContentPanel,
  SkeletonCard,
} from "@/components/shared/PremiumUI";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

// New Panel Components
import WorkingHoursPanel from "@/pages/owner/WorkingHoursPanel";
import ServicesManagement from "@/pages/owner/ServicesManagement";
import SecurityAccess from "@/pages/owner/SecurityAccess";
import BusinessSettingsPage from "@/pages/owner/BusinessSettingsPage";
import UsersPanel from "@/pages/owner/UsersPanel";
import LoyaltySettingsPanel from "@/pages/owner/LoyaltySettingsPanel";

import { validateImageSize } from "@/lib/media/upload";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AnimatePresence } from "framer-motion";

 
const normalizeShopSettings = (data: Record<string, any> = {}, fallback: Record<string, any> = {}) => ({
  salon_name: data.salon_name ?? data.salonName ?? fallback.salon_name ?? "",
  shop_phone: data.shop_phone ?? data.shopPhone ?? fallback.shop_phone ?? "",
  shop_whatsapp:
    data.shop_whatsapp ?? data.shopWhatsApp ?? fallback.shop_whatsapp ?? "",
  address: data.address ?? fallback.address ?? "",
  logo_url: data.logo_url ?? data.logoUrl ?? fallback.logo_url ?? "",
  logoUrl: data.logoUrl ?? data.logo_url ?? fallback.logoUrl ?? "",
  google_maps_url:
    data.google_maps_url ?? data.googleMapsUrl ?? fallback.google_maps_url ?? "",
  googleMapsUrl:
    data.googleMapsUrl ?? data.google_maps_url ?? fallback.googleMapsUrl ?? "",
  receipt_footer:
    data.receipt_footer ?? data.receiptFooter ?? fallback.receipt_footer ?? "",
  currency: data.currency ?? fallback.currency ?? "EGP",
  // VAT percentage (0–100). Normalized to a string so the number input and
  // the dirty-check both compare consistently; 0 means no tax line.
  tax_rate: String(
    data.tax_rate ?? data.taxRate ?? fallback.tax_rate ?? "0",
  ),
  // Cashier discount limit (read-only here; editable only by the owner's
  // back-office flow). Kept as strings for consistent dirty-check display.
  cashier_discount_limit_type:
    data.cashier_discount_limit_type ??
    data.cashierDiscountLimitType ??
    fallback.cashier_discount_limit_type ??
    "percent",
  cashier_discount_limit_value: String(
    data.cashier_discount_limit_value ??
      data.cashierDiscountLimitValue ??
      fallback.cashier_discount_limit_value ??
      "0",
  ),
  // Monthly sales target (reference only, read-only in this view).
  monthly_revenue_target: String(
    data.monthly_revenue_target ??
      data.monthlyRevenueTarget ??
      fallback.monthly_revenue_target ??
      "0",
  ),
});

const SETTINGS_TABS = [
  { id: "shop", key: "settings.tabShop", icon: Store },
  { id: "hours", key: "settings.tabHours", icon: Clock },
  { id: "services", key: "settings.tabServices", icon: Scissors },
  { id: "website", key: "settings.tabWebsite", icon: Globe },
  { id: "loyalty", key: "settings.tabLoyalty", icon: Trophy },
  { id: "users", key: "settings.tabUsers", icon: Users },
  { id: "security", key: "settings.tabSecurity", icon: Lock },
];

const Settings = () => {
  // The POS-domain fields (VAT rate) use the `pos` namespace; the rest of this
  // page still carries Arabic literals pending its own migration.
  const { t } = useTranslation("pos");
  const { t: ot } = useTranslation("owner");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwnerLike = useMemo(() => {
    const role = String(user?.role || "").toUpperCase();
    return ["OWNER", "ADMIN"].includes(role);
  }, [user?.role]);

  const visibleTabs = useMemo(
    () => (isOwnerLike ? SETTINGS_TABS : SETTINGS_TABS.filter((t) => t.id === "hours")),
    [isOwnerLike],
  );

  const requestedTab = searchParams.get("tab");
  const isLegacyAccountTab = requestedTab === "profile" || requestedTab === "preferences";
  const activeTab = isLegacyAccountTab
    ? (requestedTab as string)
    : visibleTabs.some((tab) => tab.id === requestedTab)
      ? (requestedTab as string)
      : isOwnerLike
        ? "shop"
        : "hours";

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [shopInitial, setShopInitial] = useState<Record<string, string> | null>(null);
  const [hoursDirty, setHoursDirty] = useState(false);
  const [shopFetchStarted, setShopFetchStarted] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [settingsVersion, setSettingsVersion] = useState<number | undefined>(undefined);
  const [publicSiteStale, setPublicSiteStale] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [shopSaveErrors, setShopSaveErrors] = useState<ApiErrorLine[]>([]);
  const [shopConflict, setShopConflict] = useState<string | null>(null);
  const tabListRef = useRef<HTMLDivElement>(null);

  const [shopSettings, setShopSettings] = useState({
    salon_name: "",
    shop_phone: "",
    shop_whatsapp: "",
    address: "",
    logo_url: "",
    logoUrl: "",
    google_maps_url: "",
    googleMapsUrl: "",
    receipt_footer: "",
    currency: "EGP",
    tax_rate: "0",
    cashier_discount_limit_type: "percent",
    cashier_discount_limit_value: "0",
    monthly_revenue_target: "0",
  });

  const getLogoPreviewUrl = () => {
    const logoPath = shopSettings.logo_url || shopSettings.logoUrl;
    if (!logoPath) return null;
    if (String(logoPath).startsWith("http")) return logoPath;
    return `${staticURL}${logoPath}`;
  };

  const uploadLogoFile = useCallback(
    async (file: File) => {
      if (!file || !validateImageSize(file)) return;
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
        toast.error(ot("settings.logoFormat"));
        return;
      }
      setLogoUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await api.post("/business-settings/logo", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const updated = adaptObject(res, {}) || {};
        setShopSettings((prev) => {
          const next = { ...prev, ...normalizeShopSettings(updated, prev) } as typeof prev;
          setShopInitial((cur) => cur ?? { ...next });
          return next;
        });
        toast.success(ot("settings.logoUploaded"));
      } catch {
        toast.error(ot("settings.logoUploadFailed"));
      } finally {
        setLogoUploading(false);
      }
    },
    [],
  );

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    await uploadLogoFile(file as File);
    event.target.value = "";
  };

  const fetchData = useCallback(async () => {
    setInitialLoading(true);
    setLoadError(null);
    try {
      const res = await api.get("/business-settings");
      const settingsData = (adaptObject(res, {}) || {}) as Record<string, unknown>;
      if (settingsData && Object.keys(settingsData).length) {
        const normalized = normalizeShopSettings(settingsData, {});
        setShopSettings((prev) => ({ ...prev, ...normalized }));
        setShopInitial({ ...normalized } as Record<string, string>);
        setSettingsVersion(Number(settingsData.version) || undefined);
        setPublicSiteStale(Boolean(settingsData.publicSiteStale));
        setSettingsReady(true);
      } else {
        setLoadError(ot("settings.loadShopFailed"));
      }
    } catch {
      setLoadError(ot("settings.loadSettingsFailed"));
      toast.error(ot("settings.loadShopToast"));
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "shop" || settingsReady || shopFetchStarted) return;
    setShopFetchStarted(true);
    void fetchData();
  }, [activeTab, settingsReady, shopFetchStarted, fetchData]);

  const shopIsDirty = useMemo(() => {
    if (!shopInitial) return false;
    const keys: Array<keyof typeof shopSettings> = [
      "salon_name",
      "shop_phone",
      "shop_whatsapp",
      "address",
      "google_maps_url",
      "receipt_footer",
      "currency",
      "tax_rate",
    ];
    return keys.some((k) => String(shopSettings[k] ?? "") !== String(shopInitial[k] ?? ""));
  }, [shopSettings, shopInitial]);

  const shopCompleteness = useMemo(() => {
    const checks = [
      Boolean(shopSettings.salon_name.trim()),
      Boolean((shopSettings.logo_url || shopSettings.logoUrl || "").trim()),
      Boolean(shopSettings.shop_phone.trim() || shopSettings.shop_whatsapp.trim()),
      Boolean(shopSettings.address.trim()),
    ];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length };
  }, [shopSettings]);

  const dirtyLabel = useMemo(() => {
    if (activeTab === "shop" && shopIsDirty) return ot("settings.dirtyShop");
    if (activeTab === "hours" && hoursDirty) return ot("settings.dirtyHours");
    return null;
  }, [activeTab, shopIsDirty, hoursDirty]);

  const commitTab = useCallback(
    (tab: string) => {
      setSearchParams({ tab });
      setPendingTab(null);
    },
    [setSearchParams],
  );

  const requestTab = useCallback(
    (tab: string) => {
      if (tab === activeTab) return;
      if (dirtyLabel) {
        setPendingTab(tab);
        return;
      }
      commitTab(tab);
    },
    [activeTab, dirtyLabel, commitTab],
  );

  useEffect(() => {
    const handlePopState = () => {
      const requested = new URLSearchParams(window.location.search).get("tab");
      const target =
        requested && visibleTabs.some((t) => t.id === requested)
          ? requested
          : isOwnerLike
            ? "shop"
            : "hours";
      if (target === activeTab) return;

      if (dirtyLabel) {
        window.history.pushState(null, "", `${window.location.pathname}?tab=${activeTab}`);
        const proceed = window.confirm(
          ot("settings.unsavedConfirm", { label: dirtyLabel }),
        );
        if (proceed) setSearchParams({ tab: target }, { replace: true });
        return;
      }
      setSearchParams({ tab: target }, { replace: true });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeTab, dirtyLabel, isOwnerLike, setSearchParams, visibleTabs]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = visibleTabs.findIndex((t) => t.id === activeTab);
    let nextIndex = index;
    if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = visibleTabs.length - 1;
    else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = (index + 1) % visibleTabs.length;
    } else {
      nextIndex = (index - 1 + visibleTabs.length) % visibleTabs.length;
    }
    const nextTab = visibleTabs[nextIndex];
    requestTab(nextTab.id);
    const node = tabListRef.current?.querySelector<HTMLButtonElement>(
      `#settings-tab-${nextTab.id}`,
    );
    node?.focus();
  };

  const validateShopFields = useCallback(() => {
    if (!shopSettings.salon_name.trim()) return ot("settings.vNameRequired");
    if (shopSettings.salon_name.trim().length > 255) return ot("settings.vNameTooLong");
    if (shopSettings.shop_phone && shopSettings.shop_phone.trim().length > 30) return ot("settings.vPhoneTooLong");
    if (shopSettings.shop_whatsapp && shopSettings.shop_whatsapp.trim().length > 30) return ot("settings.vWhatsappTooLong");
    if (shopSettings.address.trim().length > 500) return ot("settings.vAddressTooLong");
    if (shopSettings.google_maps_url) {
      const v = shopSettings.google_maps_url.trim();
      if (v && !/^https?:\/\//i.test(v)) return ot("settings.vMapUrl");
      if (v.length > 1000) return ot("settings.vMapTooLong");
    }
    if (shopSettings.receipt_footer && shopSettings.receipt_footer.length > 500) return ot("settings.vFooterTooLong");
    const tax = Number(shopSettings.tax_rate);
    if (
      shopSettings.tax_rate.trim() !== "" &&
      (!Number.isFinite(tax) || tax < 0 || tax > 100)
    )
      return t("pos:settings_tax.invalid");
    return null;
  }, [shopSettings, t]);

  const handleShopSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!settingsReady) {
      toast.error(ot("settings.notLoaded"));
      return;
    }
    const validationError = validateShopFields();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setLoading(true);
    setShopSaveErrors([]);
    setShopConflict(null);

    try {
      const payload: Record<string, unknown> = {
        salonName: shopSettings.salon_name.trim(),
        shopPhone: shopSettings.shop_phone.trim() || null,
        shopWhatsApp: shopSettings.shop_whatsapp.trim() || null,
        address: shopSettings.address.trim() || null,
        logoUrl: shopSettings.logo_url || shopSettings.logoUrl || null,
        googleMapsUrl: shopSettings.google_maps_url.trim() || shopSettings.googleMapsUrl.trim() || null,
        receiptFooter: shopSettings.receipt_footer.trim() || null,
        currency: shopSettings.currency.trim() || "EGP",
        // 0 disables the tax line on invoices entirely.
        taxRate: Number(shopSettings.tax_rate || 0),
      };
      if (settingsVersion) payload.expectedVersion = settingsVersion;

      const res = await api.put("/business-settings", payload);
      const updated = (adaptObject(res, {}) || {}) as Record<string, unknown>;
      const normalized = normalizeShopSettings(updated, {}) as Record<string, string>;
      setShopSettings((prev) => ({ ...prev, ...normalized }));
      setShopInitial({ ...normalized });
      setSettingsVersion(Number(updated.version) || settingsVersion);
      setPublicSiteStale(Boolean(updated.publicSiteStale));

      toast.success(ot("settings.saved"));
    } catch (err: unknown) {
      if (isConflict(err)) {
        const [line] = toErrorLines(err, ot("settings.conflictFallback"));
        setShopConflict(line?.message ?? ot("settings.conflictFallback"));
        toast.error(ot("settings.conflictToast"));
        return;
      }
      const lines = toErrorLines(err, ot("settings.saveFailedFallback"));
      setShopSaveErrors(lines);
      toast.error(errorHeadline(lines, ot("settings.saveFailedFallback")));
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await api.post("/business-settings/publish-site");
      const updated = (adaptObject(res, {}) || {}) as Record<string, unknown>;
      setPublicSiteStale(Boolean(updated.publicSiteStale));
      setSettingsVersion(Number(updated.version) || settingsVersion);
      toast.success(ot("settings.published"));
    } catch {
      toast.error(ot("settings.publishFailed"));
    } finally {
      setPublishing(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!settingsReady || loading || logoUploading) return;
    setLoading(true);
    try {
      const res = await api.put("/business-settings", { logoUrl: "" });
      const updated = adaptObject(res, {}) || {};
      const normalized = normalizeShopSettings(updated, {}) as Record<string, string>;
      setShopSettings((prev) => ({ ...prev, ...normalized, logo_url: "", logoUrl: "" }));
      setShopInitial((prev) => (prev ? { ...prev, logo_url: "", logoUrl: "", google_maps_url: normalized.google_maps_url ?? prev.google_maps_url, googleMapsUrl: normalized.googleMapsUrl ?? prev.googleMapsUrl } : prev));
      toast.success(ot("settings.logoRemoved"));
    } catch {
      toast.error(ot("settings.logoRemoveFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (activeTab === "shop" && initialLoading)
    return (
      <div className="erp-page-container space-y-6 pb-24">
        <PageHeader
          title={isOwnerLike ? ot("settings.settingsTitle") : ot("settings.tabHours")}
          subtitle={ot("settings.loadingSubtitle")}
          badge={isOwnerLike ? ot("settings.fullBadge") : ot("settings.managerBadge")}
          icon={SettingsIcon}
          className={undefined}
          actions={undefined}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </div>
        <SkeletonCard variant="content" />
      </div>
    );

  if (activeTab === "shop" && loadError)
    return (
      <div className="erp-page-container space-y-6 pb-24">
        <PageHeader
          title={isOwnerLike ? ot("settings.settingsTitle") : ot("settings.tabHours")}
          subtitle={ot("settings.settingsSubtitle")}
          badge={isOwnerLike ? ot("settings.fullBadge") : ot("settings.managerBadge")}
          icon={SettingsIcon}
          className={undefined}
          actions={undefined}
        />
        <PremiumCard className="border-dashed">
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <p className="text-lg font-black text-main">{ot("settings.loadErrorTitle")}</p>
            <p className="max-w-md text-sm font-bold text-muted">{loadError}</p>
            <Button onClick={fetchData} loading={loading}>
              <Activity size={16} /> {ot("settings.retry")}
            </Button>
          </div>
        </PremiumCard>
      </div>
    );

  return (
    <div className="erp-page-container space-y-10 pb-24">
      <PageHeader
        title={isOwnerLike ? ot("settings.settingsTitle") : ot("settings.tabHours")}
        subtitle={
          isOwnerLike
            ? ot("settings.settingsSubtitle")
            : ot("settings.managerSubtitle")
        }
        badge={isOwnerLike ? ot("settings.fullBadge") : ot("settings.managerBadge")}
        icon={SettingsIcon}
        className={undefined}
        actions={
          <Badge
            variant="primary"
            className="h-10 rounded-xl px-5 text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border-none shadow-sm"
          >
            <ShieldCheck size={16} className="ms-2" strokeWidth={2.5} />{" "}
            {isOwnerLike ? ot("settings.ownerAccess") : ot("settings.managerAccess")}
          </Badge>
        }
      />
      {!isOwnerLike && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3 text-[11px] font-black text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <Clock size={16} className="shrink-0" />
          {ot("settings.managerOnlyNote")}
        </div>
      )}

      {isOwnerLike && publicSiteStale && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/30"
        >
          <Globe size={16} className="shrink-0 text-sky-700 dark:text-sky-300" />
          <p className="flex-1 text-[11px] font-black leading-relaxed text-sky-900 dark:text-sky-200">
            {ot("settings.staleNote")}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePublish}
            loading={publishing}
            className="h-8 shrink-0 rounded-xl px-4 text-[11px] font-black"
          >
            <Upload size={13} className="ms-1" /> {ot("settings.publishNow")}
          </Button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Advanced Settings Navigation Sidebar */}
        <aside className="w-full lg:w-[320px] shrink-0">
          <div
            ref={tabListRef}
            role="tablist"
            aria-label={ot("settings.tabsAria")}
            aria-orientation="vertical"
            className="sticky top-24 space-y-2 flex lg:flex-col overflow-x-auto pb-4 lg:pb-0 no-scrollbar snap-x snap-mandatory bg-card/40 lg:bg-transparent p-2 rounded-2xl border border-border/40 lg:border-none lg:p-0"
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`settings-tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  aria-controls={`settings-panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onKeyDown={handleTabKeyDown}
                  onClick={() => requestTab(tab.id)}
                  className={cn(
                    "relative flex items-center justify-between min-w-[180px] lg:min-w-full px-5 py-4 rounded-2xl transition-all duration-300 group snap-start",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "bg-primary text-white shadow-premium scale-[1.02] z-10"
                      : "bg-card text-muted hover:bg-soft hover:text-primary border border-border/40 lg:border-transparent",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                        isActive
                          ? "bg-white/20"
                          : "bg-soft group-hover:bg-primary/10",
                      )}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className="text-[11px] font-black tracking-wide whitespace-nowrap">
                      {ot(tab.key)}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "h-6 w-6 rounded-lg flex items-center justify-center transition-all",
                      isActive
                        ? "bg-white/20 rotate-180"
                        : "opacity-0 -translate-x-2",
                    )}
                  >
                    <ChevronRight size={14} strokeWidth={3} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="hidden lg:block mt-12">
            <PremiumCard
              className="bg-gradient-to-br from-primary/5 to-transparent border-dashed overflow-hidden relative"
              hoverable={false}
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12">
                <ShieldCheck size={80} />
              </div>
              <div className="flex items-center gap-3 mb-4 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                <Zap size={16} strokeWidth={3} className="animate-pulse" />{" "}
                {ot("settings.dataProtection")}
              </div>
              <p className="text-[11px] font-bold text-muted leading-relaxed relative z-10">
                {ot("settings.dataProtectionText")}
              </p>
            </PremiumCard>
          </div>
        </aside>

        {/* Dynamic Content Workspace */}
        <main
          role="tabpanel"
          id={`settings-panel-${activeTab}`}
          aria-labelledby={`settings-tab-${activeTab}`}
          tabIndex={-1}
          className="flex-1 min-w-0 focus-visible:outline-none"
        >
          <AnimatePresence>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {activeTab === "shop" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <ContentPanel
                    title={ot("settings.identityTitle")}
                    subtitle={ot("settings.identitySubtitle")}
                    actions={
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={shopCompleteness.done === shopCompleteness.total ? "success" : "secondary"}
                          className="rounded-full px-3 py-1 text-[10px] font-black tabular-nums"
                        >
                          {ot("settings.complete", { done: shopCompleteness.done, total: shopCompleteness.total })}
                        </Badge>
                        {shopIsDirty && (
                          <Badge variant="warning" className="rounded-full px-3 py-1 text-[10px] font-black">
                            {ot("settings.unsavedBadge")}
                          </Badge>
                        )}
                        <Button
                          onClick={handleShopSubmit}
                          loading={loading}
                          disabled={!settingsReady || logoUploading}
                          className="h-9 rounded-xl px-5 text-xs font-black hidden sm:inline-flex"
                        >
                          {ot("settings.save")}
                        </Button>
                      </div>
                    }
                    className="overflow-hidden"
                  >
                    {shopConflict && (
                      <div
                        role="alert"
                        className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30"
                      >
                        <div className="flex items-center gap-2 text-[11px] font-black text-amber-800 dark:text-amber-200">
                          <ShieldCheck size={16} className="shrink-0" />
                          {shopConflict}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchData}
                          className="h-8 self-start rounded-xl border-amber-300 px-3 text-[11px] font-black text-amber-800 dark:border-amber-700 dark:text-amber-200"
                        >
                          <Activity size={13} className="ms-1" /> {ot("settings.fetchLatest")}
                        </Button>
                      </div>
                    )}

                    {shopSaveErrors.length > 0 && (
                      <div
                        role="alert"
                        className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/30"
                      >
                        <p className="flex items-center gap-2 text-[11px] font-black text-rose-700 dark:text-rose-300">
                          <ShieldCheck size={16} className="shrink-0" />
                          {shopSaveErrors.length === 1
                            ? ot("settings.saveFailedOne")
                            : ot("settings.saveFailedMany", { count: shopSaveErrors.length })}
                        </p>
                        <ul className="mt-2 space-y-1 pe-4">
                          {shopSaveErrors.map((line, index) => (
                            <li
                              key={`${line.field ?? "err"}-${index}`}
                              className="text-[11px] font-bold text-rose-700/90 dark:text-rose-300/90"
                            >
                              {line.field ? (
                                <span className="font-black">{line.field}: </span>
                              ) : null}
                              {line.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
                      {/* Logo + receipt preview */}
                      <div className="space-y-4">
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.add("border-primary", "bg-primary-soft");
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove("border-primary", "bg-primary-soft");
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove("border-primary", "bg-primary-soft");
                            const f = e.dataTransfer.files?.[0];
                            if (f) void uploadLogoFile(f);
                          }}
                          className="rounded-2xl border-2 border-dashed border-border bg-soft/30 p-5 flex flex-col items-center gap-4 text-center transition-colors"
                        >
                          <div className="h-24 w-24 rounded-2xl bg-card border border-border flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                            {getLogoPreviewUrl() ? (
                              <img
                                src={getLogoPreviewUrl() ?? ""}
                                className="h-full w-full object-contain p-2"
                                alt={ot("settings.logoAlt")}
                              />
                            ) : (
                              <ImageIcon className="text-muted/30 w-10 h-10" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-black text-main">{ot("settings.logoTitle")}</p>
                            <p className="text-[11px] font-bold leading-relaxed text-muted">
                              {ot("settings.logoHint")}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                            <label
                              className={cn(
                                "h-9 px-5 rounded-xl bg-primary text-white font-black text-xs flex items-center gap-2 cursor-pointer hover:shadow-md transition-all active:scale-95",
                                logoUploading && "opacity-60 pointer-events-none",
                              )}
                            >
                              <Upload size={14} strokeWidth={2.5} />
                              {logoUploading ? ot("settings.uploading") : ot("settings.uploadLogo")}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                disabled={logoUploading}
                              />
                            </label>
                            {getLogoPreviewUrl() && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleLogoRemove}
                                loading={loading}
                                disabled={!settingsReady || logoUploading}
                                className="h-9 rounded-xl text-rose-600 hover:bg-rose-50 border-rose-200 font-black text-xs dark:text-rose-400 dark:hover:bg-rose-950/40 dark:border-rose-900"
                              >
                                {ot("settings.remove")}
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Receipt preview */}
                        <div className="rounded-2xl border border-border bg-card overflow-hidden">
                          <div className="px-4 py-3 border-b border-border/60 bg-soft/40 flex items-center gap-2">
                            <Receipt size={14} className="text-muted" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                              {ot("settings.receiptPreview")}
                            </span>
                            <span className="me-auto text-[10px] font-bold text-muted">{ot("settings.live")}</span>
                          </div>
                          <div className="p-4 flex flex-col items-center gap-2 text-center">
                            {getLogoPreviewUrl() ? (
                              <img
                                src={getLogoPreviewUrl() ?? ""}
                                alt=""
                                className="h-10 w-10 object-contain rounded-lg border border-border bg-card p-1"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg border border-dashed border-border bg-soft flex items-center justify-center">
                                <Store size={16} className="text-muted/40" />
                              </div>
                            )}
                            <p className="text-sm font-black text-main leading-tight truncate max-w-full">
                              {shopSettings.salon_name.trim() || ot("settings.shopNameFallback")}
                            </p>
                            <p className="text-[11px] font-bold text-muted tabular-nums leading-relaxed">
                              {[shopSettings.shop_phone.trim(), shopSettings.shop_whatsapp.trim()].filter(Boolean).join(" • ") || ot("settings.contactFallback")}
                              {shopSettings.address.trim() ? ` • ${shopSettings.address.trim()}` : ""}
                            </p>
                            {shopSettings.google_maps_url.trim() && (
                              <a
                                href={shopSettings.google_maps_url.trim()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-black text-primary hover:underline"
                              >
                                <MapPin size={12} /> {ot("settings.openMap")} <ExternalLink size={10} />
                              </a>
                            )}
                            <div className="w-full border-t border-dashed border-border my-1" />
                            <p className="text-[11px] font-bold leading-relaxed text-muted whitespace-pre-wrap break-words max-w-full">
                              {shopSettings.receipt_footer.trim() || ot("settings.footerFallback")}
                            </p>
                            <p className="text-[10px] font-bold text-muted/60">{ot("settings.currencyLine", { code: shopSettings.currency || "EGP" })}</p>
                            {Number(shopSettings.tax_rate || 0) > 0 && (
                              <p className="text-[10px] font-bold text-muted/60">
                                {t("pos:settings_tax.preview_tax", {
                                  rate: Number(shopSettings.tax_rate),
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Form */}
                      <div className="space-y-5 min-w-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label htmlFor="settings-salon-name" className="text-[10px] font-black text-muted uppercase tracking-widest me-1 flex items-center gap-1.5">
                              <Store size={11} /> {ot("settings.tradeName")} <span className="text-danger">*</span>
                            </label>
                            <Input
                              id="settings-salon-name"
                              value={shopSettings.salon_name}
                              onChange={(e) => setShopSettings({ ...shopSettings, salon_name: e.target.value })}
                              maxLength={255}
                              placeholder={ot("settings.salonNamePlaceholder")}
                              className="h-11 rounded-xl bg-soft border-border/60 font-bold px-4 focus:bg-card transition-all"
                            />
                            <p className="text-[10px] font-bold text-muted me-1 tabular-nums">
                              {shopSettings.salon_name.length}/255
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <label htmlFor="settings-shop-phone" className="text-[10px] font-black text-muted uppercase tracking-widest me-1 flex items-center gap-1.5">
                              <Bell size={11} /> {ot("settings.contactLabel")}
                            </label>
                            <Input
                              id="settings-shop-phone"
                              value={shopSettings.shop_phone}
                              onChange={(e) => setShopSettings({ ...shopSettings, shop_phone: e.target.value })}
                              maxLength={30}
                              inputMode="tel"
                              placeholder={ot("settings.phonePlaceholder")}
                              className="h-11 rounded-xl bg-soft border-border/60 font-bold px-4 focus:bg-card transition-all"
                              dir="ltr"
                            />
                            <p className="text-[10px] font-bold text-muted me-1">{ot("settings.thermalHint")}</p>
                          </div>
                          <div className="space-y-1.5">
                            <label htmlFor="settings-shop-whatsapp" className="text-[10px] font-black text-muted uppercase tracking-widest me-1 flex items-center gap-1.5">
                              <MessageCircle size={11} /> {ot("settings.whatsappLabel")}
                            </label>
                            <Input
                              id="settings-shop-whatsapp"
                              value={shopSettings.shop_whatsapp}
                              onChange={(e) => setShopSettings({ ...shopSettings, shop_whatsapp: e.target.value })}
                              maxLength={30}
                              inputMode="tel"
                              placeholder={ot("settings.whatsappPlaceholder")}
                              className="h-11 rounded-xl bg-soft border-border/60 font-bold px-4 focus:bg-card transition-all"
                              dir="ltr"
                            />
                            <p className="text-[10px] font-bold text-muted me-1">{ot("settings.bookingHint")}</p>
                          </div>
                          <div className="space-y-1.5">
                            <label htmlFor="settings-currency" className="text-[10px] font-black text-muted uppercase tracking-widest me-1 flex items-center gap-1.5">
                              <Coins size={11} /> {ot("settings.currencyLabel")}
                            </label>
                            <Select
                              value={shopSettings.currency || "EGP"}
                              onValueChange={(v) => setShopSettings({ ...shopSettings, currency: v })}
                            >
                              <SelectTrigger id="settings-currency" className="h-11 rounded-xl bg-soft border-border/60 font-bold">
                                <SelectValue placeholder={ot("settings.currencyPlaceholder")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="EGP">{ot("settings.curEGP")}</SelectItem>
                                <SelectItem value="SAR">{ot("settings.curSAR")}</SelectItem>
                                <SelectItem value="USD">{ot("settings.curUSD")}</SelectItem>
                                <SelectItem value="AED">{ot("settings.curAED")}</SelectItem>
                                {/* The fifth entry used to be a currency
                                    symbol as its value, identical to the EGP
                                    entry above it, which no formatter understood.
                                    The codes above are the contract. */}
                              </SelectContent>
                            </Select>
                            <p className="text-[10px] font-bold text-muted me-1">{ot("settings.invoicesReportsHint")}</p>
                          </div>
                          <div className="space-y-1.5">
                            <label htmlFor="settings-tax-rate" className="text-[10px] font-black text-muted uppercase tracking-widest me-1 flex items-center gap-1.5">
                              <Percent size={11} /> {t("pos:settings_tax.label")}
                            </label>
                            <div className="relative">
                              <Input
                                id="settings-tax-rate"
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                inputMode="decimal"
                                value={shopSettings.tax_rate}
                                onChange={(e) => setShopSettings({ ...shopSettings, tax_rate: e.target.value })}
                                placeholder="0"
                                aria-label={t("pos:settings_tax.aria")}
                                className="h-11 rounded-xl bg-soft border-border/60 font-bold ps-4 pe-9 focus:bg-card transition-all"
                                dir="ltr"
                              />
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted">%</span>
                            </div>
                            <p className="text-[10px] font-bold text-muted me-1">
                              {t("pos:settings_tax.help")}
                            </p>
                          </div>
                          {/* Cashier discount limit — read-only reference. Values come from
                              the owner's back-office config; this POS view only surfaces them. */}
                          <div className="space-y-1.5">
                            <label
                              htmlFor="settings-cashier-discount-limit"
                              className="text-[10px] font-black text-muted uppercase tracking-widest me-1 flex items-center gap-1.5"
                            >
                              <Percent size={11} />
                              {t("pos:settings_tax.cashier_discount_limit")}
                            </label>
                            <div
                              id="settings-cashier-discount-limit"
                              className="flex items-center gap-2 bg-soft border border-border/60 rounded-lg h-11 px-3 font-bold text-muted"
                            >
                              {shopSettings.cashier_discount_limit_type === "percent"
                                ? t("pos:logic.discount_limit_percent", {
                                    value: shopSettings.cashier_discount_limit_value,
                                  })
                                : `${shopSettings.cashier_discount_limit_value} ${
                                    shopSettings.currency || "EGP"
                                  }`}
                            </div>
                            <p className="text-[10px] font-bold text-muted me-1">
                              {t("pos:settings_tax.cashier_discount_limit_help")}
                            </p>
                          </div>
                          {/* Monthly sales target — read-only reference. */}
                          <div className="space-y-1.5">
                            <label
                              htmlFor="settings-monthly-sales-target"
                              className="text-[10px] font-black text-muted uppercase tracking-widest me-1 flex items-center gap-1.5"
                            >
                              <Target size={11} />
                              {t("pos:settings_tax.monthly_sales_target")}
                            </label>
                            <div
                              id="settings-monthly-sales-target"
                              className="flex items-center gap-2 bg-soft border border-border/60 rounded-lg h-11 px-3 font-bold text-muted"
                            >
                              {Number(shopSettings.monthly_revenue_target || 0) > 0
                                ? `${Number(
                                    shopSettings.monthly_revenue_target,
                                  ).toLocaleString(undefined, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })} ${
                                    shopSettings.currency || "EGP"
                                  }`
                                : "—"}
                            </div>
                            <p className="text-[10px] font-bold text-muted me-1">
                              {t("pos:settings_tax.monthly_sales_target_help")}
                            </p>
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <label htmlFor="settings-address" className="text-[10px] font-black text-muted uppercase tracking-widest me-1 flex items-center gap-1.5">
                              <MapPin size={11} /> {ot("settings.addressLabel")}
                            </label>
                            <Input
                              id="settings-address"
                              value={shopSettings.address}
                              onChange={(e) => setShopSettings({ ...shopSettings, address: e.target.value })}
                              maxLength={500}
                              placeholder={ot("settings.addressPlaceholder")}
                              className="h-11 rounded-xl bg-soft border-border/60 font-bold px-4 focus:bg-card transition-all"
                            />
                            <p className="text-[10px] font-bold text-muted me-1 tabular-nums">{shopSettings.address.length}/500</p>
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <label htmlFor="settings-maps-url" className="text-[10px] font-black text-muted uppercase tracking-widest me-1 flex items-center gap-1.5">
                              <Globe size={11} /> {ot("settings.mapsLabel")}
                            </label>
                            <div className="flex gap-2">
                              <Input
                                id="settings-maps-url"
                                value={shopSettings.google_maps_url}
                                onChange={(e) => setShopSettings({ ...shopSettings, google_maps_url: e.target.value, googleMapsUrl: e.target.value })}
                                maxLength={1000}
                                placeholder={ot("settings.mapsPlaceholder")}
                                className="h-11 flex-1 rounded-xl bg-soft border-border/60 font-bold px-4 focus:bg-card transition-all"
                                dir="ltr"
                              />
                              {shopSettings.google_maps_url.trim() && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-11 w-11 rounded-xl shrink-0"
                                  onClick={() => window.open(shopSettings.google_maps_url.trim(), "_blank", "noopener,noreferrer")}
                                  title={ot("settings.openMapTitle")}
                                  aria-label={ot("settings.openMapAria")}
                                >
                                  <ExternalLink size={16} />
                                </Button>
                              )}
                            </div>
                            <p className="text-[10px] font-bold text-muted me-1">{ot("settings.mapButtonHint")}</p>
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <label htmlFor="settings-receipt-footer" className="text-[10px] font-black text-muted uppercase tracking-widest me-1 flex items-center gap-1.5">
                              <Receipt size={11} /> {ot("settings.footerLabel")}
                            </label>
                            <Textarea
                              id="settings-receipt-footer"
                              value={shopSettings.receipt_footer}
                              onChange={(e) => setShopSettings({ ...shopSettings, receipt_footer: e.target.value })}
                              maxLength={500}
                              rows={3}
                              placeholder={ot("settings.footerPlaceholder")}
                              className="rounded-xl bg-soft border-border/60 font-bold"
                            />
                            <p className="text-[10px] font-bold text-muted me-1 tabular-nums">
                              {ot("settings.footerCounter", { count: shopSettings.receipt_footer.length })}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-primary/10 bg-primary-soft/40 p-4 flex gap-3">
                          <div className="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                            <Store size={14} />
                          </div>
                          <p className="text-xs font-bold leading-relaxed text-muted">
                            {ot("settings.autoApplyText")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </ContentPanel>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-muted hidden sm:inline">
                      {shopIsDirty ? ot("settings.unsavedChanges") : ot("settings.savedState")}
                    </span>
                    <div className="flex gap-2 me-auto">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (shopInitial) setShopSettings((prev) => ({ ...prev, ...(shopInitial as any) }));
                        }}
                        disabled={!shopIsDirty || loading || logoUploading}
                        className="h-11 rounded-xl px-6 text-xs font-black"
                      >
                        {ot("settings.revert")}
                      </Button>
                      <Button
                        onClick={handleShopSubmit}
                        loading={loading}
                        disabled={!settingsReady || logoUploading}
                        className="h-11 rounded-xl px-8 text-xs font-black"
                      >
                        {ot("settings.saveShop")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "hours" && (
        <WorkingHoursPanel
          onDirtyChange={setHoursDirty}
          onVersionChange={setSettingsVersion}
        />
      )}
              {activeTab === "services" && <ServicesManagement hideHeader />}
              {activeTab === "website" && <BusinessSettingsPage />}
              {activeTab === "loyalty" && <LoyaltySettingsPanel />}
              {activeTab === "users" && <UsersPanel />}
              {activeTab === "security" && <SecurityAccess />}

              {(activeTab === "profile" || activeTab === "preferences") && (
                <ContentPanel
                  title={ot("settings.movedTitle")}
                  subtitle={ot("settings.movedSubtitle")}
                >
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-2">
                    <p className="text-sm font-bold text-muted flex-1">
                      {ot("settings.movedText")}{" "}
                      <span dir="ltr" className="font-mono text-xs bg-soft border rounded px-2 py-1">
                        /settings
                      </span>{" "}
                    </p>
                    <Button
                      onClick={() =>
                        (window.location.href =
                          activeTab === "profile" ? "/settings?tab=profile" : "/settings?tab=preferences")
                      }
                      className="h-11 rounded-xl px-6 text-xs font-black shrink-0"
                    >
                      {ot("settings.openMyAccount")}
                    </Button>
                  </div>
                </ContentPanel>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <ConfirmDialog
        open={Boolean(pendingTab)}
        onOpenChange={(open) => !open && setPendingTab(null)}
        title={ot("settings.unsavedTitle")}
        description={ot("settings.unsavedDesc", { label: dirtyLabel ?? ot("settings.thisSection") })}
        confirmText={ot("settings.continueWithoutSaving")}
        cancelText={ot("settings.goBack")}
        variant="danger"
        onConfirm={() => pendingTab && commitTab(pendingTab)}
      />
    </div>
  );
};

export default Settings;