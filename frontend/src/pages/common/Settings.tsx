import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  User,
  Lock,
  ChevronRight,
  ShieldCheck,
  Settings as SettingsIcon,
  Bell,
  Palette,
  Moon,
  Sun,
  Languages,
  Camera,
  Upload,
  Activity,
  Sparkles,
  Store,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import api, { staticURL } from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/core/utils";
import { validateImageSize } from "@/lib/media/upload";
import { PageHeader, PremiumCard, ContentPanel, SkeletonCard } from "@/components/shared/PremiumUI";
import { AnimatePresence } from "framer-motion";

const SETTINGS_TABS = [
  { id: "profile", label: "الملف الشخصي", icon: User, desc: "الاسم والصورة والبريد" },
  { id: "security", label: "الأمان", icon: Lock, desc: "كلمة المرور" },
  { id: "preferences", label: "الواجهة", icon: Palette, desc: "المظهر واللغة والتنبيهات" },
] as const;

type TabId = (typeof SETTINGS_TABS)[number]["id"];

const ROLE_LABEL: Record<string, string> = {
  OWNER: "المالك",
  ADMIN: "مدير النظام",
  MANAGER: "المدير",
  CASHIER: "الكاشير",
  BARBER: "الخبير",
  ACCOUNTANT: "المحاسب",
};

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const {
    preferences,
    updatePreferences,
    setTheme,
    setLanguage,
    saving: preferencesSaving,
  } = usePreferences();

  const requestedTab = searchParams.get("tab") as TabId | null;
  const activeTab: TabId = (SETTINGS_TABS as readonly { id: string }[]).some((t) => t.id === requestedTab)
    ? (requestedTab as TabId)
    : "profile";

  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [profileData, setProfileData] = useState({
    fullName: "",
    username: "",
    email: "",
    displayName: "",
    bioAr: "",
    profileImageUrl: "",
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const roleKey = String(user?.role || "").toUpperCase();
  const roleLabel = ROLE_LABEL[roleKey] || user?.role || "—";

  const getAvatarUrl = (): string | undefined => {
    if (!profileData.profileImageUrl) return undefined;
    if (profileData.profileImageUrl.startsWith("http")) return profileData.profileImageUrl;
    return `${staticURL}${profileData.profileImageUrl}`;
  };

  const getInitials = () => {
    const src = profileData.fullName || profileData.username || "??";
    return src
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const isBarber = roleKey === "BARBER";
  const isOwnerLike = ["OWNER", "ADMIN"].includes(roleKey);

  const profileCompleteness = useMemo(() => {
    const checks = [
      Boolean(profileData.fullName.trim()),
      Boolean(profileData.profileImageUrl),
      Boolean(profileData.email.trim()),
      isBarber ? Boolean(profileData.displayName.trim() || profileData.bioAr.trim()) : true,
    ];
    return { done: checks.filter(Boolean).length, total: checks.length };
  }, [profileData, isBarber]);

  const fetchProfile = async () => {
    try {
      setInitialLoading(true);
      setLoadError(null);
      const res = await api.get("/profile");
      const data = adaptObject(res, {}) as Record<string, unknown>;
      setProfileData({
        fullName: String(data.full_name || data.fullName || ""),
        username: String(data.username || ""),
        email: String(data.email || ""),
        displayName: String(data.display_name || (data as Record<string, unknown>).displayName || ""),
        bioAr: String(data.bio_ar || (data as Record<string, unknown>).bioAr || ""),
        profileImageUrl: String(data.profile_image_url || (data as Record<string, unknown>).profileImageUrl || ""),
      });
    } catch {
      setLoadError("تعذر تحميل بيانات الحساب. تحقق من الاتصال ثم أعد المحاولة.");
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const setActiveTab = (tab: string) => setSearchParams({ tab });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !validateImageSize(file)) return;
    const fd = new FormData();
    fd.append("file", file);
    setAvatarLoading(true);
    try {
      const res = await api.post("/profile/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = adaptObject(res, {}) as Record<string, unknown>;
      const url = String(data.profile_image_url || (data as Record<string, unknown>).profileImageUrl || "");
      setProfileData((prev) => ({ ...prev, profileImageUrl: url }));
      await refreshUser();
      toast.success("تم تحديث الصورة الشخصية");
    } catch {
      toast.error("فشل رفع الصورة الشخصية");
    } finally {
      setAvatarLoading(false);
      e.target.value = "";
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData.fullName.trim()) {
      toast.error("الاسم الكامل مطلوب");
      return;
    }
    setLoading(true);
    try {
      await api.put("/profile", {
        full_name: profileData.fullName.trim(),
        email: profileData.email.trim(),
        ...(isBarber && {
          display_name: profileData.displayName.trim() || null,
          bio_ar: profileData.bioAr.trim() || null,
        }),
      });
      await refreshUser();
      toast.success("تم تحديث الملف الشخصي بنجاح");
    } catch (err) {
      const d = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "فشل تحديث البيانات");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordData.oldPassword) {
      toast.error("أدخل كلمة المرور الحالية");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error("كلمة المرور الجديدة قصيرة (6 أحرف على الأقل)");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("كلمات المرور الجديدة غير متطابقتين");
      return;
    }
    setLoading(true);
    try {
      await api.post("/profile/change-password", {
        current_password: passwordData.oldPassword,
        new_password: passwordData.newPassword,
      });
      toast.success("تم تغيير كلمة المرور بنجاح");
      setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      const d = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "فشل تغيير كلمة المرور");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="erp-page-container space-y-6 pb-16">
        <PageHeader
          title="حسابي"
          subtitle="إدارة ملفك الشخصي وتفضيلات الواجهة."
          badge="الحساب الشخصي"
          icon={SettingsIcon}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </div>
        <SkeletonCard variant="content" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="erp-page-container space-y-6 pb-16">
        <PageHeader title="حسابي" subtitle="إدارة ملفك الشخصي وتفضيلات الواجهة." badge="الحساب الشخصي" icon={SettingsIcon} />
        <PremiumCard className="border-dashed">
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <p className="text-lg font-black text-main">تعذر تحميل بيانات الحساب</p>
            <p className="max-w-md text-sm font-bold text-muted">{loadError}</p>
            <Button onClick={fetchProfile} loading={loading}>
              <Activity size={16} /> إعادة المحاولة
            </Button>
          </div>
        </PremiumCard>
      </div>
    );
  }

  return (
    <div className="erp-page-container space-y-6 pb-16">
      <PageHeader
        title="حسابي"
        subtitle={
          isOwnerLike
            ? "ملفك الشخصي وتفضيلاتك — نفس الصفحة لكل الأدوار. إعدادات المحل في لوحة الإدارة."
            : "ملفك الشخصي وتفضيلاتك."
        }
        badge="الحساب الشخصي"
        icon={User}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary" className="h-9 rounded-xl px-4 text-[11px] font-black gap-1.5">
              <ShieldCheck size={14} /> {roleLabel}
            </Badge>
            {isOwnerLike && (
              <Button variant="outline" onClick={() => navigate("/owner/settings")} className="h-9 rounded-xl px-4 text-xs font-black">
                <Store size={14} className="ml-1.5" /> إعدادات المحل
              </Button>
            )}
          </div>
        }
      />

      {/* Identity hero */}
      <PremiumCard className="overflow-hidden p-0" hoverable={false}>
        <div className="bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[28px] bg-card border-2 border-border shadow-soft flex items-center justify-center overflow-hidden">
              {getAvatarUrl() ? (
                <img src={getAvatarUrl()} alt="الصورة الشخصية" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-primary">{getInitials()}</span>
              )}
              {avatarLoading && (
                <div className="absolute inset-0 bg-card/70 flex items-center justify-center">
                  <Activity className="animate-spin text-primary" size={22} />
                </div>
              )}
              <label className="absolute inset-0 cursor-pointer bg-primary/0 group-hover:bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                <span className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg">
                  <Camera size={16} />
                </span>
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={avatarLoading} />
              </label>
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary border-2 border-card flex items-center justify-center shadow">
              <Upload size={12} className="text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-right">
            <h2 className="text-xl sm:text-2xl font-black text-main leading-tight truncate">
              {profileData.fullName || profileData.username || "—"}
            </h2>
            <p className="text-xs font-bold text-muted mt-1 truncate" dir="ltr">
              {profileData.username ? `@${profileData.username}` : "—"} {profileData.email ? `• ${profileData.email}` : ""}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
              <Badge variant={isBarber ? "warning" : "primary"} className="rounded-full px-3 py-1 text-[10px] font-black">
                {roleLabel}
              </Badge>
              <Badge variant={profileCompleteness.done === profileCompleteness.total ? "success" : "secondary"} className="rounded-full px-3 py-1 text-[10px] font-black tabular-nums">
                {profileCompleteness.done}/{profileCompleteness.total} مكتمل
              </Badge>
              <span className="text-[11px] font-bold text-muted hidden sm:inline">JPG/PNG حتى 2MB — انقر على الصورة للتغيير</span>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-bold text-muted">
            <Sparkles size={14} className="text-primary" /> لوحة حساب عالمية — نفس التجربة لكل الأدوار
          </div>
        </div>
      </PremiumCard>

      {/* Tabs + content */}
      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-[280px] shrink-0">
          <div
            role="tablist"
            aria-label="أقسام الحساب"
            className="sticky top-24 space-y-1.5 flex lg:flex-col overflow-x-auto p-2 rounded-2xl border border-border/40 bg-card/40 lg:bg-transparent lg:border-none lg:p-0 gap-2 lg:gap-1.5 no-scrollbar snap-x"
          >
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center justify-between min-w-[160px] lg:min-w-full px-4 py-3.5 rounded-2xl border text-right transition-all snap-start",
                    isActive
                      ? "bg-primary text-white border-primary shadow-soft"
                      : "bg-card text-muted border-border hover:border-primary/20 hover:text-main",
                  )}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", isActive ? "bg-white/15" : "bg-soft border border-border")}>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-black leading-none">{tab.label}</span>
                      <span className={cn("block text-[10px] font-bold mt-1", isActive ? "text-white/70" : "text-muted")}>{tab.desc}</span>
                    </span>
                  </span>
                  <ChevronRight size={14} className={cn("shrink-0 transition-transform", isActive && "rotate-180")} />
                </button>
              );
            })}
          </div>

          <PremiumCard className="hidden lg:block mt-6 bg-gradient-to-br from-primary/5 to-transparent border-dashed p-5" hoverable={false}>
            <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-primary mb-2">
              <Clock size={14} /> مسار موحد
            </div>
            <p className="text-xs font-bold leading-relaxed text-muted">
              هذه صفحتك الشخصية — نفس الرابط <span className="text-main font-black" dir="ltr">/settings</span> لكل الأدوار. إعدادات المحل (المنشأة، الساعات، الخدمات) في{" "}
              <button onClick={() => navigate("/owner/settings")} className="text-primary underline font-black">
                لوحة الإدارة
              </button>{" "}
              للمالك فقط.
            </p>
          </PremiumCard>
        </aside>

        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === "profile" && (
              <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <ContentPanel title="الملف الشخصي" subtitle="اسمك، بريدك، وصورتك — تُحفظ لكل حساب على حدة.">
                  <form onSubmit={handleProfileSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="account-fullname" className="text-[10px] font-black tracking-widest text-muted uppercase mr-1">
                          الاسم الكامل
                        </label>
                        <Input
                          id="account-fullname"
                          value={profileData.fullName}
                          onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                          maxLength={255}
                          autoComplete="name"
                          placeholder="مثال: أحمد محمد"
                          className="h-11 rounded-xl bg-soft border-border/60 font-bold"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="account-username" className="text-[10px] font-black tracking-widest text-muted uppercase mr-1">
                          اسم المستخدم
                        </label>
                        <Input id="account-username" value={profileData.username} disabled className="h-11 rounded-xl bg-soft opacity-60 font-bold" dir="ltr" />
                        <p className="text-[10px] font-bold text-muted mr-1">يُدار من إدارة المستخدمين</p>
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label htmlFor="account-email" className="text-[10px] font-black tracking-widest text-muted uppercase mr-1">
                          البريد الإلكتروني
                        </label>
                        <Input
                          id="account-email"
                          type="email"
                          value={profileData.email}
                          onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                          maxLength={255}
                          autoComplete="email"
                          placeholder="name@example.com"
                          className="h-11 rounded-xl bg-soft border-border/60 font-bold"
                          dir="ltr"
                        />
                      </div>
                      {isBarber && (
                        <>
                          <div className="space-y-1.5 md:col-span-2">
                            <label htmlFor="account-displayname" className="text-[10px] font-black tracking-widest text-primary uppercase mr-1">
                              اسم العرض (للموقع العام)
                            </label>
                            <Input
                              id="account-displayname"
                              value={profileData.displayName}
                              onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                              maxLength={255}
                              placeholder="مثال: الخبير أحمد"
                              className="h-11 rounded-xl bg-soft border-border/60 font-bold"
                            />
                          </div>
                          <div className="space-y-1.5 md:col-span-2">
                            <label htmlFor="account-bio" className="text-[10px] font-black tracking-widest text-primary uppercase mr-1">
                              النبذة
                            </label>
                            <Textarea
                              id="account-bio"
                              value={profileData.bioAr}
                              onChange={(e) => setProfileData({ ...profileData, bioAr: e.target.value })}
                              maxLength={1000}
                              rows={4}
                              placeholder="نبذة قصيرة تظهر للعملاء"
                              className="rounded-xl bg-soft border-border/60 font-bold"
                            />
                            <p className="text-[10px] font-bold text-muted mr-1 tabular-nums">{profileData.bioAr.length}/1000</p>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex justify-end pt-4 border-t border-border/40">
                      <Button type="submit" loading={loading} className="h-11 rounded-xl px-8 text-xs font-black">
                        حفظ الملف الشخصي
                      </Button>
                    </div>
                  </form>
                </ContentPanel>
              </motion.div>
            )}

            {activeTab === "security" && (
              <motion.div key="security" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <ContentPanel title="الأمان وكلمة المرور" subtitle="غيّر كلمة المرور — تُطبّق فوراً على كل جلساتك.">
                  <form onSubmit={handlePasswordSubmit} className="space-y-5 max-w-xl">
                    <div className="space-y-1.5">
                      <label htmlFor="account-old-password" className="text-[10px] font-black tracking-widest text-muted uppercase mr-1">
                        كلمة المرور الحالية
                      </label>
                      <Input
                        id="account-old-password"
                        type="password"
                        value={passwordData.oldPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="h-11 rounded-xl bg-soft border-border/60 font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="account-new-password" className="text-[10px] font-black tracking-widest text-muted uppercase mr-1">
                          الجديدة
                        </label>
                        <Input
                          id="account-new-password"
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          autoComplete="new-password"
                          placeholder="6 أحرف على الأقل"
                          className="h-11 rounded-xl bg-soft border-border/60 font-bold"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="account-confirm-password" className="text-[10px] font-black tracking-widest text-muted uppercase mr-1">
                          تأكيد الجديدة
                        </label>
                        <Input
                          id="account-confirm-password"
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          autoComplete="new-password"
                          placeholder="أعد كتابة الجديدة"
                          className="h-11 rounded-xl bg-soft border-border/60 font-bold"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t border-border/40">
                      <Button type="submit" variant="danger" loading={loading} className="h-11 rounded-xl px-8 text-xs font-black">
                        تحديث كلمة المرور
                      </Button>
                    </div>
                  </form>
                </ContentPanel>
              </motion.div>
            )}

            {activeTab === "preferences" && (
              <motion.div key="preferences" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <PremiumCard className="p-6" hoverable={false}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center text-primary">
                        <Palette size={18} />
                      </div>
                      <h3 className="text-sm font-black text-main">المظهر واللغة</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-soft border border-border">
                        <span className="flex items-center gap-3 text-sm font-black text-main">
                          <span className="h-9 w-9 rounded-xl bg-card border flex items-center justify-center">
                            {preferences.theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                          </span>
                          الوضع المظلم
                        </span>
                        <Switch
                          checked={preferences.theme === "dark"}
                          onCheckedChange={(c) => setTheme(c ? "dark" : "light")}
                          disabled={preferencesSaving}
                          aria-label="تبديل الوضع المظلم"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black tracking-widest text-muted uppercase mr-1 flex items-center gap-1.5">
                          <Languages size={12} /> لغة النظام
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["ar", "en"] as const).map((lang) => (
                            <button
                              key={lang}
                              onClick={() => setLanguage(lang)}
                              className={cn(
                                "h-11 rounded-xl text-xs font-black border transition-all",
                                preferences.language === lang
                                  ? "bg-primary text-white border-primary shadow-sm"
                                  : "bg-soft border-border text-muted hover:border-primary/20",
                              )}
                            >
                              {lang === "ar" ? "العربية" : "English"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </PremiumCard>

                  <PremiumCard className="p-6" hoverable={false}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-600">
                        <Bell size={18} />
                      </div>
                      <h3 className="text-sm font-black text-main">الإشعارات</h3>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-soft border border-border">
                      <span className="text-sm font-black text-main">تنبيهات النظام</span>
                      <Switch
                        checked={preferences.notifications_enabled}
                        onCheckedChange={(c) => updatePreferences({ notifications_enabled: c })}
                        disabled={preferencesSaving}
                        aria-label="تبديل الإشعارات"
                      />
                    </div>
                    <p className="text-xs font-bold leading-relaxed text-muted mt-4 p-3 rounded-xl bg-amber-50 border border-amber-100 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-200">
                      ستصلك تنبيهات عند تغييرات المواعيد أو رسائل إدارية جديدة.
                    </p>
                  </PremiumCard>
                </div>

                <PremiumCard className="p-4 flex items-center gap-3 bg-soft/30 border-dashed" hoverable={false}>
                  <Store size={16} className="text-muted shrink-0" />
                  <p className="text-xs font-bold leading-relaxed text-muted">
                    إعدادات المحل (المنشأة، الساعات، الخدمات، الموقع) انتقلت إلى{" "}
                    <button onClick={() => navigate("/owner/settings")} className="text-primary underline font-black">
                      لوحة الإدارة
                    </button>{" "}
                    — هذه الصفحة لحسابك الشخصي فقط.
                  </p>
                </PremiumCard>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
