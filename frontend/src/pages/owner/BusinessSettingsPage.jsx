import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Eye,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Monitor,
  MapPin,
  RefreshCw,
  Smartphone,
  Phone,
  Save,
  Settings,
  Sparkles,
  TextCursorInput,
  Share2,
  Download,
} from "lucide-react";
import { toast } from "react-hot-toast";
import CardShell from "../../components/common/CardShell";
import PanelHeader from "../../components/common/PanelHeader";
import Button from "../../components/common/Button";
import { businessSettingsService } from "../../services/businessSettingsService";
import {
  buildPublicBookingPath,
  buildPublicSalonPath,
  resolvePublicSlug,
} from "../../lib/publicSite";
import { writePublicSitePreviewDraft } from "../../lib/publicSitePreview";
import WebsiteSettingsPanel from "./WebsiteSettingsPanel";
import QRCode from "qrcode";
import { motion, AnimatePresence } from "framer-motion";

export default function BusinessSettingsPage({ embedded = false }) {
  const [form, setForm] = useState({
    salon_name: "",
    shop_phone: "",
    shop_whatsapp: "",
    address: "",
    logo_url: "",
    google_maps_url: "",
    receipt_footer: "",
    currency: "EGP",
    public_slug: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publicSiteQr, setPublicSiteQr] = useState("");
  const [publicBookingQr, setPublicBookingQr] = useState("");
  const [previewDevice, setPreviewDevice] = useState("desktop");
  const [previewTarget, setPreviewTarget] = useState("site");
  const [previewVersion, setPreviewVersion] = useState(0);
  const [contentDraft, setContentDraft] = useState({});
  const [publication, setPublication] = useState({
    snapshot: null,
    publishedAt: null,
    hasDraftChanges: false,
  });
  const [activeMainTab, setActiveMainTab] = useState("share");
  const [publicSiteBaseUrl, setPublicSiteBaseUrl] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("public_site_base_url");
      if (stored) return stored;
      
      // Default to port 3000 on local machines, otherwise window.location.origin
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        return `${window.location.protocol}//${window.location.hostname}:3000`;
      }
      return window.location.origin;
    }
    return "";
  });

  useEffect(() => {
    if (typeof window !== "undefined" && publicSiteBaseUrl) {
      localStorage.setItem("public_site_base_url", publicSiteBaseUrl);
    }
  }, [publicSiteBaseUrl]);

  const cleanBaseUrl = publicSiteBaseUrl.replace(/\/+$/, "");

  const draftPublicSitePath = buildPublicSalonPath(form);
  const draftPublicBookingPath = buildPublicBookingPath(form);
  const publishedReference = publication.snapshot || form;
  const publishedPublicSitePath = buildPublicSalonPath(publishedReference);
  const publishedPublicBookingPath = buildPublicBookingPath(publishedReference);
  const draftPublicSiteUrl = `${cleanBaseUrl}${draftPublicSitePath}`;
  const draftPublicBookingUrl = `${cleanBaseUrl}${draftPublicBookingPath}`;
  const publishedPublicSiteUrl = `${cleanBaseUrl}${publishedPublicSitePath}`;
  const publishedPublicBookingUrl = `${cleanBaseUrl}${publishedPublicBookingPath}`;
  const sharedPublicSiteUrl = publication.publishedAt
    ? publishedPublicSiteUrl
    : draftPublicSiteUrl;
  const sharedPublicBookingUrl = publication.publishedAt
    ? publishedPublicBookingUrl
    : draftPublicBookingUrl;

  const [customPublicSiteUrl, setCustomPublicSiteUrl] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("custom_public_site_url") || "";
    }
    return "";
  });

  const [customPublicBookingUrl, setCustomPublicBookingUrl] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("custom_public_booking_url") || "";
    }
    return "";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("custom_public_site_url", customPublicSiteUrl);
    }
  }, [customPublicSiteUrl]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("custom_public_booking_url", customPublicBookingUrl);
    }
  }, [customPublicBookingUrl]);

  const finalPublicSiteUrl = customPublicSiteUrl || sharedPublicSiteUrl;
  const finalPublicBookingUrl = customPublicBookingUrl || sharedPublicBookingUrl;
  const setupChecklist = useMemo(
    () => [
      {
        label: "بيانات المحل",
        done: Boolean(form.salon_name && form.shop_phone && form.address),
        hint: "الاسم، الهاتف، والعنوان",
        icon: Phone,
      },
      {
        label: "الرابط العام",
        done: Boolean(form.public_slug),
        hint: "Slug جاهز للمشاركة",
        icon: Globe,
      },
      {
        label: "الخريطة",
        done: Boolean(form.google_maps_url || form.address),
        hint: "رابط مباشر أو عنوان واضح",
        icon: MapPin,
      },
      {
        label: "الحجز العام",
        done: Boolean(draftPublicBookingUrl),
        hint: "رابط يعمل للعملاء",
        icon: Sparkles,
      },
    ],
    [
      form.address,
      form.google_maps_url,
      form.public_slug,
      form.salon_name,
      form.shop_phone,
      draftPublicBookingUrl,
    ],
  );
  const completedChecklistCount = setupChecklist.filter((item) => item.done).length;
  const previewDraft = useMemo(
    () => ({
      ...contentDraft,
      salonName: form.salon_name,
      salon_name: form.salon_name,
      shopPhone: form.shop_phone,
      shop_phone: form.shop_phone,
      shopWhatsApp: form.shop_whatsapp,
      shop_whatsapp: form.shop_whatsapp,
      address: form.address,
      logoUrl: form.logo_url,
      logo_url: form.logo_url,
      receiptFooter: form.receipt_footer,
      receipt_footer: form.receipt_footer,
      currency: form.currency,
      publicSlug: form.public_slug,
      public_slug: form.public_slug,
      googleMapsUrl: form.google_maps_url,
      google_maps_url: form.google_maps_url,
    }),
    [contentDraft, form],
  );
  const previewBaseUrl =
    previewTarget === "booking" ? finalPublicBookingUrl : finalPublicSiteUrl;
  const previewUrl = `${previewBaseUrl}${
    previewBaseUrl.includes("?") ? "&" : "?"
  }livePreview=1&preview=${previewVersion}`;
  const publicationStatus = useMemo(() => {
    if (!publication.publishedAt) {
      return {
        label: "مسودة فقط",
        tone: "amber",
        description:
          "العميل يرى النسخة الحالية مباشرة حتى أول نشر، وبعد أول نشر ستبقى أي تعديلات لاحقة داخل المسودة إلى أن تنشرها.",
        buttonLabel: "نشر الموقع لأول مرة",
      };
    }

    if (publication.hasDraftChanges) {
      return {
        label: "تحديثات غير منشورة",
        tone: "amber",
        description:
          "هناك تغييرات محفوظة داخل لوحة التحكم لكنها لم تظهر بعد للعميل. المعاينة تعرض المسودة، والرابط العام يعرض آخر نسخة منشورة.",
        buttonLabel: "تحديث النسخة المنشورة",
      };
    }

    return {
      label: "منشور",
      tone: "emerald",
      description:
        "الرابط العام وQR يعرضان النسخة المنشورة الحالية، ولا توجد الآن تغييرات محفوظة بانتظار النشر.",
      buttonLabel: "إعادة نشر الموقع",
    };
  }, [publication.hasDraftChanges, publication.publishedAt]);
  const canPublish = !loading && !saving && !publishing && (!publication.publishedAt || publication.hasDraftChanges);
  const lastPublishedLabel = useMemo(() => {
    if (!publication.publishedAt) {
      return "لم يتم النشر بعد";
    }

    try {
      return new Intl.DateTimeFormat("ar-EG", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(publication.publishedAt));
    } catch (dateError) {
      console.error("Failed to format published date", dateError);
      return publication.publishedAt;
    }
  }, [publication.publishedAt]);

  const scrollToBlock = (id) => {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const refreshPreview = () => {
    setPreviewVersion((current) => current + 1);
  };

  useEffect(() => {
    let mounted = true;

    const generateQrs = async () => {
      try {
        const [siteQr, bookingQr] = await Promise.all([
          QRCode.toDataURL(finalPublicSiteUrl, {
            margin: 1,
            width: 220,
            color: {
              dark: "#17110e",
              light: "#0000",
            },
          }),
          QRCode.toDataURL(finalPublicBookingUrl, {
            margin: 1,
            width: 220,
            color: {
              dark: "#17110e",
              light: "#0000",
            },
          }),
        ]);

        if (!mounted) return;
        setPublicSiteQr(siteQr);
        setPublicBookingQr(bookingQr);
      } catch (qrError) {
        console.error("Failed to generate QR codes", qrError);
      }
    };

    generateQrs();

    return () => {
      mounted = false;
    };
  }, [finalPublicBookingUrl, finalPublicSiteUrl]);

  useEffect(() => {
    writePublicSitePreviewDraft(previewDraft);
  }, [previewDraft]);

  const syncSettingsState = (data) => {
    setForm({
      salon_name: data?.salon_name || data?.salonName || "",
      shop_phone: data?.shop_phone || data?.shopPhone || "",
      shop_whatsapp: data?.shop_whatsapp || data?.shopWhatsApp || "",
      address: data?.address || "",
      logo_url: data?.logo_url || data?.logoUrl || "",
      google_maps_url: data?.google_maps_url || data?.googleMapsUrl || "",
      receipt_footer: data?.receipt_footer || data?.receiptFooter || "",
      currency: data?.currency || "EGP",
      public_slug:
        data?.public_slug || data?.publicSlug || resolvePublicSlug(data),
    });
    setPublication({
      snapshot: data?.public_site_snapshot || data?.publicSiteSnapshot || null,
      publishedAt:
        data?.public_site_published_at || data?.publicSitePublishedAt || null,
      hasDraftChanges: Boolean(
        data?.public_site_has_draft_changes || data?.publicSiteHasDraftChanges,
      ),
    });
  };

  async function loadSettings(options = {}) {
    if (!options.silent) {
      setLoading(true);
    }
    setError("");

    try {
      const data = await businessSettingsService.get();
      syncSettingsState(data);
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل إعدادات المحل");
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {

    loadSettings();
  }, []);

  async function handleCopyLink(url, label) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage(`تم نسخ ${label} بنجاح`);
      setError("");
      toast.success(`تم نسخ ${label}`);
    } catch (err) {
      console.error(err);
      setError(`تعذر نسخ ${label}`);
      toast.error(`تعذر نسخ ${label}`);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const normalizedSlug = resolvePublicSlug(form);
      const data = await businessSettingsService.update({
        salonName: form.salon_name,
        shopPhone: form.shop_phone,
        shopWhatsApp: form.shop_whatsapp,
        address: form.address,
        receiptFooter: form.receipt_footer,
        currency: form.currency,
        googleMapsUrl: form.google_maps_url,
        publicSlug: normalizedSlug,
      });
      syncSettingsState(data);
      setForm((prev) => ({ ...prev, public_slug: normalizedSlug }));
      setMessage("تم حفظ بيانات الموقع كمسودة. انشرها لتظهر للعميل.");
      refreshPreview();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "تعذر حفظ إعدادات المحل");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setError("");
    setMessage("");

    try {
      const data = await businessSettingsService.publishSite();
      syncSettingsState(data);
      setMessage("تم نشر الموقع العام بنجاح، والروابط الآن تعرض آخر نسخة منشورة.");
      toast.success("تم نشر الموقع");
      refreshPreview();
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail || "تعذر نشر الموقع الآن";
      setError(detail);
      toast.error("تعذر نشر الموقع");
    } finally {
      setPublishing(false);
    }
  }

  async function handleWebsiteSettingsSaved() {
    refreshPreview();
    setMessage("تم حفظ محتوى الصفحة كمسودة. انشر التغييرات عندما تكون جاهزة.");
    setError("");
    await loadSettings({ silent: true });
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setUploadingLogo(true);
    setError("");
    setMessage("");

    try {
      const data = await businessSettingsService.uploadLogo(formData);
      syncSettingsState(data);
      setMessage("تم رفع اللوجو بنجاح وحفظه ضمن المسودة الحالية.");
      toast.success("تم رفع اللوجو");
      refreshPreview();
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail || "تعذر رفع اللوجو";
      setError(detail);
      toast.error("تعذر رفع اللوجو");
    } finally {
      e.target.value = "";
      setUploadingLogo(false);
    }
  }

  const MAIN_TABS = useMemo(() => [
    { id: "share", label: "المشاركة والنشر", icon: Share2 },
    { id: "profile", label: "بيانات الصالون الأساسية", icon: Settings },
    { id: "website", label: "محتوى وتصميم الموقع", icon: Globe },
    { id: "preview", label: "المعاينة التفاعلية", icon: Eye },
  ], []);

  const content = (
    <div className={embedded ? "space-y-4" : "app-limit space-y-4"}>
      <CardShell strong>
        <div className="flex flex-col gap-4 border-b border-white/5 pb-6 xl:flex-row xl:items-center xl:justify-between">
          <PanelHeader
            icon={<Settings size={22} className="text-amber-400" />}
            title="الموقع العام والحجز"
            subtitle="إدارة وتصميم ونشر موقع صالونك الفاخر وتحديث هويتك الرقمية."
            stats={`${completedChecklistCount}/${setupChecklist.length} جاهز`}
          />
          <div className="flex items-center gap-2.5 rounded-full bg-white/[0.02] border border-white/5 px-4 py-2 self-start xl:self-center">
            <span className={`h-2 w-2 rounded-full ${publication.hasDraftChanges ? "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"}`} />
            <span className="text-[11px] font-black text-slate-300">
              {publication.hasDraftChanges ? "يوجد تعديلات غير منشورة بالمسودة" : "الموقع العام متزامن ومنشور"}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
          {setupChecklist.map((item) => (
            <StatusTile
              key={item.label}
              title={item.label}
              hint={item.hint}
              done={item.done}
              icon={item.icon}
            />
          ))}
        </div>

        {/* Main Tab Switcher */}
        <div className="mt-6 flex flex-wrap gap-2 rounded-2xl bg-black/40 border border-white/5 p-1.5" dir="rtl">
          {MAIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeMainTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveMainTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-[#d3a15c]/25 to-[#d3a15c]/5 text-[#d3a15c] border border-[#d3a15c]/20 shadow-lg shadow-[#d3a15c]/5 font-extrabold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.01]"
                }`}
              >
                <Icon size={14} className="ml-1" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            {activeMainTab === "share" && (
            <motion.div
              key="share"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Publication Status Card */}
              <div className="rounded-3xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 shadow-inner">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-2xl">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
                        publicationStatus.tone === "emerald"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${publicationStatus.tone === "emerald" ? "bg-emerald-400" : "bg-amber-400"}`} />
                      {publicationStatus.label}
                    </div>
                    <h3 className="mt-4 text-lg font-black text-slate-100">
                      مزامنة ونشر تحديثات الموقع
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-slate-400">
                      {publicationStatus.description}
                    </p>
                    <p className="mt-3 text-[11px] font-bold text-slate-500">
                      آخر نشر معتمد للعملاء: {lastPublishedLabel}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 xl:min-w-[280px]">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handlePublish}
                      disabled={!canPublish}
                      className="w-full py-3.5 shadow-lg shadow-amber-400/5 hover:scale-[1.01]"
                    >
                      <Globe size={16} />
                      {publishing ? "جارٍ نشر وتحديث الموقع..." : publicationStatus.buttonLabel}
                    </Button>
                    <p className="text-[11px] leading-6 text-slate-500">
                      * الروابط العامة المفتوحة للعملاء تعتمد فقط على آخر نسخة منشورة، وتتجاهل المسودات غير المحفوظة.
                    </p>
                  </div>
                </div>
              </div>

              {/* Dynamic Base URL Card */}
              <div className="rounded-3xl border border-white/[0.04] bg-[#181512]/60 backdrop-blur-md p-6 shadow-xl space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" dir="rtl">
                  <div>
                    <h4 className="text-base font-black text-slate-100 flex items-center gap-2">
                      <Globe size={18} className="text-[#d3a15c]" />
                      عنوان سيرفر الموقع العام (Domain Base URL)
                    </h4>
                    <p className="mt-1.5 text-xs font-medium text-slate-400">
                      حدد السيرفر المستضيف للموقع العام لتحديث روابط العملاء ورموز الـ QR فوراً.
                    </p>
                  </div>
                </div>

                {/* Domain presets pills */}
                <div className="flex flex-wrap gap-2" dir="rtl">
                  <button
                    type="button"
                    onClick={() => {
                      setPublicSiteBaseUrl("http://localhost:3000");
                      toast.success("تم ضبط العنوان على الموقع العام المحلي (Port 3000)");
                    }}
                    className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all border ${
                      publicSiteBaseUrl === "http://localhost:3000"
                        ? "bg-[#d3a15c]/10 text-[#d3a15c] border-[#d3a15c]/35 shadow-lg shadow-[#d3a15c]/5"
                        : "bg-black/30 text-slate-400 border-white/5 hover:border-[#d3a15c]/25 hover:text-slate-200"
                    }`}
                  >
                    بورت 3000 (المحلي التلقائي)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        setPublicSiteBaseUrl(window.location.origin);
                        toast.success("تم ضبط العنوان على رابط السيرفر الحالي");
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all border ${
                      typeof window !== "undefined" && publicSiteBaseUrl === window.location.origin
                        ? "bg-[#d3a15c]/10 text-[#d3a15c] border-[#d3a15c]/35 shadow-lg shadow-[#d3a15c]/5"
                        : "bg-black/30 text-slate-400 border-white/5 hover:border-[#d3a15c]/25 hover:text-slate-200"
                    }`}
                  >
                    رابط لوحة التحكم الحالية ({typeof window !== "undefined" ? window.location.port : ""})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPublicSiteBaseUrl("https://salon-management-pro.com");
                      toast.success("تم ضبط عنوان تجريبي مخصص");
                    }}
                    className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all border ${
                      publicSiteBaseUrl === "https://salon-management-pro.com"
                        ? "bg-[#d3a15c]/10 text-[#d3a15c] border-[#d3a15c]/35 shadow-lg shadow-[#d3a15c]/5"
                        : "bg-black/30 text-slate-400 border-white/5 hover:border-[#d3a15c]/25 hover:text-slate-200"
                    }`}
                  >
                    رابط إنتاج تجريبي (Production)
                  </button>
                </div>

                <div className="relative group">
                  <input
                    type="text"
                    value={publicSiteBaseUrl}
                    onChange={(e) => setPublicSiteBaseUrl(e.target.value)}
                    placeholder="مثال: http://localhost:3000"
                    dir="ltr"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-xs text-slate-200 placeholder-slate-600 focus:border-[#d3a15c]/50 focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              {/* Public Link Cards Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                <PublicLinkCard
                  title="رابط صفحة التعريف بالمحل"
                  description="رابط منفصل قابل للمشاركة للعملاء لفتح الصفحة التعريفية للمحل مباشرة."
                  url={finalPublicSiteUrl}
                  placeholderUrl={sharedPublicSiteUrl}
                  isCustom={Boolean(customPublicSiteUrl)}
                  onUrlChange={setCustomPublicSiteUrl}
                  statusLabel={publication.publishedAt ? "الرابط المنشور حاليًا" : "الرابط التلقائي المعتمد"}
                  onCopy={() => handleCopyLink(finalPublicSiteUrl, "رابط صفحة المحل")}
                  qrCode={publicSiteQr}
                />
                <PublicLinkCard
                  title="رابط الحجز المباشر"
                  description="رابط حجز سريع ومباشر للعملاء لحجز موعد في نفس صالونك."
                  url={finalPublicBookingUrl}
                  placeholderUrl={sharedPublicBookingUrl}
                  isCustom={Boolean(customPublicBookingUrl)}
                  onUrlChange={setCustomPublicBookingUrl}
                  statusLabel={publication.publishedAt ? "الرابط المنشور حاليًا" : "الرابط التلقائي المعتمد"}
                  onCopy={() => handleCopyLink(finalPublicBookingUrl, "رابط الحجز")}
                  qrCode={publicBookingQr}
                />
              </div>
            </motion.div>
          )}

          {activeMainTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              {loading ? (
                <div className="flex h-44 items-center justify-center text-slate-400">
                  <RefreshCw size={24} className="animate-spin text-amber-400" />
                  <span className="mr-3 font-bold">جاري تحميل بيانات الصالون...</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Brand Logo Card */}
                  <div className="rounded-3xl border border-white/5 bg-white/[0.01] p-5 shadow-inner">
                    <div className="grid gap-5 lg:grid-cols-[240px_1fr] lg:items-center">
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] flex items-center justify-center h-44 w-full">
                        {form.logo_url ? (
                          <img
                            src={form.logo_url}
                            alt={form.salon_name || "Logo"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                            <ImageIcon size={32} className="opacity-30" />
                            <p className="text-xs font-bold">لا يوجد شعار مرفوع</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d3a15c]">هوية الصالون</span>
                        <h4 className="text-base font-black text-slate-100">لوجو الصالون الرسمي</h4>
                        <p className="text-xs leading-relaxed text-slate-400">
                          يظهر الشعار في الهيدر العلوي للموقع العام ولدى العملاء، كما يدرج تلقائياً في فواتير وعقود النظام.
                        </p>
                        <div className="pt-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#d3a15c] hover:bg-[#e9dcd0] hover:text-zinc-950 text-zinc-950 px-5 py-3 text-xs font-black transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#d3a15c]/10">
                            <ImageIcon size={14} />
                            {uploadingLogo ? "جاري الرفع للشركة..." : "رفع أو استبدال الشعار"}
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              disabled={uploadingLogo}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Profile Form Details */}
                  <div className="rounded-3xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 shadow-inner space-y-6">
                    <h3 className="text-sm font-black text-slate-200 border-b border-white/5 pb-3">المعلومات والبيانات الأساسية</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="اسم الصالون">
                        <input
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-200 focus:border-[#d3a15c]/50 focus:outline-none transition-all"
                          value={form.salon_name || ""}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              salon_name: e.target.value,
                            }))
                          }
                          placeholder="مثال: صالون العناية بالرجل"
                        />
                      </Field>

                      <Field label="العملة الافتراضية">
                        <input
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-200 focus:border-[#d3a15c]/50 focus:outline-none transition-all"
                          value={form.currency || ""}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, currency: e.target.value }))
                          }
                          placeholder="مثال: EGP أو ج.م"
                        />
                      </Field>

                      <Field label="رقم الهاتف الأساسي">
                        <input
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-200 focus:border-[#d3a15c]/50 focus:outline-none transition-all font-mono"
                          value={form.shop_phone || ""}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              shop_phone: e.target.value,
                            }))
                          }
                          dir="ltr"
                          placeholder="مثال: +20123456789"
                        />
                      </Field>

                      <Field label="رقم واتساب المحل">
                        <input
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-200 focus:border-[#d3a15c]/50 focus:outline-none transition-all font-mono"
                          value={form.shop_whatsapp || ""}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              shop_whatsapp: e.target.value,
                            }))
                          }
                          dir="ltr"
                          placeholder="مثال: +20123456789"
                        />
                      </Field>

                      <div className="md:col-span-2">
                        <Field label="رابط Google Maps للموقع">
                          <input
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-200 focus:border-[#d3a15c]/50 focus:outline-none transition-all font-mono"
                            value={form.google_maps_url || ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                google_maps_url: e.target.value,
                              }))
                            }
                            placeholder="https://maps.google.com/..."
                            dir="ltr"
                          />
                        </Field>
                      </div>

                      <div className="md:col-span-2">
                        <Field label="العنوان الجغرافي بالتفصيل">
                          <textarea
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-200 focus:border-[#d3a15c]/50 focus:outline-none transition-all min-h-[90px]"
                            value={form.address || ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                address: e.target.value,
                              }))
                            }
                            placeholder="مثال: شارع التسعين الشمالي، التجمع الخامس، القاهرة"
                          />
                        </Field>
                      </div>

                      <div className="md:col-span-2">
                        <Field label="نص ترويجي/شكر أسفل الفاتورة الورقية">
                          <textarea
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-200 focus:border-[#d3a15c]/50 focus:outline-none transition-all min-h-[90px]"
                            value={form.receipt_footer || ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                receipt_footer: e.target.value,
                              }))
                            }
                            placeholder="مثال: شكراً لزيارتكم! نسعد دائماً بخدمتكم."
                          />
                        </Field>
                      </div>

                      <div className="md:col-span-2">
                        <Field label="الرابط الفرعي التلقائي (Public Slug)">
                          <input
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-200 focus:border-[#d3a15c]/50 focus:outline-none transition-all font-mono"
                            value={form.public_slug || ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                public_slug: e.target.value,
                              }))
                            }
                            placeholder="my-luxury-salon"
                            dir="ltr"
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={saving}
                        className="px-8 py-3 hover:scale-[1.01]"
                      >
                        <Save size={15} />
                        {saving ? "جاري الحفظ كمسودة..." : "حفظ التغييرات بالمسودة"}
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </motion.div>
          )}

          {activeMainTab === "website" && (
            <motion.div
              key="website"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="rounded-3xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 shadow-inner animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <WebsiteSettingsPanel
                onSaved={handleWebsiteSettingsSaved}
                onChangeDraft={setContentDraft}
              />
            </motion.div>
          )}

          {activeMainTab === "preview" && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="rounded-3xl border border-white/5 bg-white/[0.01] p-5 shadow-inner">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                      <Eye size={16} className="text-[#d3a15c]" />
                      معاينة تفاعلية حية
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      قم بتبديل دقة العرض وتصفح المسودة الحالية لصالونك قبل اتخاذ قرار النشر النهائي.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <ToggleChip
                      active={previewTarget === "site"}
                      icon={Globe}
                      label="صفحة المحل"
                      onClick={() => setPreviewTarget("site")}
                    />
                    <ToggleChip
                      active={previewTarget === "booking"}
                      icon={Sparkles}
                      label="صفحة الحجز"
                      onClick={() => setPreviewTarget("booking")}
                    />
                    <div className="h-8 w-px bg-white/10 self-center hidden sm:block" />
                    <ToggleChip
                      active={previewDevice === "desktop"}
                      icon={Monitor}
                      label="ديسكتوب"
                      onClick={() => setPreviewDevice("desktop")}
                    />
                    <ToggleChip
                      active={previewDevice === "mobile"}
                      icon={Smartphone}
                      label="موبايل"
                      onClick={() => setPreviewDevice("mobile")}
                    />
                    <Button type="button" variant="secondary" className="py-2 px-3 text-xs" onClick={refreshPreview}>
                      <RefreshCw size={13} />
                      تحديث
                    </Button>
                  </div>
                </div>
                <div className="mt-3 text-[10px] font-mono text-slate-500 select-all truncate">
                  رابط المعاينة المباشر للمسودة: {previewBaseUrl}
                </div>
              </div>

              {/* Responsive Frame Simulator Mockup */}
              <div className="flex justify-center overflow-hidden rounded-[2.5rem] border border-white/5 bg-zinc-950/40 p-4 min-h-[500px]">
                {previewDevice === "mobile" ? (
                  /* Elegant iPhone Bezel simulator mockup */
                  <div className="relative mx-auto my-4 rounded-[3.2rem] border-[14px] border-zinc-900 bg-zinc-950 p-2 shadow-2xl transition-all duration-500 w-[385px] max-w-full">
                    {/* Speaker notch */}
                    <div className="absolute top-4 left-1/2 z-20 h-6 w-32 -translate-x-1/2 rounded-full bg-zinc-900 flex items-center justify-center gap-1.5">
                      <div className="h-1 w-12 rounded-full bg-zinc-800/80" />
                      <div className="h-2 w-2 rounded-full bg-zinc-800/80" />
                    </div>
                    {/* Screen */}
                    <div className="overflow-hidden rounded-[2.5rem] bg-[#0c0806] border border-white/5 relative">
                      <iframe
                        key={previewUrl}
                        title="معاينة الموقع العام"
                        src={previewUrl}
                        className="w-full border-0 h-[680px]"
                      />
                    </div>
                  </div>
                ) : (
                  /* Elegant Desktop browser mockup frame */
                  <div className="w-full rounded-[1.5rem] border border-white/10 bg-zinc-900/60 p-2.5 shadow-2xl transition-all duration-500">
                    <div className="flex items-center gap-1.5 px-3 pb-3 border-b border-white/5">
                      <div className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                      <span className="text-[10px] font-black text-slate-500 font-mono ml-4 truncate max-w-lg mr-2 select-all">
                        {previewBaseUrl}
                      </span>
                    </div>
                    <div className="overflow-hidden rounded-b-xl bg-[#0c0806] border-t border-black">
                      <iframe
                        key={previewUrl}
                        title="معاينة الموقع العام"
                        src={previewUrl}
                        className="w-full border-0 h-[760px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

        {/* Global Feedback Notifications */}
        {message ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-xs font-black text-emerald-300 animate-in fade-in duration-300">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-500/15 bg-rose-500/5 px-4 py-3 text-xs font-black text-rose-300 animate-in fade-in duration-300">
            {error}
          </div>
        ) : null}
      </CardShell>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mr-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusTile({ title, hint, done, icon: Icon }) {
  return (
    <div
      className={`rounded-3xl border p-5 transition-all duration-300 hover:translate-y-[-2px] ${
        done
          ? "border-emerald-500/20 bg-emerald-500/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_20px_rgba(0,0,0,0.2)]"
          : "border-white/5 bg-white/[0.01] shadow-inner"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-100">{title}</p>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
        <div
          className={`rounded-2xl p-3 transition-colors ${
            done
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-white/5 text-slate-400"
          }`}
        >
          <Icon size={18} />
        </div>
      </div>
      <div
        className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black ${
          done
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-white/5 text-slate-400"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
        {done ? "مكتمل" : "معلق"}
      </div>
    </div>
  );
}

