import { useAuth } from "@/context/AuthContext";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  User,
  Settings,
  Shield,
  Bell,
  Palette,
  Moon,
  Sun,
  Camera,
  Save,
  LogOut,
  ArrowLeft,
  Calendar,
  Clock,
  XCircle,
  DollarSign,
  Zap,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/core/utils";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const BarberProfile = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  interface BarberProfileForm {
    full_name: string;
    phone: string;
    email: string;
    address: string;
    bio: string;
    commission_rate: number;
    avatar_url: string;
  }

  const [profile, setProfile] = useState<BarberProfileForm>({
    full_name: (user?.full_name as string) || "",
    phone: (user as unknown as Record<string, unknown>)?.phone as string || "",
    email: (user?.email as string) || "",
    address: "",
    bio: "",
    commission_rate: Number((user as unknown as Record<string, unknown>)?.commission_rate) || 15,
    avatar_url: ((user as unknown as Record<string, unknown>)?.avatar_url as string) || "",
  });

  const [notifications, setNotifications] = useState({
    new_appointment: true,
    appointment_reminder: true,
    appointment_cancelled: true,
    shift_reminder: true,
    tips: true,
    marketing: false,
  });

  const [security, setSecurity] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
    two_factor: false,
  });

  const [appearance, setAppearance] = useState({
    theme: "system",
    compact_mode: false,
    animations: true,
    sound: true,
  });

  useEffect(() => {
    if (user?.barber_id) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const barberId = (user as unknown as Record<string, unknown>)?.barber_id ?? user?.id;
      const res = await api.get(`/barbers/${barberId}`);
       
      const data: any = adaptObject(res, {});
      setProfile({
        full_name: data?.full_name || (user?.full_name as string) || "",
        phone: data?.phone || ((user as unknown as Record<string, unknown>)?.phone as string) || "",
        email: data?.email || (user?.email as string) || "",
        address: data?.address || "",
        bio: data?.bio || "",
        commission_rate: data?.commission_rate || Number((user as unknown as Record<string, unknown>)?.commission_rate) || 15,
        avatar_url: data?.avatar_url || (((user as unknown as Record<string, unknown>)?.avatar_url as string) || ""),
      });
    } catch (err) {
      console.error("Profile load error:", err);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const barberId = (user as unknown as Record<string, unknown>)?.barber_id ?? user?.id;
      await api.put(`/barbers/${barberId}`, profile);
      await refreshUser();
      toast.success("تم حفظ الملف الشخصي");
    } catch (_err) {
      toast.error("فشل الحفظ");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      await api.put(`/barber/notification-settings`, notifications);
      toast.success("تم حفظ إعدادات الإشعارات");
    } catch (_err) {
      toast.error("فشل الحفظ");
    }
  };

  const handleSaveSecurity = async () => {
    if (security.new_password !== security.confirm_password) {
      return toast.error("كلمة المرور غير متطابقة");
    }
    try {
      await api.post("/auth/change-password", {
        current_password: security.current_password,
        new_password: security.new_password,
      });
      setSecurity({
        current_password: "",
        new_password: "",
        confirm_password: "",
        two_factor: security.two_factor,
      });
      toast.success("تم تغيير كلمة المرور");
    } catch (_err) {
      toast.error("فشل تغيير كلمة المرور");
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => setAvatarPreview(ev.target?.result as string | null);
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen pb-12" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-4 px-3 pt-4 sm:space-y-5 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => navigate("/barber")}
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-2xl font-black text-main">ملفي الشخصي</h1>
              <p className="text-sm text-muted">إدارة حسابك وإعداداتك</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-card border border-border p-1">
            <TabsTrigger
              value="profile"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <User size={14} className="ml-1.5" /> الملف الشخصي
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <Bell size={14} className="ml-1.5" /> الإشعارات
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <Shield size={14} className="ml-1.5" /> الأمان
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <Palette size={14} className="ml-1.5" /> المظهر
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Avatar Card */}
              <div className="lg:col-span-1 space-y-4">
                <div className="rounded-2xl border border-border bg-white p-5 shadow-soft text-center">
                  <div className="relative inline-block mb-4">
                    <div className="relative w-28 h-28 mx-auto rounded-full overflow-hidden border-4 border-primary/20">
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                          <User size={32} className="text-primary" />
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-0 left-1/2 -translate-x-1/2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
                      >
                        <Camera size={16} />
                      </button>
                    </label>
                  </div>
                  <h3 className="font-black text-main">
                    {profile.full_name || "غير محدد"}
                  </h3>
                  <p className="text-sm text-muted">
                    حلاق • {user?.role || "BARBER"}
                  </p>
                  <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="text-xs font-bold text-primary uppercase">
                      معدل العمولة
                    </p>
                    <p className="text-2xl font-black text-primary">
                      {profile.commission_rate}%
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
                  <h4 className="font-black text-main mb-3">معلومات الحساب</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted">المعرف</span>
                      <span className="font-black">{user?.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">البريد</span>
                      <span className="font-black">
                        {profile.email || "غير محدد"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">الهاتف</span>
                      <span className="font-black">
                        {profile.phone || "غير محدد"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">الدور</span>
                      <span className="font-black text-primary">
                        {user?.role}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Card */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
                  <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                    <User size={16} className="text-primary" /> المعلومات
                    الشخصية
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                        الاسم الكامل *
                      </label>
                      <Input
                        value={profile.full_name}
                        onChange={(e) =>
                          setProfile({ ...profile, full_name: e.target.value })
                        }
                        className="h-10 rounded-xl"
                        placeholder="اسمك الكامل"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                        الهاتف *
                      </label>
                      <Input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) =>
                          setProfile({ ...profile, phone: e.target.value })
                        }
                        className="h-10 rounded-xl"
                        placeholder="010xxxxxxxx"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                        البريد الإلكتروني
                      </label>
                      <Input
                        type="email"
                        value={profile.email}
                        onChange={(e) =>
                          setProfile({ ...profile, email: e.target.value })
                        }
                        className="h-10 rounded-xl"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                        معدل العمولة (%)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={profile.commission_rate}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            commission_rate: Number(e.target.value) || 0,
                          })
                        }
                        className="h-10 rounded-xl"
                        placeholder="15"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                        العنوان
                      </label>
                      <Input
                        value={profile.address}
                        onChange={(e) =>
                          setProfile({ ...profile, address: e.target.value })
                        }
                        className="h-10 rounded-xl"
                        placeholder="عنوان السكن"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                        نبذة عنك
                      </label>
                      <textarea
                        value={profile.bio}
                        onChange={(e) =>
                          setProfile({ ...profile, bio: e.target.value })
                        }
                        className="w-full h-24 rounded-xl border border-border bg-soft p-3 text-sm font-bold resize-none focus:border-primary focus:ring-0"
                        placeholder="اكتب نبذة مختصرة عن خبرتك وتخصصاتك..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl px-6"
                    onClick={loadProfile}
                  >
                    <ArrowLeft size={14} className="ml-1.5" /> استعادة
                  </Button>
                  <Button
                    onClick={handleSaveProfile}
                    loading={loading}
                    className="h-10 rounded-xl px-6"
                  >
                    <Save size={14} className="ml-1.5" /> حفظ التغييرات
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                <Bell size={16} className="text-primary" /> تفضيلات الإشعارات
              </h3>
              <div className="space-y-3">
                {[
                  {
                    key: "new_appointment",
                    label: "حجز جديد",
                    desc: "عندما يتم إسناد حجز جديد لك",
                    icon: Calendar,
                  },
                  {
                    key: "appointment_reminder",
                    label: "تذكير بالمواعيد",
                    desc: "قبل 30 دقيقة من الموعد",
                    icon: Clock,
                  },
                  {
                    key: "appointment_cancelled",
                    label: "إلغاء المواعيد",
                    desc: "عندما يلغي العميل حجزه",
                    icon: XCircle,
                  },
                  {
                    key: "shift_reminder",
                    label: "تذكير الوردية",
                    desc: "قبل بداية ورديتك",
                    icon: Sun,
                  },
                  {
                    key: "tips",
                    label: "البشكيرش",
                    desc: "عند استلام بشكيرش",
                    icon: DollarSign,
                  },
                  {
                    key: "marketing",
                    label: "العروض والتسويق",
                    desc: "عروض خاصة وأخبار",
                    icon: Zap,
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-soft/50 hover:bg-soft transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <item.icon size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-black text-main">{item.label}</p>
                        <p className="text-xs text-muted">{item.desc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications[item.key]}
                      onCheckedChange={(checked) =>
                        setNotifications({
                          ...notifications,
                          [item.key]: checked,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <Button className="w-full mt-4" onClick={handleSaveNotifications}>
                حفظ الإشعارات
              </Button>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                <Shield size={16} className="text-primary" /> تغيير كلمة المرور
              </h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    كلمة المرور الحالية
                  </label>
                  <Input
                    type="password"
                    value={security.current_password}
                    onChange={(e) =>
                      setSecurity({
                        ...security,
                        current_password: e.target.value,
                      })
                    }
                    className="h-10 rounded-xl"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    كلمة المرور الجديدة
                  </label>
                  <Input
                    type="password"
                    value={security.new_password}
                    onChange={(e) =>
                      setSecurity({ ...security, new_password: e.target.value })
                    }
                    className="h-10 rounded-xl"
                    placeholder="كلمة مرور قوية"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    تأكيد كلمة المرور الجديدة
                  </label>
                  <Input
                    type="password"
                    value={security.confirm_password}
                    onChange={(e) =>
                      setSecurity({
                        ...security,
                        confirm_password: e.target.value,
                      })
                    }
                    className="h-10 rounded-xl"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <Button onClick={handleSaveSecurity} className="w-full">
                تغيير كلمة المرور
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                <Shield size={16} className="text-primary" /> المصادقة الثنائية
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-main">
                    تفعيل المصادقة الثنائية (2FA)
                  </p>
                  <p className="text-sm text-muted">
                    أضف طبقة أمان إضافية لحسابك
                  </p>
                </div>
                <Switch
                  checked={security.two_factor}
                  onCheckedChange={(checked) =>
                    setSecurity({ ...security, two_factor: checked })
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-danger/20 bg-danger/5 p-5">
              <h3 className="text-sm font-black text-danger mb-2 flex items-center gap-2">
                <LogOut size={16} /> منطقة الخطر
              </h3>
              <p className="text-sm text-muted mb-4">
                هذه الإجراءات لا يمكن التراجع عنها
              </p>
              <Button variant="danger" className="w-full">
                تسجيل الخروج من جميع الأجهزة
              </Button>
            </div>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-4">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                <Palette size={16} className="text-primary" /> السمة
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "light", label: "فاتح", icon: Sun },
                  { value: "dark", label: "داكن", icon: Moon },
                  { value: "system", label: "النظام", icon: Wifi },
                ].map((theme) => (
                  <button
                    key={theme.value}
                    onClick={() =>
                      setAppearance({ ...appearance, theme: theme.value })
                    }
                    className={cn(
                      "p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
                      appearance.theme === theme.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <theme.icon
                      size={24}
                      className={cn(
                        appearance.theme === theme.value
                          ? "text-primary"
                          : "text-muted",
                      )}
                    />
                    <span className="font-black text-sm">{theme.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                <Settings size={16} className="text-primary" /> تفضيلات الواجهة
              </h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl border border-border hover:bg-soft transition-colors">
                  <div>
                    <p className="font-black text-main">الوضع المدمج</p>
                    <p className="text-xs text-muted">
                      تقليل المسافات لعرض محتوى أكثر
                    </p>
                  </div>
                  <Switch
                    checked={appearance.compact_mode}
                    onCheckedChange={(checked) =>
                      setAppearance({ ...appearance, compact_mode: checked })
                    }
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl border border-border hover:bg-soft transition-colors">
                  <div>
                    <p className="font-black text-main">الرسوم المتحركة</p>
                    <p className="text-xs text-muted">
                      تفعيل انتقالات وتأثيرات الحركة
                    </p>
                  </div>
                  <Switch
                    checked={appearance.animations}
                    onCheckedChange={(checked) =>
                      setAppearance({ ...appearance, animations: checked })
                    }
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl border border-border hover:bg-soft transition-colors">
                  <div>
                    <p className="font-black text-main">الأصوات</p>
                    <p className="text-xs text-muted">
                      أصوات التنبيهات والتفاعلات
                    </p>
                  </div>
                  <Switch
                    checked={appearance.sound}
                    onCheckedChange={(checked) =>
                      setAppearance({ ...appearance, sound: checked })
                    }
                  />
                </label>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BarberProfile;
