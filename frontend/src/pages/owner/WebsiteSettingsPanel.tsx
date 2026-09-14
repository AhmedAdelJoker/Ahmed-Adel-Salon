import {
  Globe,
  Layout,
  Image as ImageIcon,
  Share2,
  Plus,
  Trash2,
  Save,
  Activity,
  Facebook,
  Instagram,
  Youtube,
  Music2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { Input } from "@/components/ui/input";
import { AnimatePresence } from "framer-motion";
import { staticURL } from "@/services/api";
import type { LucideIcon } from "lucide-react";
import { useWebsiteSettings } from "@/features/website-settings";

const TAB_ICONS: Record<string, LucideIcon> = {
  content: Layout,
  sections: Globe,
  portfolio: ImageIcon,
  social: Share2,
};

const WebsiteSettingsPanel = ({ onSaved, onChangeDraft }) => {
  const {
    loading,
    saving,
    activeSubTab,
    setActiveSubTab,
    settings,
    setSettings,
    updateField,
    handleSaveSettings,
    handleAddPortfolioImage,
    handleCoverImageUpload,
    removeCoverImage,
    removePortfolioImage,
    updateArrayItem,
    SUB_TABS,
  } = useWebsiteSettings({ onSaved, onChangeDraft });

  const activeTabMeta =
    SUB_TABS.find((tab) => tab.id === activeSubTab) || SUB_TABS[0];
  const ActiveTabIcon = TAB_ICONS[activeTabMeta.id] || Layout;
  const overviewCards: { label: string; value: string; hint: string }[] = [
    {
      label: "العرض الرئيسي",
      value: settings.landingCoverImageUrl ? "غلاف جاهز" : "بدون غلاف",
      hint: settings.landingCoverImageUrl
        ? "صورة مستقلة للواجهة الرئيسية"
        : "ارفع صورة Hero مستقلة للموقع",
    },
    {
      label: "المعرض",
      value: `${settings.landingPortfolio.length}`,
      hint: "عدد الصور الحالية في صفحة العميل",
    },
    {
      label: "روابط التواصل",
      value: `${
        [
          settings.socialFacebook,
          settings.socialInstagram,
          settings.socialTiktok,
          settings.socialYoutube,
        ].filter(Boolean).length
      }/4`,
      hint: "عدد القنوات المفعلة حاليًا",
    },
    {
      label: "شارات الثقة",
      value: `${settings.landingTrustBadges.filter((item) => item.label).length}/3`,
      hint: "النصوص المختصرة أسفل الصفحة",
    },
    {
      label: "التقييمات",
      value: `${settings.landingTestimonials.filter((item) => item.quote).length}/3`,
      hint: "عدد شهادات العملاء المفعلة",
    },
  ];

  if (loading)
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Activity className="h-10 w-10 animate-pulse text-accent" />
      </div>
    );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewCards.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md"
          >
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-accent">
              {item.label}
            </p>
            <h4 className="mt-2 text-lg font-black text-main">{item.value}</h4>
            <p className="mt-1 text-[10px] font-bold text-muted">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 text-accent rounded-xl">
            <ActiveTabIcon size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-main uppercase tracking-widest">
              {activeTabMeta.label}
            </h3>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {activeTabMeta.description}
            </p>
          </div>
        </div>
        <div className="flex bg-soft p-1 rounded-xl border border-border">
          {SUB_TABS.map((tab) => {
            const TabIcon = TAB_ICONS[tab.id] || Layout;
            return (
              <button
                key={tab.id}
                disabled={loading}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${
                  activeSubTab === tab.id
                    ? "bg-card text-accent shadow-sm border border-border"
                    : "text-muted hover:text-main"
                }`}
              >
                <TabIcon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === "content" && (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PremiumCard className="space-y-6">
                <SectionGroup title="القسم الرئيسي (Hero)" />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">
                      شارة أعلى الصفحة
                    </label>
                    <Input
                      value={settings.landingHeroBadge || ""}
                      onChange={(e) =>
                        updateField("landingHeroBadge", e.target.value)
                      }
                      className="h-11 bg-soft border-border font-bold rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">
                      العنوان الرئيسي
                    </label>
                    <Input
                      value={settings.landingHeroTitle || ""}
                      onChange={(e) =>
                        updateField("landingHeroTitle", e.target.value)
                      }
                      className="h-11 bg-soft border-border font-black rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">
                      الوصف الفرعي
                    </label>
                    <textarea
                      value={settings.landingHeroSubtitle || ""}
                      onChange={(e) =>
                        updateField("landingHeroSubtitle", e.target.value)
                      }
                      className="w-full min-h-[100px] rounded-xl bg-soft border border-border p-4 text-xs font-bold outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </PremiumCard>

              <PremiumCard className="space-y-6">
                <SectionGroup title="قسم من نحن (About)" />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">
                      عنوان القسم
                    </label>
                    <Input
                      value={settings.landingAboutTitle || ""}
                      onChange={(e) =>
                        updateField("landingAboutTitle", e.target.value)
                      }
                      className="h-11 bg-soft border-border font-bold rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">
                      المحتوى
                    </label>
                    <textarea
                      value={settings.landingAboutContent || ""}
                      onChange={(e) =>
                        updateField("landingAboutContent", e.target.value)
                      }
                      className="w-full min-h-[150px] rounded-xl bg-soft border border-border p-4 text-xs font-bold outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </PremiumCard>
            </div>
          </motion.div>
        )}
        {activeSubTab === "sections" && (
          <motion.div
            key="sections"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <PremiumCard className="space-y-10">
              <SectionGroup title="الإحصاءات الرئيسية">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {(settings.landingStats as { value?: string; label?: string; icon?: string; color?: string }[]).map((item, index) => (
                    <div
                      key={index}
                      className="space-y-3 rounded-2xl border border-border bg-soft/50 p-4"
                    >
                      <Input
                        value={item.value || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "landingStats",
                            index,
                            "value",
                            e.target.value,
                          )
                        }
                        className="h-10 bg-card border-border font-black text-sm rounded-xl"
                        placeholder="القيمة (مثال: 15k+)"
                      />
                      <Input
                        value={item.label || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "landingStats",
                            index,
                            "label",
                            e.target.value,
                          )
                        }
                        className="h-10 bg-card border-border font-bold text-xs rounded-xl"
                        placeholder="العنوان"
                      />
                    </div>
                  ))}
                </div>
              </SectionGroup>

              <SectionGroup title="مميزات المنشأة">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {(settings.landingFeatures as { title?: string; description?: string; icon?: string }[]).map((item, index) => (
                    <div
                      key={index}
                      className="space-y-3 rounded-2xl border border-border bg-soft/50 p-4"
                    >
                      <Input
                        value={item.title || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "landingFeatures",
                            index,
                            "title",
                            e.target.value,
                          )
                        }
                        className="h-10 bg-card border-border font-black text-sm rounded-xl"
                        placeholder="عنوان الميزة"
                      />
                      <textarea
                        value={item.description || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "landingFeatures",
                            index,
                            "description",
                            e.target.value,
                          )
                        }
                        className="min-h-[80px] w-full rounded-xl border border-border bg-card p-3 text-[11px] font-bold outline-none focus:border-accent"
                        placeholder="وصف مختصر"
                      />
                    </div>
                  ))}
                </div>
              </SectionGroup>

              <SectionGroup title="عناوين ونصوص الأقسام">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {(
                    [
                      ["landingServicesTitle", "عنوان الخدمات", false],
                      ["landingServicesSubtitle", "وصف الخدمات", true],
                      ["landingPortfolioTitle", "عنوان المعرض", false],
                      ["landingBookingTitle", "عنوان الحجز", false],
                      ["landingBookingSubtitle", "وصف الحجز", true],
                      ["landingLocationTitle", "عنوان الموقع", false],
                      ["landingContactTitle", "عنوان التواصل", false],
                    ] as [string, string, boolean][]
                  ).map(([key, label, multiline]) => (
                    <div key={key} className="space-y-2">
                      <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">
                        {label}
                      </label>
                      {multiline ? (
                        <textarea
                          value={String(settings[key] ?? "")}
                          onChange={(e) =>
                            updateField(key, e.target.value)
                          }
                          className="min-h-[80px] w-full rounded-xl border border-border bg-soft p-4 text-[11px] font-bold outline-none focus:border-accent"
                        />
                      ) : (
                        <Input
                          value={String(settings[key] ?? "")}
                          onChange={(e) =>
                            updateField(key, e.target.value)
                          }
                          className="h-11 bg-soft border-border font-bold rounded-xl"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </SectionGroup>
            </PremiumCard>
          </motion.div>
        )}
        {activeSubTab === "portfolio" && (
          <motion.div
            key="portfolio"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <PremiumCard className="space-y-8">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-border bg-soft/50 p-5">
                  <SectionGroup title="صورة الغلاف" />
                  <p className="text-xs font-bold leading-relaxed text-muted">
                    هذه الصورة تظهر كواجهة رئيسية في أول الشاشة داخل موقع المحل.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <label className="h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-6 text-[10px] font-black text-white shadow-lg flex">
                      <Plus size={14} />{" "}
                      {settings.landingCoverImageUrl
                        ? "استبدال الغلاف"
                        : "رفع الغلاف"}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleCoverImageUpload}
                      />
                    </label>
                    {settings.landingCoverImageUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={removeCoverImage}
                        className="text-danger border-danger/20 bg-danger/5 hover:bg-danger/10 text-[10px]"
                      >
                        <Trash2 size={14} className="ml-1" /> حذف
                      </Button>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border bg-soft aspect-video flex items-center justify-center">
                  {settings.landingCoverImageUrl ? (
                    <img
                      src={
                        settings.landingCoverImageUrl.startsWith("http")
                          ? settings.landingCoverImageUrl
                          : `${staticURL}${settings.landingCoverImageUrl}`
                      }
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-muted opacity-40">
                      <ImageIcon size={32} className="mx-auto mb-2" />
                      <p className="text-[10px] font-bold">
                        لا يوجد غلاف حالياً
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <SectionGroup title="معرض الأعمال" />
                  <label className="h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-6 text-[10px] font-black text-white shadow-lg flex">
                    <Plus size={14} /> إضافة صورة
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleAddPortfolioImage}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {settings.landingPortfolio.map((url, idx) => (
                    <div
                      key={idx}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-soft"
                    >
                      <img
                        src={
                          url.startsWith("http") ? url : `${staticURL}${url}`
                        }
                        className="h-full w-full object-cover transition-transform group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => removePortfolioImage(idx)}
                          className="h-8 w-8 rounded-full bg-danger text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </PremiumCard>
          </motion.div>
        )}
        {activeSubTab === "social" && (
          <motion.div
            key="social"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <PremiumCard>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {([
                  {
                    id: "socialFacebook",
                    label: "Facebook",
                    icon: Facebook,
                    color: "text-blue-600",
                  },
                  {
                    id: "socialInstagram",
                    label: "Instagram",
                    icon: Instagram,
                    color: "text-pink-600",
                  },
                  {
                    id: "socialTiktok",
                    label: "TikTok",
                    icon: Music2,
                    color: "text-slate-900 dark:text-white",
                  },
                  {
                    id: "socialYoutube",
                    label: "YouTube",
                    icon: Youtube,
                    color: "text-red-600",
                  },
                ] as { id: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }[]).map((social) => (
                  <div key={social.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <social.icon size={16} className={social.color} />
                      <label className="text-[9px] font-black text-muted uppercase tracking-widest">
                        {social.label}
                      </label>
                    </div>
                    <Input
                      value={String(settings[social.id] ?? "")}
                      onChange={(e) =>
                        updateField(social.id, e.target.value)
                      }
                      className="h-11 bg-soft border-border font-bold rounded-xl"
                      placeholder={`رابط حساب ${social.label}`}
                      dir="ltr"
                    />
                  </div>
                ))}
              </div>
            </PremiumCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSaveSettings}
          disabled={saving}
          variant="primary"
          className="px-16 h-14 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-soft hover:-translate-y-0.5 transition-all"
        >
          {saving ? "جاري الحفظ..." : "تأكيد بروتوكول الموقع"}{" "}
          <Save className="mr-2" size={16} />
        </Button>
      </div>
    </div>
  );
};

export default WebsiteSettingsPanel;

function SectionGroup({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-6 w-1 rounded-full bg-accent" />
        <h4 className="text-xs font-black uppercase tracking-widest text-main">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}
