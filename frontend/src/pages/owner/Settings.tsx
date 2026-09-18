import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useMemo, useCallback } from "react";
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
} from "lucide-react";
import api, { staticURL } from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
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
});

const SETTINGS_TABS = [
  { id: "shop", label: "بيانات المنشأة", icon: Store },
  { id: "hours", label: "ساعات العمل", icon: Clock },
  { id: "services", label: "الخدمات والعروض", icon: Scissors },
  { id: "website", label: "الموقع العام", icon: Globe },
  { id: "loyalty", label: "نظام الولاء", icon: Trophy },
  { id: "users", label: "إدارة المستخدمين", icon: Users },
  { id: "security", label: "الأمان والوصول", icon: Lock },
];

const Settings = () => {
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
        toast.error("صيغة اللوجو غير مدعومة. الصيغ المسموحة: JPG, JPEG, PNG, WEBP");
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
        toast.success("تم رفع لوجو المحل بنجاح");
      } catch {
        toast.error("فشل رفع لوجو المحل");
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
      const settingsData = adaptObject(res, {}) || {};
      if (settingsData && Object.keys(settingsData).length) {
        const normalized = normalizeShopSettings(settingsData, {});
        setShopSettings((prev) => ({ ...prev, ...normalized }));
        setShopInitial({ ...normalized } as Record<string, string>);
        setSettingsReady(true);
      } else {
        setLoadError("تعذر تحميل بيانات المنشأة. تحقق من الاتصال ثم أعد المحاولة.");
      }
    } catch {
      setLoadError("تعذر تحميل بيانات الإعدادات. تحقق من الاتصال بالخادم ثم أعد المحاولة.");
      toast.error("فشل تحميل بيانات المنشأة");
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const setActiveTab = (tab: string) => {
    const leavingShop = shopIsDirty && activeTab === "shop" && tab !== "shop";
    const leavingHours = hoursDirty && activeTab === "hours" && tab !== "hours";
    if (leavingShop || leavingHours) {
      const label = leavingShop ? "بيانات المنشأة" : "ساعات العمل";
      const ok = window.confirm(`لديك تغييرات غير محفوظة في ${label}. هل تريد المتابعة بدون حفظ؟`);
      if (!ok) return;
    }
    setSearchParams({ tab });
  };

  const validateShopFields = useCallback(() => {
    if (!shopSettings.salon_name.trim()) return "المسمى التجاري مطلوب";
    if (shopSettings.salon_name.trim().length > 255) return "المسمى التجاري طويل جداً (255 حرف كحد أقصى)";
    if (shopSettings.shop_phone && shopSettings.shop_phone.trim().length > 30) return "رقم التواصل طويل جداً";
    if (shopSettings.shop_whatsapp && shopSettings.shop_whatsapp.trim().length > 30) return "رقم الواتساب طويل جداً";
    if (shopSettings.address.trim().length > 500) return "العنوان طويل جداً (500 حرف كحد أقصى)";
    if (shopSettings.google_maps_url) {
      const v = shopSettings.google_maps_url.trim();
      if (v && !/^https?:\/\//i.test(v)) return "رابط الخريطة يجب أن يبدأ بـ https://";
      if (v.length > 1000) return "رابط الخريطة طويل جداً";
    }
    if (shopSettings.receipt_footer && shopSettings.receipt_footer.length > 500) return "تذييل الإيصال طويل جداً (500 حرف كحد أقصى)";
    return null;
  }, [shopSettings]);

  const handleShopSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!settingsReady) {
      toast.error("بيانات المنشأة لم تُحمّل بعد — أعد تحميل الصفحة");
      return;
    }
    const validationError = validateShopFields();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setLoading(true);

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
      };

      const res = await api.put("/business-settings", payload);
      const updated = adaptObject(res, {}) || {};
      const normalized = normalizeShopSettings(updated, {}) as Record<string, string>;
      setShopSettings((prev) => ({ ...prev, ...normalized }));
      setShopInitial({ ...normalized });

      toast.success("تم حفظ بيانات المنشأة بنجاح");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        const msg = detail.map((d: any) => d.msg || d.message).filter(Boolean).join(" • ");
        toast.error(msg || "فشل حفظ بيانات المنشأة");
      } else if (typeof detail === "string" && detail) {
        toast.error(detail);
      } else {
        toast.error("فشل حفظ بيانات المنشأة");
      }
    } finally {
      setLoading(false);
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
      toast.success("تمت إزالة الشعار");
    } catch {
      toast.error("فشل إزالة الشعار");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading)
    return (
      <div className="erp-page-container space-y-6 pb-24">
        <PageHeader
          title={isOwnerLike ? "إعدادات المنشأة" : "ساعات العمل"}
          subtitle="جاري تحميل الإعدادات..."
          badge={isOwnerLike ? "لوحة التحكم الكاملة" : "وصول المدير"}
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

  if (loadError)
    return (
      <div className="erp-page-container space-y-6 pb-24">
        <PageHeader
          title={isOwnerLike ? "إعدادات المنشأة" : "ساعات العمل"}
          subtitle="إدارة الهوية الرقمية، الكوادر، السياسات المالية، وتفضيلات النظام."
          badge={isOwnerLike ? "لوحة التحكم الكاملة" : "وصول المدير"}
          icon={SettingsIcon}
          className={undefined}
          actions={undefined}
        />
        <PremiumCard className="border-dashed">
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <p className="text-lg font-black text-main">تعذر تحميل بيانات الإعدادات</p>
            <p className="max-w-md text-sm font-bold text-muted">{loadError}</p>
            <Button onClick={fetchData} loading={loading}>
              <Activity size={16} /> إعادة المحاولة
            </Button>
          </div>
        </PremiumCard>
      </div>
    );

  return (
    <div className="erp-page-container space-y-10 pb-24">
      <PageHeader
        title={isOwnerLike ? "إعدادات المنشأة" : "ساعات العمل"}
        subtitle={
          isOwnerLike
            ? "إدارة الهوية الرقمية، الكوادر، السياسات المالية، وتفضيلات النظام."
            : "إدارة بروتوكول ساعات التشغيل — الوصول المحدود للمدير."
        }
        badge={isOwnerLike ? "لوحة التحكم الكاملة" : "وصول المدير"}
        icon={SettingsIcon}
        className={undefined}
        actions={
          <Badge
            variant="primary"
            className="h-10 rounded-xl px-5 text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border-none shadow-sm"
          >
            <ShieldCheck size={16} className="ml-2" strokeWidth={2.5} />{" "}
            {isOwnerLike ? "صلاحيات وصول المالك" : "صلاحيات المدير — ساعات العمل فقط"}
          </Badge>
        }
      />
      {!isOwnerLike && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3 text-[11px] font-black text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <Clock size={16} className="shrink-0" />
          أنت تدخل كمدير — يمكنك تعديل ساعات العمل فقط. باقي الإعدادات متاحة للمالك.
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Advanced Settings Navigation Sidebar */}
        <aside className="w-full lg:w-[320px] shrink-0">
          <div
            role="tablist"
            aria-label="أقسام الإعدادات"
            className="sticky top-24 space-y-2 flex lg:flex-col overflow-x-auto pb-4 lg:pb-0 no-scrollbar snap-x snap-mandatory bg-card/40 lg:bg-transparent p-2 rounded-2xl border border-border/40 lg:border-none lg:p-0"
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-center justify-between min-w-[180px] lg:min-w-full px-5 py-4 rounded-2xl transition-all duration-300 group snap-start",
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
                      {tab.label}
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
                حماية البيانات
              </div>
              <p className="text-[11px] font-bold text-muted leading-relaxed relative z-10">
                يتم تأمين كافة التغييرات عبر بروتوكولات تشفير متقدمة، لضمان سرية
                بيانات منشأتك وعملائك.
              </p>
            </PremiumCard>
          </div>
        </aside>

        {/* Dynamic Content Workspace */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
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
                    title="الهوية الرقمية للمنشأة"
                    subtitle="اسم المحل والشعار وطرق التواصل — تُطبّق تلقائياً في الفواتير والتقارير والموقع العام."
                    actions={
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={shopCompleteness.done === shopCompleteness.total ? "success" : "secondary"}
                          className="rounded-full px-3 py-1 text-[10px] font-black tabular-nums"
                        >
                          {shopCompleteness.done}/{shopCompleteness.total} مكتمل
                        </Badge>
                        {shopIsDirty && (
                          <Badge variant="warning" className="rounded-full px-3 py-1 text-[10px] font-black">
                            غير محفوظ
                          </Badge>
                        )}
                        <Button
                          onClick={handleShopSubmit}
                          loading={loading}
                          disabled={!settingsReady || logoUploading}
                          className="h-9 rounded-xl px-5 text-xs font-black hidden sm:inline-flex"
                        >
                          حفظ
                        </Button>
                      </div>
                    }
                    className="overflow-hidden"
                  >
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
                                alt="شعار المنشأة"
                              />
                            ) : (
                              <ImageIcon className="text-muted/30 w-10 h-10" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-black text-main">شعار المنشأة</p>
                            <p className="text-[11px] font-bold leading-relaxed text-muted">
                              JPG / PNG / WEBP حتى 2MB — اسحب الملف هنا أو اختر من الجهاز. يظهر في الفواتير الحرارية والتقارير.
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
                              {logoUploading ? "جاري الرفع..." : "رفع شعار"}
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
                                إزالة
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Receipt preview */}
                        <div className="rounded-2xl border border-border bg-card overflow-hidden">
                          <div className="px-4 py-3 border-b border-border/60 bg-soft/40 flex items-center gap-2">
                            <Receipt size={14} className="text-muted" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                              معاينة الإيصال
                            </span>
                            <span className="mr-auto text-[10px] font-bold text-muted">حيّة</span>
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
                              {shopSettings.salon_name.trim() || "اسم المنشأة"}
                            </p>
                            <p className="text-[11px] font-bold text-muted tabular-nums leading-relaxed">
                              {[shopSettings.shop_phone.trim(), shopSettings.shop_whatsapp.trim()].filter(Boolean).join(" • ") || "رقم التواصل"}
                              {shopSettings.address.trim() ? ` • ${shopSettings.address.trim()}` : ""}
                            </p>
                            {shopSettings.google_maps_url.trim() && (
                              <a
                                href={shopSettings.google_maps_url.trim()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-black text-primary hover:underline"
                              >
                                <MapPin size={12} /> فتح الخريطة <ExternalLink size={10} />
                              </a>
                            )}
                            <div className="w-full border-t border-dashed border-border my-1" />
                            <p className="text-[11px] font-bold leading-relaxed text-muted whitespace-pre-wrap break-words max-w-full">
                              {shopSettings.receipt_footer.trim() || "تذييل الإيصال يظهر هنا — مثال: شكراً لزيارتكم"}
                            </p>
                            <p className="text-[10px] font-bold text-muted/60">العملة: {shopSettings.currency || "EGP"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Form */}
                      <div className="space-y-5 min-w-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label htmlFor="settings-salon-name" className="text-[10px] font-black text-muted uppercase tracking-widest mr-1 flex items-center gap-1.5">
                              <Store size={11} /> المسمى التجاري الرسمي <span className="text-danger">*</span>
                            </label>
                            <Input
                              id="settings-salon-name"
                              value={shopSettings.salon_name}
                              onChange={(e) => setShopSettings({ ...shopSettings, salon_name: e.target.value })}
                              maxLength={255}
                              placeholder="مثال: صالون الأناقة"
                              className="h-11 rounded-xl bg-soft border-border/60 font-bold px-4 focus:bg-card transition-all"
                            />
                            <p className="text-[10px] font-bold text-muted mr-1 tabular-nums">
                              {shopSettings.salon_name.length}/255
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <label htmlFor="settings-shop-phone" className="text-[10px] font-black text-muted uppercase tracking-widest mr-1 flex items-center gap-1.5">
                              <Bell size={11} /> رقم التواصل
                            </label>
                            <Input
                              id="settings-shop-phone"
                              value={shopSettings.shop_phone}
                              onChange={(e) => setShopSettings({ ...shopSettings, shop_phone: e.target.value })}
                              maxLength={30}
                              inputMode="tel"
                              placeholder="01xxxxxxxxx"
                              className="h-11 rounded-xl bg-soft border-border/60 font-bold px-4 focus:bg-card transition-all"
                              dir="ltr"
                            />
                            <p className="text-[10px] font-bold text-muted mr-1">يظهر في الفاتورة الحرارية</p>
                          </div>
                          <div className="space-y-1.5">
                            <label htmlFor="settings-shop-whatsapp" className="text-[10px] font-black text-muted uppercase tracking-widest mr-1 flex items-center gap-1.5">
                              <MessageCircle size={11} /> واتساب
                            </label>
                            <Input
                              id="settings-shop-whatsapp"
                              value={shopSettings.shop_whatsapp}
                              onChange={(e) => setShopSettings({ ...shopSettings, shop_whatsapp: e.target.value })}
                              maxLength={30}
                              inputMode="tel"
                              placeholder="01xxxxxxxxx — اختياري"
                              className="h-11 rounded-xl bg-soft border-border/60 font-bold px-4 focus:bg-card transition-all"
                              dir="ltr"
                            />
                            <p className="text-[10px] font-bold text-muted mr-1">للتواصل وروابط الحجز</p>
                          </div>
                          <div className="space-y-1.5">
                            <label htmlFor="settings-currency" className="text-[10px] font-black text-muted uppercase tracking-widest mr-1 flex items-center gap-1.5">
                              <Coins size={11} /> العملة
                            </label>
                            <Select
                              value={shopSettings.currency || "EGP"}
                              onValueChange={(v) => setShopSettings({ ...shopSettings, currency: v })}
                            >
                              <SelectTrigger id="settings-currency" className="h-11 rounded-xl bg-soft border-border/60 font-bold">
                                <SelectValue placeholder="العملة" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="EGP">جنيه مصري — EGP</SelectItem>
                                <SelectItem value="SAR">ريال سعودي — SAR</SelectItem>
                                <SelectItem value="USD">دولار — USD</SelectItem>
                                <SelectItem value="AED">درهم إماراتي — AED</SelectItem>
                                <SelectItem value="ج.م">ج.م</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <label htmlFor="settings-address" className="text-[10px] font-black text-muted uppercase tracking-widest mr-1 flex items-center gap-1.5">
                              <MapPin size={11} /> العنوان الجغرافي
                            </label>
                            <Input
                              id="settings-address"
                              value={shopSettings.address}
                              onChange={(e) => setShopSettings({ ...shopSettings, address: e.target.value })}
                              maxLength={500}
                              placeholder="المنطقة، الشارع، علامة مميزة"
                              className="h-11 rounded-xl bg-soft border-border/60 font-bold px-4 focus:bg-card transition-all"
                            />
                            <p className="text-[10px] font-bold text-muted mr-1 tabular-nums">{shopSettings.address.length}/500</p>
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <label htmlFor="settings-maps-url" className="text-[10px] font-black text-muted uppercase tracking-widest mr-1 flex items-center gap-1.5">
                              <Globe size={11} /> رابط الخريطة (Google Maps)
                            </label>
                            <div className="flex gap-2">
                              <Input
                                id="settings-maps-url"
                                value={shopSettings.google_maps_url}
                                onChange={(e) => setShopSettings({ ...shopSettings, google_maps_url: e.target.value, googleMapsUrl: e.target.value })}
                                maxLength={1000}
                                placeholder="https://maps.app.goo.gl/... — اختياري"
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
                                  title="فتح الخريطة"
                                  aria-label="فتح رابط الخريطة"
                                >
                                  <ExternalLink size={16} />
                                </Button>
                              )}
                            </div>
                            <p className="text-[10px] font-bold text-muted mr-1">يظهر زر الخريطة في الموقع العام — يجب أن يبدأ بـ https://</p>
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <label htmlFor="settings-receipt-footer" className="text-[10px] font-black text-muted uppercase tracking-widest mr-1 flex items-center gap-1.5">
                              <Receipt size={11} /> تذييل الإيصال
                            </label>
                            <Textarea
                              id="settings-receipt-footer"
                              value={shopSettings.receipt_footer}
                              onChange={(e) => setShopSettings({ ...shopSettings, receipt_footer: e.target.value })}
                              maxLength={500}
                              rows={3}
                              placeholder="مثال: شكراً لزيارتكم — نتطلع لخدمتكم مجدداً"
                              className="rounded-xl bg-soft border-border/60 font-bold"
                            />
                            <p className="text-[10px] font-bold text-muted mr-1 tabular-nums">
                              {shopSettings.receipt_footer.length}/500 — يظهر أسفل كل فاتورة
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-primary/10 bg-primary-soft/40 p-4 flex gap-3">
                          <div className="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                            <Store size={14} />
                          </div>
                          <p className="text-xs font-bold leading-relaxed text-muted">
                            هذه البيانات تُطبّق تلقائياً في <span className="text-main">الفواتير الحرارية</span> و
                            <span className="text-main"> التقارير</span> و<span className="text-main"> الموقع العام</span>.
                            عدّلها هنا مرة واحدة.
                          </p>
                        </div>
                      </div>
                    </div>
                  </ContentPanel>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-muted hidden sm:inline">
                      {shopIsDirty ? "لديك تغييرات غير محفوظة" : "محفوظ"}
                    </span>
                    <div className="flex gap-2 mr-auto">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (shopInitial) setShopSettings((prev) => ({ ...prev, ...(shopInitial as any) }));
                        }}
                        disabled={!shopIsDirty || loading || logoUploading}
                        className="h-11 rounded-xl px-6 text-xs font-black"
                      >
                        تراجع
                      </Button>
                      <Button
                        onClick={handleShopSubmit}
                        loading={loading}
                        disabled={!settingsReady || logoUploading}
                        className="h-11 rounded-xl px-8 text-xs font-black"
                      >
                        حفظ بيانات المنشأة
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "hours" && <WorkingHoursPanel onDirtyChange={setHoursDirty} />}
              {activeTab === "services" && <ServicesManagement hideHeader />}
              {activeTab === "website" && <BusinessSettingsPage />}
              {activeTab === "loyalty" && <LoyaltySettingsPanel />}
              {activeTab === "users" && <UsersPanel />}
              {activeTab === "security" && <SecurityAccess />}

              {(activeTab === "profile" || activeTab === "preferences") && (
                <ContentPanel
                  title="تم نقل هذا القسم"
                  subtitle="حسابك الشخصي وتفضيلات الواجهة الآن في صفحة موحدة لكل الأدوار."
                >
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-2">
                    <p className="text-sm font-bold text-muted flex-1">
                      انتقل إلى <span className="text-main font-black">حسابي</span> — نفس الرابط{" "}
                      <span dir="ltr" className="font-mono text-xs bg-soft border rounded px-2 py-1">
                        /settings
                      </span>{" "}
                      لكل المستخدمين.
                    </p>
                    <Button
                      onClick={() =>
                        (window.location.href =
                          activeTab === "profile" ? "/settings?tab=profile" : "/settings?tab=preferences")
                      }
                      className="h-11 rounded-xl px-6 text-xs font-black shrink-0"
                    >
                      فتح حسابي
                    </Button>
                  </div>
                </ContentPanel>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Settings;