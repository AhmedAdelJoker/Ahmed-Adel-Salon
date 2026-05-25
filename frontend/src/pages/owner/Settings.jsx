import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Store,
  Users,
  User,
  Zap,
  Shield,
  Database,
  Lock,
  ChevronRight,
  ShieldCheck,
  Settings as SettingsIcon,
  Globe,
  Bell,
  CreditCard,
  Activity,
  Clock,
  Scissors,
  Image as ImageIcon,
  Upload,
  Palette,
  Moon,
  Sun,
  Languages,
} from "lucide-react";
import api from "../../services/api";
import { adaptObject } from "../../services/apiAdapter";
import { toast } from "react-hot-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { safePositive } from "../../lib/utils";
import { motion } from "framer-motion";

// New Panel Components
import WorkingHoursPanel from "./WorkingHoursPanel";
import ServicesManagement from "./ServicesManagement";
import SecurityAccess from "./SecurityAccess";
import FinancialRules from "./FinancialRules";
import BusinessSettingsPage from "./BusinessSettingsPage";
import UsersPanel from "./UsersPanel";

const STATIC_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api/v1", "")
  : import.meta.env.VITE_API_URL;

const normalizeShopSettings = (data = {}, fallback = {}) => ({
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
});

const SETTINGS_TABS = [
  { id: "shop", label: "بيانات المنشأة", icon: Store },
  { id: "hours", label: "ساعات العمل", icon: Clock },
  { id: "services", label: "الخدمات والعروض", icon: Scissors },
  { id: "website", label: "الموقع العام", icon: Globe },
  { id: "users", label: "إدارة المستخدمين", icon: Users },
  { id: "financial", label: "القواعد المالية", icon: Database },
  { id: "security", label: "الأمان والوصول", icon: Lock },
  { id: "profile", label: "حسابي الشخصي", icon: User },
  { id: "preferences", label: "تفضيلات الواجهة", icon: Palette },
];

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    preferences,
    updatePreferences,
    setTheme,
    setLanguage,
    saving: preferencesSaving,
  } = usePreferences();

  const requestedTab = searchParams.get("tab");
  const activeTab = SETTINGS_TABS.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : "shop";

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
    receipt_footer: "",
    currency: "ج.م",
    cashier_discount_limit_value: 10,
    manager_discount_limit_value: 50,
    allow_cash: true,
    allow_vodafone_cash: true,
    allow_instapay: true,
    allow_bank_card: true,
  });
  const [logoUploading, setLogoUploading] = useState(false);

  const getLogoPreviewUrl = () => {
    const logoPath = shopSettings.logo_url || shopSettings.logoUrl;
    if (!logoPath) return null;
    if (String(logoPath).startsWith("http")) return logoPath;
    return `${STATIC_URL}${logoPath}`;
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("حجم الصورة أكبر من الحد المسموح 20 ميجابايت");
      event.target.value = "";
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
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
      setLogoUploading(true);
      const res = await api.post("/business-settings/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updated = adaptObject(res, {});
      setShopSettings((prev) => ({
        ...prev,
        ...normalizeShopSettings(updated, prev),
      }));
      toast.success("تم رفع لوجو المحل بنجاح");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "فشل رفع لوجو المحل");
    } finally {
      setLogoUploading(false);
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
        const settingsData = adaptObject(settingsRes, {});
        if (settingsData && Object.keys(settingsData).length)
          setShopSettings((prev) => ({
            ...prev,
            ...normalizeShopSettings(settingsData, prev),
          }));
        const profile = adaptObject(profileRes, {});
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

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  const handleProfileSubmit = async (e) => {
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
    } catch (err) {
      toast.error(err.response?.data?.detail || "فشل التحديث الأمني للهوية");
    } finally {
      setLoading(false);
    }
  };

  const handleShopSubmit = async (e) => {
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
      };

      const res = await api.put("/business-settings", payload);
      const updated = adaptObject(res, {});

      setShopSettings((prev) => ({
        ...prev,
        ...normalizeShopSettings(updated, prev),
      }));

      toast.success("تم حفظ بيانات المنشأة بنجاح");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "فشل حفظ بيانات المنشأة");
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
    <div className="space-y-8 pb-24 erp-page-container" dir="rtl">
      {/* SaaS Executive Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center shadow-lg shadow-accent/20">
            <SettingsIcon className="text-white w-8 h-8" strokeWidth={2} />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-main uppercase tracking-tight leading-none">
              إعدادات المحل
            </h1>
            <p className="text-base font-medium text-muted">
              تخصيص بروتوكولات الأمان، الهوية المؤسسية، والمعايير التشغيلية
            </p>
          </div>
        </div>
        <Badge
          variant="accent"
          className="h-10 px-6 rounded-xl bg-accent shadow-sm shadow-accent/20 text-white font-black text-[10px] uppercase tracking-widest gap-3"
        >
          <ShieldCheck size={16} strokeWidth={2.5} /> صلاحيات الوصول الكاملة
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-10 pt-2">
        {/* Navigation Context Sidebar */}
        <aside className="space-y-2 shrink-0">
          {SETTINGS_TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              disabled={loading}
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-center justify-between rounded-xl px-7 py-5 transition-all duration-300 border ${
                activeTab === tab.id
                  ? "bg-[#1B1714] text-white border-[#1B1714] shadow-premium scale-[1.02]"
                  : "bg-card text-muted border-border/60 hover:border-accent/40 hover:text-accent"
              }`}
            >
              <div className="flex items-center gap-5">
                <tab.icon
                  size={20}
                  strokeWidth={activeTab === tab.id ? 2.5 : 1.5}
                  className={
                    activeTab === tab.id ? "text-accent" : "opacity-40"
                  }
                />
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-black uppercase tracking-widest">
                    {tab.label}
                  </span>
                  {tab.comingSoon ? (
                    <Badge
                      variant="outline"
                      className="h-5 px-2 rounded-md text-[8px] font-black text-muted/60 border-border bg-soft"
                    >
                      قريبًا
                    </Badge>
                  ) : null}
                </div>
              </div>
              <ChevronRight
                size={16}
                className={`transition-transform duration-300 ${activeTab === tab.id ? "rotate-180 text-accent opacity-100" : "opacity-0"}`}
              />
            </button>
          ))}

          <div className="mt-12 p-8 bg-accent-subtle/30 rounded-[28px] border border-accent/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl -mr-12 -mt-12" />
            <div className="flex items-center gap-3 mb-4 text-[10px] font-black text-accent uppercase tracking-widest relative z-10">
              <Zap size={16} strokeWidth={3} /> التزامن السحابي
            </div>
            <p className="text-[11px] font-bold text-muted leading-relaxed relative z-10">
              يتم تشفير وتأمين كافة التغييرات الجوهرية عبر بروتوكول TLS لضمان
              استمرارية العمليات الاستراتيجية.
            </p>
          </div>
        </aside>

        {/* Content Area Refinement */}
        <div className="space-y-10">
          {activeTab === "profile" && (
            <motion.form
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleProfileSubmit}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="rounded-premium border-border/60 bg-card shadow-soft p-10 hover:shadow-premium transition-all group">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="w-2 h-10 bg-accent rounded-full shadow-accent" />
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-tight text-main">
                        هوية المستخدم
                      </h3>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                        إدارة البيانات الشخصية العامة
                      </p>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                        الاسم القانوني الكامل
                      </label>
                      <Input
                        value={profileData.fullName || ""}
                        onChange={(e) =>
                          setProfileData({
                            ...profileData,
                            fullName: e.target.value,
                          })
                        }
                        className="h-14 rounded-xl bg-soft border-border font-bold text-base px-6 focus:bg-white transition-all shadow-none"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                        معرف النظام (Username)
                      </label>
                      <Input
                        value={profileData.username || ""}
                        onChange={(e) =>
                          setProfileData({
                            ...profileData,
                            username: e.target.value,
                          })
                        }
                        className="h-14 rounded-xl bg-soft border-border font-black text-base px-6 focus:bg-white transition-all shadow-none"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                        البريد الإلكتروني الموثق
                      </label>
                      <Input
                        value={profileData.email || ""}
                        onChange={(e) =>
                          setProfileData({
                            ...profileData,
                            email: e.target.value,
                          })
                        }
                        className="h-14 rounded-xl bg-soft border-border font-bold text-base px-6 focus:bg-white transition-all shadow-none"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="rounded-premium border-border/60 bg-card shadow-soft p-10 hover:shadow-premium transition-all group">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="w-2 h-10 bg-danger rounded-full shadow-lg shadow-danger/20" />
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-tight text-main">
                        تحديث المفاتيح الأمنية
                      </h3>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                        إدارة كلمات المرور والتشفير
                      </p>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                        كلمة المرور الحالية
                      </label>
                      <Input
                        type="password"
                        value={profileData.oldPassword || ""}
                        onChange={(e) =>
                          setProfileData({
                            ...profileData,
                            oldPassword: e.target.value,
                          })
                        }
                        placeholder="••••••••••••"
                        className="h-14 rounded-xl bg-soft border-border font-black text-base px-6 focus:bg-white transition-all shadow-none"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                        المفتاح الأمني الجديد
                      </label>
                      <Input
                        type="password"
                        value={profileData.newPassword || ""}
                        onChange={(e) =>
                          setProfileData({
                            ...profileData,
                            newPassword: e.target.value,
                          })
                        }
                        className="h-14 rounded-xl bg-soft border-border font-black text-base px-6 focus:bg-white transition-all shadow-none"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                        تأكيد المفتاح الجديد
                      </label>
                      <Input
                        type="password"
                        value={profileData.confirmPassword || ""}
                        onChange={(e) =>
                          setProfileData({
                            ...profileData,
                            confirmPassword: e.target.value,
                          })
                        }
                        className="h-14 rounded-xl bg-soft border-border font-black text-base px-6 focus:bg-white transition-all shadow-none"
                      />
                    </div>
                  </div>
                </Card>
              </div>

              <div className="flex justify-end pt-6">
                <Button
                  type="submit"
                  loading={loading}
                  variant="primary"
                  className="px-16 h-16 rounded-xl font-black text-lg shadow-lg shadow-accent/20 transition-all hover:scale-[1.02]"
                >
                  اعتماد التغييرات الأمنية
                </Button>
              </div>
            </motion.form>
          )}

          {activeTab === "shop" && (
            <motion.form
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleShopSubmit}
              className="space-y-8"
            >
              <Card className="rounded-premium border-border/60 bg-card shadow-soft p-12 hover:shadow-premium transition-all overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] -mr-32 -mt-32 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="flex items-center gap-5 mb-12">
                    <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center text-white shadow-lg">
                      <Store size={32} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black uppercase tracking-tight text-main">
                        البيانات المؤسسية
                      </h3>
                      <p className="text-sm font-medium text-muted uppercase tracking-widest">
                        المعلومات الرسمية التي تظهر في الفواتير والتقارير
                      </p>
                    </div>
                  </div>

                  <div
                    id="business-logo-upload-section"
                    className="mb-12 rounded-[28px] border border-border/60 bg-soft/40 p-6"
                  >
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-5">
                        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
                          {getLogoPreviewUrl() ? (
                            <img
                              src={getLogoPreviewUrl()}
                              alt="لوجو المحل"
                              className="h-full w-full object-contain p-2"
                            />
                          ) : (
                            <ImageIcon className="h-10 w-10 text-muted" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-lg font-black text-main">
                            لوجو المحل
                          </h4>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                            يدعم JPG / PNG / WEBP حتى 20 ميجابايت ويظهر في
                            الإيصالات والملفات
                          </p>
                        </div>
                      </div>
                      <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-8 text-sm font-black text-white shadow-lg shadow-accent/20 transition hover:scale-[1.02]">
                        <Upload size={18} />
                        {logoUploading ? "جاري الرفع..." : "رفع اللوجو"}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleLogoUpload}
                          disabled={logoUploading}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                        المسمى التجاري للمنشأة
                      </label>
                      <Input
                        value={shopSettings.salon_name || ""}
                        onChange={(e) =>
                          setShopSettings({
                            ...shopSettings,
                            salon_name: e.target.value,
                          })
                        }
                        className="h-14 rounded-xl bg-soft border-border font-black text-xl px-8 focus:bg-white transition-all text-accent"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                        رقم التواصل المعتمد
                      </label>
                      <Input
                        value={shopSettings.shop_phone || ""}
                        onChange={(e) =>
                          setShopSettings({
                            ...shopSettings,
                            shop_phone: e.target.value,
                          })
                        }
                        className="h-14 rounded-xl bg-soft border-border font-black text-xl px-8 focus:bg-white transition-all"
                        dir="ltr"
                      />
                    </div>
                    <div className="col-span-full space-y-3">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                        العنوان الاستراتيجي التفصيلي
                      </label>
                      <Input
                        value={shopSettings.address || ""}
                        onChange={(e) =>
                          setShopSettings({
                            ...shopSettings,
                            address: e.target.value,
                          })
                        }
                        className="h-14 rounded-xl bg-soft border-border font-bold text-lg px-8 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-10">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                      رقم الواتساب الرسمي
                    </label>
                    <Input
                      value={shopSettings.shop_whatsapp || ""}
                      onChange={(e) =>
                        setShopSettings({
                          ...shopSettings,
                          shop_whatsapp: e.target.value,
                        })
                      }
                      className="h-14 rounded-xl bg-soft border-border font-black text-xl px-8 focus:bg-white transition-all"
                      dir="ltr"
                      placeholder="01xxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                      العملة الافتراضية
                    </label>
                    <Input
                      value={shopSettings.currency || "ج.م"}
                      onChange={(e) =>
                        setShopSettings({
                          ...shopSettings,
                          currency: e.target.value,
                        })
                      }
                      className="h-14 rounded-xl bg-soft border-border font-black text-xl px-8 focus:bg-white transition-all"
                      placeholder="ج.م / EGP"
                    />
                  </div>
                </div>

                <div className="col-span-full space-y-3 mt-10">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">
                    تذييل الإيصال والفواتير
                  </label>
                  <textarea
                    value={shopSettings.receipt_footer || ""}
                    onChange={(e) =>
                      setShopSettings({
                        ...shopSettings,
                        receipt_footer: e.target.value,
                      })
                    }
                    className="min-h-28 w-full rounded-2xl border border-border bg-soft p-5 text-sm font-bold outline-none transition-all focus:border-accent focus:bg-white resize-none"
                    placeholder="مثال: شكراً لزيارتكم — نتمنى رؤيتكم مرة أخرى"
                  />
                </div>
              </Card>

              <div className="flex justify-end pt-6">
                <Button
                  type="submit"
                  loading={loading}
                  variant="primary"
                  className="px-20 h-16 rounded-xl font-black text-lg shadow-lg shadow-accent/20 transition-all hover:scale-[1.02]"
                >
                  حفظ سجل المؤسسة
                </Button>
              </div>
            </motion.form>
          )}

          {activeTab === "hours" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <WorkingHoursPanel />
            </motion.div>
          )}
          {activeTab === "website" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <BusinessSettingsPage embedded />
            </motion.div>
          )}
          {activeTab === "services" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ServicesManagement hideHeader={true} />
            </motion.div>
          )}
          {activeTab === "security" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <SecurityAccess />
            </motion.div>
          )}
          {activeTab === "financial" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <FinancialRules />
            </motion.div>
          )}

          {activeTab === "users" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <UsersPanel />
            </motion.div>
          )}
          {activeTab === "preferences" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="rounded-premium border-border/60 bg-card shadow-soft p-10 hover:shadow-premium transition-all group">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="w-2 h-10 bg-accent rounded-full shadow-accent" />
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-tight text-main">
                        سمات الواجهة
                      </h3>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                        تخصيص المظهر العام للنظام
                      </p>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="flex items-center justify-between p-6 rounded-2xl bg-soft border border-border/40 transition-all hover:bg-white group">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center text-accent shadow-sm">
                          {preferences.theme === "dark" ? (
                            <Moon size={24} />
                          ) : (
                            <Sun size={24} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-black text-main">
                            الوضع المظلم
                          </p>
                          <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                            {preferences.theme === "dark" ? "مفعل" : "معطل"}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={preferences.theme === "dark"}
                        onCheckedChange={(checked) =>
                          setTheme(checked ? "dark" : "light")
                        }
                        disabled={preferencesSaving}
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Languages size={14} /> لغة النظام المفضلة
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setLanguage("ar")}
                          className={`h-14 rounded-xl font-black text-sm transition-all border ${
                            preferences.language === "ar"
                              ? "bg-accent text-white border-accent shadow-lg shadow-accent/20"
                              : "bg-soft border-border/60 text-muted hover:border-accent/40"
                          }`}
                        >
                          العربية (Arabic)
                        </button>
                        <button
                          type="button"
                          onClick={() => setLanguage("en")}
                          className={`h-14 rounded-xl font-black text-sm transition-all border ${
                            preferences.language === "en"
                              ? "bg-accent text-white border-accent shadow-lg shadow-accent/20"
                              : "bg-soft border-border/60 text-muted hover:border-accent/40"
                          }`}
                        >
                          English (الإنجليزية)
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-premium border-border/60 bg-card shadow-soft p-10 hover:shadow-premium transition-all group">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="w-2 h-10 bg-warning rounded-full shadow-lg shadow-warning/20" />
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-tight text-main">
                        مركز التنبيهات
                      </h3>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                        إدارة الإشعارات والرسائل
                      </p>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="flex items-center justify-between p-6 rounded-2xl bg-soft border border-border/40 transition-all hover:bg-white group">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center text-warning shadow-sm">
                          <Bell size={24} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-main">
                            إشعارات النظام
                          </p>
                          <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                            {preferences.notifications_enabled
                              ? "مفعلة"
                              : "معطلة"}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={preferences.notifications_enabled}
                        onCheckedChange={(checked) =>
                          updatePreferences({
                            notifications_enabled: checked,
                          })
                        }
                        disabled={preferencesSaving}
                      />
                    </div>
                    <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/10">
                      <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 leading-relaxed">
                        عند تفعيل الإشعارات، ستتلقى تنبيهات فورية بشأن الجلسات
                        الجديدة، طلبات التعديل، والتقارير المالية الجاهزة.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="flex justify-center p-8 bg-soft/50 rounded-[28px] border border-dashed border-border/60">
                <div className="text-center space-y-3">
                  <Activity className="w-10 h-10 text-accent mx-auto opacity-40" />
                  <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                    يتم حفظ التفضيلات تلقائيًا وربطها بسجلك السحابي
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;

