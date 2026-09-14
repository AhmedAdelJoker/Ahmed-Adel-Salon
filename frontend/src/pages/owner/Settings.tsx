import { usePreferences } from "@/context/PreferencesContext";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Store,
  Users,
  User,
  Zap,
  Database,
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
  Palette,
  Moon,
  Sun,
} from "lucide-react";
import api, { staticURL } from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { safePositive, cn } from "@/lib/core/utils";
import { motion } from "framer-motion";
import {
  PageHeader,
  PremiumCard,
  ContentPanel,
} from "@/components/shared/PremiumUI";

// New Panel Components
import WorkingHoursPanel from "@/pages/owner/WorkingHoursPanel";
import ServicesManagement from "@/pages/owner/ServicesManagement";
import SecurityAccess from "@/pages/owner/SecurityAccess";
import FinancialRules from "@/pages/owner/FinancialRules";
import BusinessSettingsPage from "@/pages/owner/BusinessSettingsPage";
import UsersPanel from "@/pages/owner/UsersPanel";
import LoyaltySettingsPanel from "@/pages/owner/LoyaltySettingsPanel";

import { validateImageSize } from "@/lib/media/upload";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AnimatePresence } from "framer-motion";

 
const normalizeShopSettings = (data: Record<string, any> = {}, fallback: Record<string, any> = {}) => ({
  salon_name: data.salon_name ?? data.salonName ?? fallback.salon_name ?? "",
  shop_phone: data.shop_phone ?? data.shopPhone ?? fallback.shop_phone ?? "",
  shop_whatsapp:
    data.shop_whatsapp ?? data.shopWhatsApp ?? fallback.shop_whatsapp ?? "",
  address: data.address ?? fallback.address ?? "",
  logo_url: data.logo_url ?? data.logoUrl ?? fallback.logo_url ?? "",
  logoUrl: data.logoUrl ?? data.logo_url ?? fallback.logoUrl ?? "",
  receipt_footer:
    data.receipt_footer ?? data.receiptFooter ?? fallback.receipt_footer ?? "",
  currency: data.currency ?? fallback.currency ?? "ج.م",
  cashier_discount_limit_value:
    data.cashier_discount_limit_value ??
    data.cashierDiscountLimitValue ??
    fallback.cashier_discount_limit_value ??
    10,
  manager_discount_limit_value:
    data.manager_discount_limit_value ??
    data.managerDiscountLimitValue ??
    fallback.manager_discount_limit_value ??
    50,
  allow_cash: data.allow_cash ?? data.allowCash ?? fallback.allow_cash ?? true,
  allow_vodafone_cash:
    data.allow_vodafone_cash ??
    data.allowVodafoneCash ??
    fallback.allow_vodafone_cash ??
    true,
  allow_instapay:
    data.allow_instapay ??
    data.allowInstapay ??
    fallback.allow_instapay ??
    true,
  allow_bank_card:
    data.allow_bank_card ??
    data.allowBankCard ??
    fallback.allow_bank_card ??
    true,
  monthly_revenue_target:
    data.monthly_revenue_target ??
    data.monthlyRevenueTarget ??
    fallback.monthly_revenue_target ??
    500000,
});

