import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  User,
  Zap,
  Lock,
  ChevronRight,
  ShieldCheck,
  Settings as SettingsIcon,
  Bell,
  Activity,
  Scissors,
  Palette,
  Moon,
  Sun,
  Languages,
  Mail,
  UserCircle,
  Clock,
  Check,
  Camera,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import api, { baseURL } from "../../services/api";

const STATIC_URL = baseURL.replace("/api/v1", "");
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { cn } from "../../lib/utils";

const SETTINGS_TABS = [
  { id: "profile", label: "حسابي الشخصي", icon: User },
  { id: "security", label: "الأمان والكلمة السر", icon: Lock },
  { id: "preferences", label: "تفضيلات الواجهة", icon: Palette },
];

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

  const STATIC_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1")
    .replace("/api/v1", "");
  const getAvatarUrl = () => {
    if (!profileData.profileImageUrl) return null;
    if (profileData.profileImageUrl.startsWith("http")) return profileData.profileImageUrl;
    return `${STATIC_URL}${profileData.profileImageUrl}`;
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

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً (الحد الأقصى 5 ميجابايت)");
      return;
    }

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
    } catch (err) {
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
      } catch (err) {
        toast.error("فشل تحميل بيانات الحساب");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchProfile();
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
        // If barber, we might have additional fields
        ...(user.role === "BARBER" && {
            display_name: profileData.displayName,
            bio_ar: profileData.bioAr
        })
      });
      await refreshUser();
      toast.success("تم تحديث الملف الشخصي بنجاح");
    } catch (err) {
      toast.error(err.response?.data?.detail || "فشل تحديث البيانات");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
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
      setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "فشل تغيير كلمة المرور");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-indigo-500">
          <Activity className="w-10 h-10 animate-pulse" />
          <p className="text-slate-400 font-bold text-sm">جاري مراجعة البروتوكولات...</p>
        </div>
      </div>
    );

  return (
    <div className="space-y-8 pb-24 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <SettingsIcon className="text-white w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-white tracking-tight">إعدادات الحساب</h1>
            <p className="text-slate-400 font-medium">إدارة ملفك الشخصي، الأمان، وتفضيلات النظام</p>
          </div>
        </div>
        <Badge className="h-10 px-6 rounded-xl bg-indigo-600/10 text-indigo-400 border-indigo-600/20 font-black text-[10px] uppercase tracking-widest gap-3">
          <ShieldCheck size={16} /> متصل كـ {user.role === 'OWNER' ? 'مدير عام' : user.role === 'MANAGER' ? 'مدير فرع' : user.role === 'CASHIER' ? 'كاشير' : 'خبير حلاقة'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        {/* Sidebar Nav */}
        <aside className="space-y-2">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl px-6 py-4 transition-all duration-300 border",
                activeTab === tab.id
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20 scale-[1.02]"
                  : "bg-slate-900/50 text-slate-400 border-white/5 hover:border-indigo-500/40 hover:text-indigo-400"
              )}
            >
              <div className="flex items-center gap-4">
                <tab.icon size={20} className={activeTab === tab.id ? "text-white" : "opacity-40"} />
                <span className="text-xs font-black uppercase tracking-widest">{tab.label}</span>
              </div>
              <ChevronRight size={16} className={cn("transition-transform", activeTab === tab.id ? "rotate-180 opacity-100" : "opacity-0")} />
            </button>
          ))}

          <div className="mt-8 p-6 bg-indigo-600/5 rounded-[2rem] border border-indigo-500/10">
            <div className="flex items-center gap-2 mb-3 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
              <Zap size={14} /> الخصوصية والأمان
            </div>
            <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
              بياناتك مشفرة بالكامل ولا يمكن لأي طرف ثالث الوصول إليها.
            </p>
          </div>
        </aside>

        {/* Content */}
        <div className="min-h-[500px]">
          <AnimatePresence mode="wait">
            {activeTab === "profile" && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card className="rounded-[2.5rem] border-white/5 bg-slate-900/50 p-8 md:p-10">
                  <div className="flex flex-col items-center gap-6 mb-12 border-b border-white/5 pb-12">
                      <div className="relative group">
                          <div className="w-32 h-32 rounded-[2.5rem] bg-indigo-600/20 border-2 border-dashed border-indigo-500/30 flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:border-indigo-500 group-hover:bg-indigo-600/30">
                              {getAvatarUrl() ? (
                                  <img 
                                      src={getAvatarUrl()} 
                                      alt="Avatar" 
                                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                  />
                              ) : (
                                  <span className="text-3xl font-black text-indigo-400">{getInitials()}</span>
                              )}
                              
                              {avatarLoading && (
                                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center">
                                      <Activity className="text-indigo-500 animate-spin" size={24} />
                                  </div>
                              )}
                              
                              <label className="absolute inset-0 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600/40 flex items-center justify-center">
                                  <Camera className="text-white" size={28} />
                                  <input 
                                      type="file" 
                                      className="hidden" 
                                      accept="image/*"
                                      onChange={handleAvatarUpload}
                                      disabled={avatarLoading}
                                  />
                              </label>
                          </div>
                          
                          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 rounded-2xl border-4 border-slate-950 flex items-center justify-center shadow-xl">
                              <Upload className="text-white" size={16} />
                          </div>
                      </div>
                      
                      <div className="text-center">
                          <h4 className="text-white font-black">الصورة الشخصية</h4>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">اضغط للتعديل (JPG, PNG)</p>
                      </div>
                  </div>

                  <form onSubmit={handleProfileSubmit} className="space-y-8">
                    <div className="flex items-center gap-4 mb-2">
                        <UserCircle className="text-indigo-500" size={24} />
                        <h3 className="text-lg font-black text-white">المعلومات الأساسية</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">الاسم بالكامل</label>
                        <Input
                          value={profileData.fullName}
                          onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                          className="h-14 rounded-2xl bg-slate-950/50 border-white/5 focus:border-indigo-500/30 text-white font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">اسم المستخدم (لا يمكن تغييره)</label>
                        <Input
                          value={profileData.username}
                          disabled
                          className="h-14 rounded-2xl bg-slate-950/30 border-white/5 text-slate-500 font-black cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2 col-span-full">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">البريد الإلكتروني</label>
                        <div className="relative">
                            <Input
                                value={profileData.email}
                                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                className="h-14 rounded-2xl bg-slate-950/50 border-white/5 focus:border-indigo-500/30 text-white font-bold pl-12"
                            />
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                        </div>
                      </div>

                      {user.role === 'BARBER' && (
                        <>
                           <div className="space-y-2 col-span-full pt-4 border-t border-white/5">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mr-1">اسم العرض للعملاء</label>
                                <Input
                                    value={profileData.displayName}
                                    onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                                    placeholder="الاسم الذي سيظهر في تطبيق الحجز"
                                    className="h-14 rounded-2xl bg-slate-950/50 border-indigo-500/10 focus:border-indigo-500/30 text-white font-bold"
                                />
                            </div>
                            <div className="space-y-2 col-span-full">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mr-1">النبذة الشخصية (Bio)</label>
                                <textarea
                                    value={profileData.bioAr}
                                    onChange={(e) => setProfileData({ ...profileData, bioAr: e.target.value })}
                                    rows={4}
                                    className="w-full rounded-2xl bg-slate-950/50 border-indigo-500/10 focus:border-indigo-500/30 text-white font-medium p-4 outline-none transition-all resize-none"
                                    placeholder="اكتب نبذة قصيرة عن خبراتك..."
                                />
                            </div>
                        </>
                      )}
                    </div>

                    <div className="flex justify-end border-t border-white/5 pt-8">
                      <Button
                        type="submit"
                        loading={loading}
                        className="px-10 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow-lg shadow-indigo-600/20"
                      >
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
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card className="rounded-[2.5rem] border-white/5 bg-slate-900/50 p-8 md:p-10">
                  <form onSubmit={handlePasswordSubmit} className="space-y-8">
                    <div className="flex items-center gap-4 mb-2">
                        <Lock className="text-rose-500" size={24} />
                        <h3 className="text-lg font-black text-white">تغيير كلمة المرور</h3>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">كلمة المرور الحالية</label>
                        <Input
                          type="password"
                          value={passwordData.oldPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                          className="h-14 rounded-2xl bg-slate-950/50 border-white/5 focus:border-indigo-500/30 text-white font-black"
                          placeholder="••••••••"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">كلمة المرور الجديدة</label>
                          <Input
                            type="password"
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            className="h-14 rounded-2xl bg-slate-950/50 border-white/5 focus:border-indigo-500/30 text-white font-black"
                            placeholder="••••••••"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">تأكيد كلمة المرور</label>
                          <Input
                            type="password"
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                            className="h-14 rounded-2xl bg-slate-950/50 border-white/5 focus:border-indigo-500/30 text-white font-black"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                        <p className="text-[10px] font-bold text-rose-400 leading-relaxed">
                            نصيحة: استخدم كلمة مرور قوية تحتوي على حروف وأرقام ورموز لضمان أقصى درجات الحماية لحسابك.
                        </p>
                    </div>

                    <div className="flex justify-end border-t border-white/5 pt-8">
                      <Button
                        type="submit"
                        loading={loading}
                        className="px-10 h-14 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black shadow-lg shadow-rose-600/20"
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
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="rounded-[2.5rem] border-white/5 bg-slate-900/50 p-8 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-4 mb-8">
                            <Palette className="text-indigo-400" size={24} />
                            <h3 className="text-lg font-black text-white">سمات الواجهة</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-950/50 border border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-indigo-400">
                                        {preferences.theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white">الوضع المظلم</p>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">{preferences.theme === 'dark' ? 'نشط الآن' : 'غير نشط'}</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={preferences.theme === 'dark'}
                                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                                    disabled={preferencesSaving}
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1 flex items-center gap-2">
                                    <Languages size={14} /> لغة النظام
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setLanguage('ar')}
                                        className={cn(
                                            "h-12 rounded-xl text-xs font-black transition-all border",
                                            preferences.language === 'ar' 
                                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                                                : "bg-slate-950/50 border-white/5 text-slate-400 hover:border-indigo-500/20"
                                        )}
                                    >
                                        العربية
                                    </button>
                                    <button
                                        onClick={() => setLanguage('en')}
                                        className={cn(
                                            "h-12 rounded-xl text-xs font-black transition-all border",
                                            preferences.language === 'en' 
                                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                                                : "bg-slate-950/50 border-white/5 text-slate-400 hover:border-indigo-500/20"
                                        )}
                                    >
                                        English
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                  </Card>

                  <Card className="rounded-[2.5rem] border-white/5 bg-slate-900/50 p-8 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-4 mb-8">
                            <Bell className="text-amber-400" size={24} />
                            <h3 className="text-lg font-black text-white">الإشعارات</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-950/50 border border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-amber-400">
                                        <Bell size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white">تنبيهات النظام</p>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">{preferences.notifications_enabled ? 'مفعلة' : 'معطلة'}</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={preferences.notifications_enabled}
                                    onCheckedChange={(checked) => updatePreferences({ notifications_enabled: checked })}
                                    disabled={preferencesSaving}
                                />
                            </div>
                            
                            <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                                <p className="text-[10px] font-bold text-amber-400/80 leading-relaxed">
                                    ستصلك تنبيهات عند حدوث تغييرات هامة في المواعيد أو تلقي رسائل إدارية جديدة.
                                </p>
                            </div>
                        </div>
                    </div>
                  </Card>
                </div>

                <div className="flex justify-center p-8 bg-slate-900/30 rounded-[2.5rem] border border-dashed border-white/5">
                    <div className="text-center space-y-3">
                        <Activity className="w-8 h-8 text-indigo-500/40 mx-auto" />
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">تتم مزامنة التفضيلات سحابياً مع حسابك</p>
                    </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
