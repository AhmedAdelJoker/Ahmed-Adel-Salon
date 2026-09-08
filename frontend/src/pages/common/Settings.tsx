import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  User,
  Lock,
  ChevronRight,
  ShieldCheck,
  Settings as SettingsIcon,
  Bell,
  Activity,
  Palette,
  Moon,
  Sun,
  Languages,
  Camera,
  Upload,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import api, { staticURL } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";

const SETTINGS_TABS = [
  { id: "profile", label: "حسابي الشخصي", icon: User },
  { id: "security", label: "الأمان والكلمة السر", icon: Lock },
  { id: "preferences", label: "تفضيلات الواجهة", icon: Palette },
];

import { validateImageSize } from "@/lib/media/upload";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AnimatePresence } from "framer-motion";

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
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
    : "profile";

  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [profileData, setProfileData] = useState({
    fullName: "",
    username: "",
    email: "",
    displayName: "",
    bioAr: "",
    profileImageUrl: "",
  });

  const getAvatarUrl = (): string | undefined => {
    if (!profileData.profileImageUrl) return undefined;
    if (profileData.profileImageUrl.startsWith("http"))
      return profileData.profileImageUrl;
    return `${staticURL}${profileData.profileImageUrl}`;
  };

  const getInitials = () => {
    if (!profileData.fullName) return "??";
    return profileData.fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !validateImageSize(file)) return;

    const formData = new FormData();
    formData.append("file", file);

    setAvatarLoading(true);
    try {
      const res = await api.post("/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfileData((prev) => ({
        ...prev,
        profileImageUrl: res.data.profile_image_url,
      }));
      await refreshUser();
      toast.success("تم تحديث الصورة الشخصية");
    } catch (_err) {
      toast.error("فشل رفع الصورة الشخصية");
    } finally {
      setAvatarLoading(false);
    }
  };

  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setInitialLoading(true);
        const res = await api.get("/profile");
        const data = res.data;
        setProfileData({
          fullName: data.full_name || "",
          username: data.username || "",
          email: data.email || "",
          displayName: data.display_name || "",
          bioAr: data.bio_ar || "",
          profileImageUrl: data.profile_image_url || "",
        });
      } catch (_err) {
        toast.error("فشل تحميل بيانات الحساب");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchProfile();
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
        // If barber, we might have additional fields
        ...(user?.role === "BARBER" && {
          display_name: profileData.displayName,
          bio_ar: profileData.bioAr,
        }),
      });
      await refreshUser();
      toast.success("تم تحديث الملف الشخصي بنجاح");
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = apiErr.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "فشل تحديث البيانات");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setPasswordData({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = apiErr.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "فشل تغيير كلمة المرور");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-indigo-500">
          <Activity className="w-10 h-10 animate-pulse" />
          <p className="text-slate-400 font-bold text-sm">
            جاري مراجعة البروتوكولات...
          </p>
        </div>
      </div>
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-8 shadow-soft">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
            <SettingsIcon className="text-white w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-main tracking-tight">
              إعدادات الحساب
            </h1>
            <p className="text-sm font-medium text-muted">
              إدارة ملفك الشخصي، الأمان، وتفضيلات النظام.
            </p>
          </div>
        </div>
        <Badge variant="outline" size="lg" className="gap-2">
          <ShieldCheck size={14} /> متصل كـ {user?.role}
        </Badge>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar Nav */}
        <div className="space-y-2">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-5 py-3.5 transition-all duration-200 border",
                activeTab === tab.id
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-card text-muted border-border hover:border-primary/30 hover:text-primary",
              )}
            >
              <div className="flex items-center gap-3">
                <tab.icon size={18} />
                <span className="text-xs font-bold">{tab.label}</span>
              </div>
              <ChevronRight
                size={14}
                className={cn(
                  "transition-transform",
                  activeTab === tab.id && "rotate-180",
                )}
              />
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-[500px]">
          <AnimatePresence mode="wait">
            {activeTab === "profile" && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="p-8 md:p-10 shadow-soft">
                  <div className="flex flex-col items-center gap-4 mb-10 border-b border-border pb-10">
                    <div className="relative group">
                      <div className="w-28 h-28 rounded-full bg-soft border-2 border-dashed border-primary/20 flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/40">
                        {getAvatarUrl() ? (
                          <img
                            src={getAvatarUrl()}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl font-extrabold text-primary">
                            {getInitials()}
                          </span>
                        )}
                        {avatarLoading && (
                          <div className="absolute inset-0 bg-card/60 flex items-center justify-center">
                            <Activity className="animate-spin text-primary" />
                          </div>
                        )}
                        <label className="absolute inset-0 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity bg-primary/20 flex items-center justify-center">
                          <Camera className="text-white" size={24} />
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            disabled={avatarLoading}
                          />
                        </label>
                      </div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full border-4 border-card flex items-center justify-center shadow-sm">
                        <Upload className="text-white" size={12} />
                      </div>
                    </div>
                    <div className="text-center">
                      <h4 className="text-main font-bold">الصورة الشخصية</h4>
                      <p className="text-[10px] font-medium text-muted mt-1 uppercase tracking-wider">
                        JPG, PNG (Max 2MB)
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleProfileSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mr-1">
                          الاسم بالكامل
                        </label>
                        <Input
                          value={profileData.fullName}
                          onChange={(e) =>
                            setProfileData({
                              ...profileData,
                              fullName: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mr-1">
                          اسم المستخدم
                        </label>
                        <Input
                          value={profileData.username}
                          disabled
                          className="bg-soft opacity-60"
                        />
                      </div>
                      <div className="space-y-1.5 col-span-full">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mr-1">
                          البريد الإلكتروني
                        </label>
                        <Input
                          value={profileData.email}
                          onChange={(e) =>
                            setProfileData({
                              ...profileData,
                              email: e.target.value,
                            })
                          }
                        />
                      </div>
                      {user?.role === "BARBER" && (
                        <>
                          <div className="space-y-1.5 col-span-full">
                            <label className="text-[10px] font-bold text-primary uppercase tracking-widest mr-1">
                              اسم العرض
                            </label>
                            <Input
                              value={profileData.displayName}
                              onChange={(e) =>
                                setProfileData({
                                  ...profileData,
                                  displayName: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5 col-span-full">
                            <label className="text-[10px] font-bold text-primary uppercase tracking-widest mr-1">
                              النبذة الشخصية
                            </label>
                            <textarea
                              value={profileData.bioAr}
                              onChange={(e) =>
                                setProfileData({
                                  ...profileData,
                                  bioAr: e.target.value,
                                })
                              }
                              rows={4}
                              className="w-full rounded-lg bg-soft border border-border p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex justify-end pt-6 border-t border-border">
                      <Button type="submit" loading={loading} className="px-8">
                        حفظ التغييرات
                      </Button>
                    </div>
                  </form>
                </Card>
              </motion.div>
            )}

            {activeTab === "security" && (
              <motion.div
                key="security"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="p-8 md:p-10 shadow-soft">
                  <form onSubmit={handlePasswordSubmit} className="space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Lock className="text-danger" size={20} />
                      <h3 className="text-lg font-bold text-main">
                        تغيير كلمة المرور
                      </h3>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mr-1">
                          كلمة المرور الحالية
                        </label>
                        <Input
                          type="password"
                          value={passwordData.oldPassword}
                          onChange={(e) =>
                            setPasswordData({
                              ...passwordData,
                              oldPassword: e.target.value,
                            })
                          }
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted uppercase tracking-widest mr-1">
                            الجديدة
                          </label>
                          <Input
                            type="password"
                            value={passwordData.newPassword}
                            onChange={(e) =>
                              setPasswordData({
                                ...passwordData,
                                newPassword: e.target.value,
                              })
                            }
                            placeholder="••••••••"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted uppercase tracking-widest mr-1">
                            تأكيد
                          </label>
                          <Input
                            type="password"
                            value={passwordData.confirmPassword}
                            onChange={(e) =>
                              setPasswordData({
                                ...passwordData,
                                confirmPassword: e.target.value,
                              })
                            }
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end pt-6 border-t border-border">
                      <Button
                        type="submit"
                        variant="danger"
                        loading={loading}
                        className="px-8"
                      >
                        تحديث كلمة المرور
                      </Button>
                    </div>
                  </form>
                </Card>
              </motion.div>
            )}

            {activeTab === "preferences" && (
              <motion.div
                key="preferences"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="p-8 shadow-soft flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <Palette className="text-primary" size={20} />
                        <h3 className="text-lg font-bold text-main">
                          سمات الواجهة
                        </h3>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-lg bg-soft border border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-card flex items-center justify-center text-primary shadow-sm">
                            {preferences.theme === "dark" ? (
                              <Moon size={18} />
                            ) : (
                              <Sun size={18} />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-main">
                              الوضع المظلم
                            </p>
                            <p className="text-[10px] font-medium text-muted uppercase">
                              {preferences.theme === "dark" ? "نشط" : "معطل"}
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
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mr-1 flex items-center gap-2">
                          <Languages size={12} /> لغة النظام
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["ar", "en"] as const).map((lang) => (
                            <button
                              key={lang}
                              onClick={() => setLanguage(lang)}
                              className={cn(
                                "h-10 rounded-lg text-xs font-bold transition-all border",
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
                  </Card>

                  <Card className="p-8 shadow-soft flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <Bell className="text-warning" size={20} />
                        <h3 className="text-lg font-bold text-main">
                          الإشعارات
                        </h3>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-lg bg-soft border border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-card flex items-center justify-center text-warning shadow-sm">
                            <Bell size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-main">
                              تنبيهات النظام
                            </p>
                            <p className="text-[10px] font-medium text-muted uppercase">
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
                      <div className="p-4 rounded-lg bg-warning-soft border border-warning/10">
                        <p className="text-[10px] font-bold text-warning leading-relaxed">
                          ستصلك تنبيهات عند حدوث تغييرات هامة في المواعيد أو
                          تلقي رسائل إدارية جديدة.
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
