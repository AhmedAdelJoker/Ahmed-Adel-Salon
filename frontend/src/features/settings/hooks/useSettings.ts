import { usePreferences } from "@/context/PreferencesContext";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Store,
  Users,
  User,
  Database,
  Lock,
  Trophy,
  Globe,
  Clock,
  Scissors,
  Palette,
} from "lucide-react";
import api, { staticURL } from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { toast } from "react-hot-toast";
import { safePositive } from "@/lib/core/utils";
import { validateImageSize } from "@/lib/media/upload";

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

export const SETTINGS_TABS = [
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

export const useSettings = () => {
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

  return {
    isOwnerLike,
    visibleTabs,
    activeTab,
    setActiveTab,
    loading,
    initialLoading,
    profileData,
    setProfileData,
    shopSettings,
    setShopSettings,
    getLogoPreviewUrl,
    handleLogoUpload,
    handleProfileSubmit,
    handleShopSubmit,
    preferences,
    updatePreferences,
    setTheme,
    setLanguage,
  };
};
