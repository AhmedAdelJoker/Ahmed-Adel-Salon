import { useAuth } from "@/context/AuthContext";
import { PageShell } from "@/components/shared/PageShell";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Shield, Palette, ArrowLeft } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { staticURL } from "@/services/api";
import { validateImageSize } from "@/lib/media/upload";
import { adaptObject } from "@/services/apiAdapter";
import { ProfileTab } from "@/features/barber-profile";
import { NotificationsTab } from "@/features/barber-profile";
import { SecurityTab } from "@/features/barber-profile";
import { AppearanceTab } from "@/features/barber-profile";
import type {
  BarberProfileForm,
  NotificationsState,
  SecurityState,
  AppearanceState,
} from "@/features/barber-profile/types";

const BarberProfile = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const [profile, setProfile] = useState<BarberProfileForm>({
    full_name: (user?.full_name as string) || "",
    phone: ((user as unknown as Record<string, unknown>)?.phone as string) || "",
    email: (user?.email as string) || "",
    address: "",
    bio: "",
    commission_rate: Number((user as unknown as Record<string, unknown>)?.commission_rate) || 15,
    avatar_url: ((user as unknown as Record<string, unknown>)?.avatar_url as string) || "",
  });

  const [notifications, setNotifications] = useState<NotificationsState>({
    new_appointment: true,
    appointment_reminder: true,
    appointment_cancelled: true,
    shift_reminder: true,
    tips: true,
    marketing: false,
  });

  const [security, setSecurity] = useState<SecurityState>({
    current_password: "",
    new_password: "",
    confirm_password: "",
    two_factor: false,
  });

  const [appearance, setAppearance] = useState<AppearanceState>({
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

  /**
   * Upload the barber's own photo.
   *
   * This was `FileReader.readAsDataURL` and nothing else: the preview was
   * shown, the save sent no image field, and the data URL was thrown away — so
   * picking a photo appeared to work and changed nothing. It now posts the file
   * and stores the path the server gives back.
   */
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateImageSize(file)) {
      e.target.value = "";
      return;
    }

    // Instant local preview so the barber sees their pick immediately.
    const localPreview = URL.createObjectURL(file);
    setAvatarPreview(localPreview);
    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/barbers/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.url;
      if (!url) throw new Error("لم يتم إرجاع رابط الصورة من الخادم");

      setProfile((prev) => ({ ...prev, avatar_url: url }));
      // Swap the blob preview for the stored path, cache-busted so a re-upload
      // of the same bytes is not served from cache.
      const resolved = url.startsWith("http") ? url : `${staticURL}${url}`;
      setAvatarPreview(`${resolved}${resolved.includes("?") ? "&" : "?"}t=${Date.now()}`);
      await refreshUser();
      toast.success("تم رفع الصورة بنجاح");
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
      const msg = apiErr?.response?.data?.detail || apiErr?.message || "فشل رفع الصورة";
      toast.error(String(msg));
      setAvatarPreview(null);
    } finally {
      setAvatarLoading(false);
      URL.revokeObjectURL(localPreview);
      e.target.value = "";
    }
  };

  return (
    <div>
      <PageShell contained>
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-card border border-border p-1">
            <TabsTrigger
              value="profile"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <User size={14} className="ms-1.5" /> الملف الشخصي
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <Bell size={14} className="ms-1.5" /> الإشعارات
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <Shield size={14} className="ms-1.5" /> الأمان
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <Palette size={14} className="ms-1.5" /> المظهر
            </TabsTrigger>
          </TabsList>

          <ProfileTab
            profile={profile}
            setProfile={setProfile}
            avatarPreview={avatarPreview}
            avatarLoading={avatarLoading}
            onAvatarChange={handleAvatarChange}
            loading={loading}
            onSaveProfile={handleSaveProfile}
            onLoadProfile={loadProfile}
            user={user}
          />
          <NotificationsTab
            notifications={notifications}
            setNotifications={setNotifications}
            onSaveNotifications={handleSaveNotifications}
          />
          <SecurityTab
            security={security}
            setSecurity={setSecurity}
            onSaveSecurity={handleSaveSecurity}
          />
            <AppearanceTab appearance={appearance} setAppearance={setAppearance} />
          </Tabs>
      </PageShell>
    </div>
  );
};
export default BarberProfile;