function ActionChip({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-black text-slate-200 transition hover:border-amber-400/30 hover:text-amber-300"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function ToggleChip({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-black transition-all ${
        active
          ? "bg-amber-400 text-zinc-950 shadow-lg shadow-amber-400/20 hover:bg-amber-300"
          : "border border-white/10 bg-white/[0.02] text-slate-300 hover:border-amber-400/30 hover:text-amber-300"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function SectionBlock({ eyebrow, title, description, children }) {
  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.01] p-5 sm:p-7 shadow-inner">
      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-lg font-black text-slate-100">{title}</h3>
      <p className="mt-1 text-xs font-bold leading-relaxed text-slate-400">
        {description}
      </p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function PublicLinkCard({
  title,
  description,
  url,
  placeholderUrl,
  isCustom,
  onUrlChange,
  onCopy,
  qrCode,
  statusLabel,
}) {
  const [copying, setCopying] = useState(false);

  const handleCopy = async () => {
    onCopy();
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="rounded-3xl border border-white/[0.04] bg-[#181512]/60 backdrop-blur-md p-6 flex flex-col justify-between gap-5 transition-all shadow-xl hover:shadow-[#d3a15c]/5 hover:border-[#d3a15c]/10"
    >
      <div className="space-y-4">
        {/* Header Title and Icon */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-100 tracking-tight">{title}</h3>
            <p className="mt-1.5 text-xs font-medium text-slate-400 leading-normal">{description}</p>
          </div>
          <div className="rounded-2xl bg-[#d3a15c]/10 p-3 text-[#d3a15c] border border-[#d3a15c]/20">
            <Globe size={18} />
          </div>
        </div>

        {/* Dynamic vs Custom selector tab */}
        <div className="flex rounded-xl bg-black/40 p-1 border border-white/5" dir="rtl">
          <button
            type="button"
            onClick={() => onUrlChange("")}
            className={`flex-1 text-center py-2 px-3 rounded-lg text-[10px] font-black tracking-wider transition-all ${
              !isCustom
                ? "bg-[#d3a15c] text-zinc-950 shadow-md font-extrabold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            رابط ديناميكي (تلقائي)
          </button>
          <button
            type="button"
            onClick={() => onUrlChange(placeholderUrl)}
            className={`flex-1 text-center py-2 px-3 rounded-lg text-[10px] font-black tracking-wider transition-all ${
              isCustom
                ? "bg-[#d3a15c] text-zinc-950 shadow-md font-extrabold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            رابط مخصص (كوبي بيست)
          </button>
        </div>

        {/* Input box section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1" dir="rtl">
            <span className="text-[9px] font-black text-[#d3a15c] uppercase tracking-widest">
              {!isCustom ? "✓ ديناميكي نشط (يتغير بتغير السيرفر)" : "✏️ مخصص يدوي (ثابت)"}
            </span>
          </div>
          <div className="relative group">
            <input
              type="text"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder={placeholderUrl}
              disabled={!isCustom}
              dir="ltr"
              className={`w-full rounded-2xl border px-4 py-3.5 text-xs font-mono transition-all duration-300 ${
                !isCustom
                  ? "border-emerald-500/10 bg-emerald-500/[0.02] text-emerald-300/80 cursor-not-allowed"
                  : "border-white/10 bg-black/40 text-slate-200 focus:border-[#d3a15c]/50 focus:outline-none"
              }`}
            />
          </div>
        </div>

        {/* QR Code Segment */}
        <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-black/20 p-4 hover:border-[#d3a15c]/10 transition-colors" dir="rtl">
          <div className="relative group flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-inner">
            {qrCode ? (
              <img src={qrCode} alt={`QR ${title}`} className="h-full w-full" />
            ) : (
              <div className="text-center text-[10px] font-black text-slate-500">QR</div>
            )}
          </div>
          <div className="space-y-1 text-right">
            <p className="text-xs font-black text-slate-200">رمز QR للمشاركة المباشرة</p>
            <p className="text-[10px] leading-relaxed text-slate-400">
              مثالي للطباعة على كروت الصالون، الواجهات، أو الملصقات.
            </p>
            {qrCode && (
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-[#d3a15c] hover:text-[#e9dcd0] transition-colors"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = qrCode;
                  link.download = `${title}.png`;
                  link.click();
                  toast.success("تم بدء تحميل رمز QR");
                }}
              >
                <Download size={12} className="ml-1" />
                تحميل الرمز (PNG)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-2 flex flex-wrap gap-2.5 pt-2 border-t border-white/5" dir="rtl">
        <Button
          type="button"
          variant={copying ? "success" : "secondary"}
          onClick={handleCopy}
          className="flex-1 py-3 text-xs rounded-xl flex items-center justify-center gap-1.5 hover:scale-[1.01] transition-transform"
        >
          <Copy size={14} />
          {copying ? "تم النسخ!" : "نسخ الرابط"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => window.open(url || placeholderUrl, "_blank", "noopener,noreferrer")}
          className="flex-1 py-3 text-xs rounded-xl flex items-center justify-center gap-1.5 border border-white/5 hover:bg-white/5 hover:text-white"
        >
          <ExternalLink size={14} />
          فتح الرابط
        </Button>
      </div>
    </motion.div>
  );
}
