import * as React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Camera, Save, ArrowLeft } from "lucide-react";
import type { BarberProfileForm } from "@/features/barber-profile/types";
import type { AuthUser } from "@/context/AuthContext";

interface ProfileTabProps {
  profile: BarberProfileForm;
  setProfile: React.Dispatch<React.SetStateAction<BarberProfileForm>>;
  avatarPreview: string | null;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
  onSaveProfile: () => void | Promise<void>;
  onLoadProfile: () => void | Promise<void>;
  user: AuthUser | null;
}

export const ProfileTab = ({
  profile,
  setProfile,
  avatarPreview,
  onAvatarChange,
  loading,
  onSaveProfile,
  onLoadProfile,
  user,
}: ProfileTabProps) => {
  return (
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
                  onChange={onAvatarChange}
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
            <p className="text-sm text-muted">حلاق • {user?.role || "BARBER"}</p>
            <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-xs font-bold text-primary uppercase">معدل العمولة</p>
              <p className="text-2xl font-black text-primary">{profile.commission_rate}%</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
            <h4 className="font-black text-main mb-3">معلومات الحساب</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">المعرف</span>
                <span className="font-black">{String(user?.id ?? "")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">البريد</span>
                <span className="font-black">{profile.email || "غير محدد"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">الهاتف</span>
                <span className="font-black">{profile.phone || "غير محدد"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">الدور</span>
                <span className="font-black text-primary">{String(user?.role ?? "")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
            <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
              <User size={16} className="text-primary" /> المعلومات الشخصية
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  الاسم الكامل *
                </label>
                <Input
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
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
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
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
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
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
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
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
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  className="w-full h-24 rounded-xl border border-border bg-soft p-3 text-sm font-bold resize-none focus:border-primary focus:ring-0"
                  placeholder="اكتب نبذة مختصرة عن خبرتك وتخصصاتك..."
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" className="h-10 rounded-xl px-6" onClick={onLoadProfile}>
              <ArrowLeft size={14} className="ml-1.5" /> استعادة
            </Button>
            <Button onClick={onSaveProfile} loading={loading} className="h-10 rounded-xl px-6">
              <Save size={14} className="ml-1.5" /> حفظ التغييرات
            </Button>
          </div>
        </div>
      </div>
    </TabsContent>
  );
};