const SETTINGS_TABS = [
  { id: "shop", label: "بيانات المنشأة", icon: Store },
  { id: "hours", label: "ساعات العمل", icon: Clock },
  { id: "services", label: "الخدمات والعروض", icon: Scissors },
  { id: "website", label: "الموقع العام", icon: Globe },
  { id: "loyalty", label: "نظام الولاء", icon: Trophy },
  { id: "users", label: "إدارة المستخدمين", icon: Users },
  { id: "financial", label: "القواعد المالية", icon: Database },
  { id: "security", label: "الأمان والوصول", icon: Lock },
  { id: "profile", label: "حسابي الشخصي", icon: User },
  { id: "preferences", label: "تفضيلات الواجهة", icon: Palette },
];

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isOwnerLike = useMemo(() => {
    const role = String(user?.role || "").toUpperCase();
    return ["OWNER", "ADMIN"].includes(role);
  }, [user?.role]);

  const visibleTabs = useMemo(
    () => (isOwnerLike ? SETTINGS_TABS : SETTINGS_TABS.filter((t) => t.id === "hours")),
    [isOwnerLike],
  );

  const {
    preferences,
    updatePreferences,
    setTheme,
    setLanguage,
  } = usePreferences();

  const requestedTab = searchParams.get("tab");
  const activeTab = visibleTabs.some((tab) => tab.id === requestedTab)
    ? (requestedTab as string)
    : isOwnerLike
      ? "shop"
      : "hours";

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [profileData, setProfileData] = useState({
    fullName: "",
    username: "",
    email: "",
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [shopSettings, setShopSettings] = useState({
    salon_name: "",
    shop_phone: "",
    shop_whatsapp: "",
    address: "",
    logo_url: "",
    logoUrl: "",
    receipt_footer: "",
    currency: "ج.م",
    cashier_discount_limit_value: 10,
    manager_discount_limit_value: 50,
    allow_cash: true,
    allow_vodafone_cash: true,
    allow_instapay: true,
    allow_bank_card: true,
    monthly_revenue_target: 500000,
  });

  const getLogoPreviewUrl = () => {
    const logoPath = shopSettings.logo_url || shopSettings.logoUrl;
    if (!logoPath) return null;
    if (String(logoPath).startsWith("http")) return logoPath;
    return `${staticURL}${logoPath}`;
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !validateImageSize(file)) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      toast.error(
        "صيغة اللوجو غير مدعومة. الصيغ المسموحة: JPG, JPEG, PNG, WEBP",
      );
      event.target.value = "";
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/business-settings/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updated = adaptObject(res, {}) || {};
      setShopSettings((prev) => ({
        ...prev,
        ...normalizeShopSettings(updated, prev),
      }));
      toast.success("تم رفع لوجو المحل بنجاح");
    } catch (err) {
      toast.error("فشل رفع لوجو المحل");
    } finally {
      event.target.value = "";
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setInitialLoading(true);
        const [settingsRes, profileRes] = await Promise.all([
          api.get("/business-settings"),
          api.get("/profile"),
        ]);
        const settingsData = adaptObject(settingsRes, {}) || {};
        if (settingsData && Object.keys(settingsData).length)
          setShopSettings((prev) => ({
            ...prev,
            ...normalizeShopSettings(settingsData, prev),
          }));
        const profile = (adaptObject(profileRes, {}) || {}) as { full_name?: string; fullName?: string; username?: string; email?: string };
        if (profile && Object.keys(profile).length) {
          setProfileData((prev) => ({
            ...prev,
            fullName:
              profile.full_name || profile.fullName || profile.username || "",
            username: profile.username || "",
            email: profile.email || "",
          }));
        }
      } catch (err) {
        toast.error("فشل مزامنة تفضيلات وحدة التحكم");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchData();
  }, []);

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put("/profile", {
        full_name: profileData.fullName,
        email: profileData.email,
      });
      if (profileData.newPassword) {
        if (profileData.newPassword !== profileData.confirmPassword) {
          toast.error("كلمات المرور الجديدة غير متطابقتين");
          setLoading(false);
          return;
        }
        await api.post("/profile/change-password", {
          current_password: profileData.oldPassword,
          new_password: profileData.newPassword,
        });
      }
      toast.success("تم تحديث بيانات الهوية الأمنية");
    } catch (_err) {
      toast.error("فشل التحديث الأمني للهوية");
    } finally {
      setLoading(false);
    }
  };

  const handleShopSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        salonName: shopSettings.salon_name,
        shopPhone: shopSettings.shop_phone,
        shopWhatsApp: shopSettings.shop_whatsapp,
        address: shopSettings.address,
        logoUrl: shopSettings.logo_url || shopSettings.logoUrl,
        receiptFooter: shopSettings.receipt_footer,
        currency: shopSettings.currency,

        cashierDiscountLimitValue: safePositive(
          shopSettings.cashier_discount_limit_value,
        ),
        managerDiscountLimitValue: safePositive(
          shopSettings.manager_discount_limit_value,
        ),

        allowCash: shopSettings.allow_cash,
        allowVodafoneCash: shopSettings.allow_vodafone_cash,
        allowInstapay: shopSettings.allow_instapay,
        allowBankCard: shopSettings.allow_bank_card,
        monthlyRevenueTarget: safePositive(shopSettings.monthly_revenue_target) || 500000,
      };

      const res = await api.put("/business-settings", payload);
      const updated = adaptObject(res, {}) || {};

      setShopSettings((prev) => ({
        ...prev,
        ...normalizeShopSettings(updated, prev),
      }));

      toast.success("تم حفظ بيانات المنشأة بنجاح");
    } catch (err) {
      toast.error("فشل حفظ بيانات المنشأة");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-accent">
          <Activity className="w-10 h-10 animate-pulse" />
          <p className="text-muted font-bold text-sm">
            جاري مراجعة البروتوكولات...
          </p>
        </div>
      </div>
    );

  return (
    <div className="erp-page-container space-y-10 pb-24" dir="rtl">
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
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3 text-[11px] font-black text-amber-800">
          <Clock size={16} className="shrink-0" />
          أنت تدخل كمدير — يمكنك تعديل ساعات العمل فقط. باقي الإعدادات متاحة للمالك.
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Advanced Settings Navigation Sidebar */}
        <aside className="w-full lg:w-[320px] shrink-0">
          <div className="sticky top-24 space-y-2 flex lg:flex-col overflow-x-auto pb-4 lg:pb-0 no-scrollbar snap-x snap-mandatory bg-card/40 lg:bg-transparent p-2 rounded-2xl border border-border/40 lg:border-none lg:p-0">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
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
                    <span className="text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap">
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

                  {isActive && (
                    <motion.div
                      layoutId="active-settings-tab"
                      className="absolute inset-0 bg-primary rounded-2xl -z-10 shadow-lg shadow-primary/20"
                      initial={false}
                    />
                  )}
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
              {activeTab === "profile" && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <ContentPanel
                      title="الهوية الشخصية"
                      subtitle="إدارة بياناتك المهنية وطرق التواصل الرسمية."
                      actions={undefined}
                      className="h-full"
                    >
                      <div className="space-y-6">
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1 flex items-center gap-2">
                            <User size={12} /> الاسم الكامل للمسؤول
                          </label>
                          <Input
                            value={profileData.fullName}
                            onChange={(e) =>
                              setProfileData({
                                ...profileData,
                                fullName: e.target.value,
                              })
                            }
                            className="h-14 rounded-2xl bg-soft border-border/60 font-black px-6 focus:bg-card focus:ring-4 focus:ring-primary/5 transition-all"
                          />
                        </div>
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1 flex items-center gap-2">
                            <Globe size={12} /> معرف الدخول (Username)
                          </label>
                          <Input
                            value={profileData.username}
                            onChange={(e) =>
                              setProfileData({
                                ...profileData,
                                username: e.target.value,
                              })
                            }
                            className="h-14 rounded-2xl bg-soft border-border/60 font-black px-6 focus:bg-card focus:ring-4 focus:ring-primary/5 transition-all"
                            dir="ltr"
                          />
                        </div>
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1 flex items-center gap-2">
                            <Bell size={12} /> البريد الإلكتروني المعتمد
                          </label>
                          <Input
                            value={profileData.email}
                            onChange={(e) =>
                              setProfileData({
                                ...profileData,
                                email: e.target.value,
                              })
                            }
                            className="h-14 rounded-2xl bg-soft border-border/60 font-black px-6 focus:bg-card focus:ring-4 focus:ring-primary/5 transition-all"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </ContentPanel>

                    <ContentPanel
                      title="بوابة الأمان"
                      subtitle="تحديث معايير الوصول وكلمات المرور المشفرة."
                      actions={undefined}
                      className="h-full border-rose-500/10"
                    >
                      <div className="space-y-6">
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                            كلمة المرور الحالية
                          </label>
                          <Input
                            type="password"
                            placeholder="••••••••••••"
                            className="h-14 rounded-2xl bg-soft border-border/60 font-black px-6 focus:bg-card transition-all"
                          />
                        </div>
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                            كلمة المرور الجديدة
                          </label>
                          <Input
                            type="password"
                            className="h-14 rounded-2xl bg-soft border-border/60 font-black px-6 focus:bg-card transition-all"
                          />
                        </div>
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                            تأكيد كلمة المرور
                          </label>
                          <Input
                            type="password"
                            className="h-14 rounded-2xl bg-soft border-border/60 font-black px-6 focus:bg-card transition-all"
                          />
                        </div>
                      </div>
                    </ContentPanel>
                  </div>
                  <div className="flex justify-end pt-4 border-t border-border/40">
                    <Button
                      onClick={handleProfileSubmit}
                      loading={loading}
                      className="h-14 px-12 rounded-2xl font-black text-sm uppercase tracking-widest bg-primary shadow-premium hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      تأكيد وحفظ التغييرات الأمنية
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "shop" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <ContentPanel
                    title="الهوية الرقمية للمنشأة"
                    subtitle="إدارة العلامة التجارية، بيانات الاتصال، والعنوان الرسمي للمحل."
                    actions={undefined}
                    className="overflow-hidden"
                  >
                    <div className="relative z-10">
                      <div className="mb-12 p-8 rounded-[2.5rem] bg-soft/50 border-2 border-dashed border-border/60 relative group overflow-hidden">
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />

                        <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                          <div className="h-32 w-32 rounded-[2rem] bg-white dark:bg-black/40 border border-border flex items-center justify-center overflow-hidden shadow-premium group-hover:rotate-3 transition-transform duration-500">
                            {getLogoPreviewUrl() ? (
                              <img
                                src={getLogoPreviewUrl() ?? ""}
                                className="h-full w-full object-contain p-3"
                                alt="logo"
                              />
                            ) : (
                              <ImageIcon className="text-muted/20 w-12 h-12" />
                            )}
                          </div>
                          <div className="flex-1 text-center md:text-right space-y-3">
                            <h4 className="text-xl font-black text-main">
                              شعار المنشأة المعتمد
                            </h4>
                            <p className="text-xs font-bold text-muted leading-relaxed max-w-md">
                              سيظهر هذا الشعار كعلامة تجارية رسمية في كافة
                              التقارير، الفواتير الحرارية، وصفحة العميل العامة.
                            </p>
                            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-6">
                              <label className="h-12 px-8 rounded-xl bg-primary text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-3 cursor-pointer hover:shadow-premium hover:-translate-y-1 transition-all active:scale-95">
                                <Upload size={16} strokeWidth={3} /> رفع شعار
                                جديد
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={handleLogoUpload}
                                />
                              </label>
                              {shopSettings.logo_url && (
                                <Button
                                  variant="outline"
                                  className="h-12 px-6 rounded-xl text-rose-500 hover:bg-rose-50 border-rose-100 font-black text-[11px] uppercase tracking-widest"
                                >
                                  إزالة الشعار
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                            المسمى التجاري الرسمي
                          </label>
                          <Input
                            value={shopSettings.salon_name}
                            onChange={(e) =>
                              setShopSettings({
                                ...shopSettings,
                                salon_name: e.target.value,
                              })
                            }
                            className="h-16 rounded-[1.25rem] bg-soft border-border/60 text-lg font-black px-7 focus:bg-card focus:ring-4 focus:ring-primary/5 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                            رقم التواصل المعتمد
                          </label>
                          <Input
                            value={shopSettings.shop_phone}
                            onChange={(e) =>
                              setShopSettings({
                                ...shopSettings,
                                shop_phone: e.target.value,
                              })
                            }
                            className="h-16 rounded-[1.25rem] bg-soft border-border/60 text-lg font-black px-7 focus:bg-card focus:ring-4 focus:ring-primary/5 transition-all"
                            dir="ltr"
                          />
                        </div>
                        <div className="col-span-full space-y-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                            العنوان الجغرافي التفصيلي
                          </label>
                          <Input
                            value={shopSettings.address}
                            onChange={(e) =>
                              setShopSettings({
                                ...shopSettings,
                                address: e.target.value,
                              })
                            }
                            className="h-16 rounded-[1.25rem] bg-soft border-border/60 font-bold px-7 focus:bg-card focus:ring-4 focus:ring-primary/5 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                            الهدف الشهري للإيرادات (ج.م)
                          </label>
                          <Input
                            type="number"
                            min={1}
                            value={shopSettings.monthly_revenue_target}
                            onChange={(e) =>
                              setShopSettings({
                                ...shopSettings,
                                monthly_revenue_target: Number(e.target.value) || 0,
                              })
                            }
                            className="h-16 rounded-[1.25rem] bg-soft border-border/60 text-lg font-black px-7 tabular-nums focus:bg-card focus:ring-4 focus:ring-primary/5 transition-all"
                          />
                          <p className="text-[10px] font-bold text-muted">
                            يظهر في بطاقة الهدف بصفحة التحليلات المالية.
                          </p>
                        </div>
                      </div>
                    </div>
                  </ContentPanel>

                  <div className="flex justify-end pt-4 border-t border-border/40">
                    <Button
                      onClick={handleShopSubmit}
                      loading={loading}
                      className="h-16 px-16 rounded-2xl font-black text-lg uppercase tracking-widest bg-primary shadow-premium hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      حفظ السجل التجاري
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "hours" && <WorkingHoursPanel />}
              {activeTab === "services" && <ServicesManagement hideHeader />}
              {activeTab === "website" && <BusinessSettingsPage />}
              {activeTab === "loyalty" && <LoyaltySettingsPanel />}
              {activeTab === "users" && <UsersPanel />}
              {activeTab === "financial" && <FinancialRules />}
              {activeTab === "security" && <SecurityAccess />}

              {activeTab === "preferences" && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <PremiumCard className="p-8">
                    <div className="flex items-center gap-4 mb-8">
                      <Palette className="text-primary" size={24} />
                      <h3 className="text-sm font-black text-main uppercase">
                        المظهر واللغة
                      </h3>
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-6 rounded-2xl bg-soft/50 border border-border/40">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                            {preferences.theme === "dark" ? (
                              <Moon size={20} />
                            ) : (
                              <Sun size={20} />
                            )}
                          </div>
                          <span className="text-sm font-black">
                            الوضع المظلم
                          </span>
                        </div>
                        <Switch
                          checked={preferences.theme === "dark"}
                          onCheckedChange={(c) =>
                            setTheme(c ? "dark" : "light")
                          }
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted uppercase">
                          لغة الواجهة
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant={
                              preferences.language === "ar"
                                ? "primary"
                                : "outline"
                            }
                            className="h-12 rounded-xl font-black text-xs"
                            onClick={() => setLanguage("ar")}
                          >
                            العربية
                          </Button>
                          <Button
                            variant={
                              preferences.language === "en"
                                ? "primary"
                                : "outline"
                            }
                            className="h-12 rounded-xl font-black text-xs"
                            onClick={() => setLanguage("en")}
                          >
                            English
                          </Button>
                        </div>
                      </div>
                    </div>
                  </PremiumCard>

                  <PremiumCard className="p-8">
                    <div className="flex items-center gap-4 mb-8">
                      <Bell className="text-amber-500" size={24} />
                      <h3 className="text-sm font-black text-main uppercase">
                        مركز الإشعارات
                      </h3>
                    </div>
                    <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100 mb-6">
                      <p className="text-xs font-bold text-amber-700 leading-relaxed">
                        تفعيل الإشعارات يضمن وصول تنبيهات الورديات، طلبات
                        التعديل، والمواعيد الجديدة فوراً.
                      </p>
                    </div>
                    <div className="flex items-center justify-between p-6 rounded-2xl bg-soft/50 border border-border/40">
                      <span className="text-sm font-black">إشعارات النظام</span>
                      <Switch
                        checked={preferences.notifications_enabled}
                        onCheckedChange={(v) =>
                          updatePreferences({ notifications_enabled: v })
                        }
                      />
                    </div>
                  </PremiumCard>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Settings;