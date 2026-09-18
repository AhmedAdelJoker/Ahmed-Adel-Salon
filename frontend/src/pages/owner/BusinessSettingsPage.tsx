import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Copy,
  Eye,
  ExternalLink,
  Globe,
  Monitor,
  RefreshCw,
  Smartphone,
  Share2,
  Download,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { businessSettingsService } from "@/services/businessSettingsService";
import {
  buildPublicBookingPath,
  buildPublicSalonPath,
  resolvePublicSlug,
} from "@/lib/site/publicSite";
import { writePublicSitePreviewDraft } from "@/lib/site/preview";
import WebsiteSettingsPanel from "@/pages/owner/WebsiteSettingsPanel";
import QRCode from "qrcode";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PremiumCard, PageHeader } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence } from "framer-motion";

export default function BusinessSettingsPage({ hideHeader = false }: { hideHeader?: boolean }) {
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
  const [activeMainTab, setActiveMainTab] = useState("website");
  const [publicSiteBaseUrl, setPublicSiteBaseUrl] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("public_site_base_url");
      if (stored) return stored;
      if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        return `${window.location.protocol}//${window.location.hostname}:3000`;
      }
      return window.location.origin;
    }
    return "";
  });

  const cleanBaseUrl = publicSiteBaseUrl.replace(/\/+$/, "");
  const draftPublicSiteUrl = `${cleanBaseUrl}${buildPublicSalonPath(form)}`;
  const draftPublicBookingUrl = `${cleanBaseUrl}${buildPublicBookingPath(form)}`;

  const sharedPublicSiteUrl = publication.publishedAt
    ? `${cleanBaseUrl}${buildPublicSalonPath(publication.snapshot || form)}`
    : draftPublicSiteUrl;

  const sharedPublicBookingUrl = publication.publishedAt
    ? `${cleanBaseUrl}${buildPublicBookingPath(publication.snapshot || form)}`
    : draftPublicBookingUrl;

  const [customPublicSiteUrl] = useState(() => {
    return (
      (typeof window !== "undefined" &&
        localStorage.getItem("custom_public_site_url")) ||
      ""
    );
  });

  const [customPublicBookingUrl] = useState(() => {
    return (
      (typeof window !== "undefined" &&
        localStorage.getItem("custom_public_booking_url")) ||
      ""
    );
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("custom_public_site_url", customPublicSiteUrl);
      localStorage.setItem("custom_public_booking_url", customPublicBookingUrl);
      localStorage.setItem("public_site_base_url", publicSiteBaseUrl);
    }
  }, [customPublicSiteUrl, customPublicBookingUrl, publicSiteBaseUrl]);

  const finalPublicSiteUrl = customPublicSiteUrl || sharedPublicSiteUrl;
  const finalPublicBookingUrl =
    customPublicBookingUrl || sharedPublicBookingUrl;

  const setupChecklist = useMemo(
    () => [
      {
        label: "هوية المحل",
        done: Boolean(form.salon_name && form.logo_url),
        hint: "الاسم والشعار",
      },
      {
        label: "رابط الوصول",
        done: Boolean(form.public_slug),
        hint: "Slug مخصص",
      },
      {
        label: "الموقع الجغرافي",
        done: Boolean(form.google_maps_url || form.address),
        hint: "خريطة أو عنوان",
      },
      {
        label: "محتوى الموقع",
        done: Object.keys(contentDraft).length > 0,
        hint: "النصوص والصور",
      },
    ],
    [form, contentDraft],
  );

  const completedCount = setupChecklist.filter((item) => item.done).length;

  useEffect(() => {
    writePublicSitePreviewDraft({
      ...contentDraft,
      ...form,
      salonName: form.salon_name,
      logoUrl: form.logo_url,
    });
  }, [contentDraft, form]);

  useEffect(() => {
    let mounted = true;
    const generateQrs = async () => {
      try {
        const [siteQr, bookingQr] = await Promise.all([
          QRCode.toDataURL(finalPublicSiteUrl, {
            margin: 1,
            width: 220,
            color: { dark: "#0f172a", light: "#0000" },
          }),
          QRCode.toDataURL(finalPublicBookingUrl, {
            margin: 1,
            width: 220,
            color: { dark: "#0f172a", light: "#0000" },
          }),
        ]);
        if (mounted) {
          setPublicSiteQr(siteQr);
          setPublicBookingQr(bookingQr);
        }
      } catch (_err) {
        console.error(_err);
      }
    };
    generateQrs();
    return () => {
      mounted = false;
    };
  }, [finalPublicBookingUrl, finalPublicSiteUrl]);

  const syncSettingsState = useCallback((data) => {
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
  }, []);

  const loadSettings = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) setLoading(true);
      try {
        const data = await businessSettingsService.get();
        syncSettingsState(data);
      } catch (_err) {
        toast.error("تعذر تحميل إعدادات الموقع");
      } finally {
        if (!options.silent) setLoading(false);
      }
    },
    [syncSettingsState],
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const data = await businessSettingsService.publishSite();
      syncSettingsState(data);
      toast.success("تم نشر التحديثات للجمهور");
      setPreviewVersion((v) => v + 1);
    } catch (_err) {
      toast.error("فشل نشر الموقع");
    } finally {
      setPublishing(false);
    }
  };

  const MAIN_TABS = [
    { id: "website", label: "محتوى الموقع", icon: Globe },
    { id: "share", label: "النشر والمشاركة", icon: Share2 },
    { id: "preview", label: "المعاينة الحية", icon: Eye },
  ];

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-accent" />
      </div>
    );

  return (
    <div className={hideHeader ? "space-y-6" : "erp-page space-y-6 pb-10"}>
      {!hideHeader && (
        <PageHeader
          title="الموقع العام والحجز"
          subtitle="إدارة هويتك الرقمية وتصميم تجربة العميل على الويب."
          badge="الموقع العام"
          icon={Globe}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={completedCount === 4 ? "success" : completedCount >= 2 ? "warning" : "secondary"} className="rounded-full h-11 px-4 font-black tabular-nums">
                {completedCount}/4 جاهزية
              </Badge>
              <Button
                onClick={handlePublish}
                disabled={publishing || !publication.hasDraftChanges}
                variant={publication.hasDraftChanges ? "primary" : "outline"}
                className="h-11 rounded-xl px-6 text-[11px] font-black"
                loading={publishing}
              >
                {publishing ? "جاري النشر..." : publication.hasDraftChanges ? "نشر التعديلات" : "الموقع محدث"}
              </Button>
            </div>
          }
        />
      )}

      <div className="flex gap-2 p-1.5 bg-soft rounded-2xl border border-border w-fit">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveMainTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${
              activeMainTab === tab.id
                ? "bg-card text-accent shadow-sm border border-border"
                : "text-muted hover:text-main"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeMainTab === "website" && (
          <motion.div
            key="website"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <WebsiteSettingsPanel
              embedded
              onSaved={() => setPreviewVersion((v) => v + 1)}
              onChangeDraft={setContentDraft}
            />
          </motion.div>
        )}

        {activeMainTab === "share" && (
          <motion.div
            key="share"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid gap-6 md:grid-cols-2"
          >
            <PublicLinkCard
              title="رابط الموقع التعريفي"
              url={finalPublicSiteUrl}
              qrCode={publicSiteQr}
              onCopy={() => {
                navigator.clipboard.writeText(finalPublicSiteUrl);
                toast.success("تم نسخ الرابط");
              }}
            />
            <PublicLinkCard
              title="رابط الحجز المباشر"
              url={finalPublicBookingUrl}
              qrCode={publicBookingQr}
              onCopy={() => {
                navigator.clipboard.writeText(finalPublicBookingUrl);
                toast.success("تم نسخ الرابط");
              }}
            />

            <PremiumCard wrapperClassName="md:col-span-2 min-w-0">
              <h4 className="text-xs font-black uppercase tracking-widest mb-4">
                إعدادات النطاق (Domain)
              </h4>
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <input
                  type="text"
                  value={publicSiteBaseUrl}
                  onChange={(e) => setPublicSiteBaseUrl(e.target.value)}
                  className="flex-1 h-12 rounded-xl bg-soft border border-border px-4 font-mono text-xs outline-none focus:border-accent"
                  dir="ltr"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPublicSiteBaseUrl("http://localhost:3000")
                    }
                  >
                    بورت 3000
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPublicSiteBaseUrl(window.location.origin)}
                  >
                    السيرفر الحالي
                  </Button>
                </div>
              </div>
            </PremiumCard>
          </motion.div>
        )}

        {activeMainTab === "preview" && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center bg-card p-4 rounded-2xl border border-border">
              <div className="flex gap-2">
                <Button
                  variant={previewTarget === "site" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setPreviewTarget("site")}
                >
                  الموقع
                </Button>
                <Button
                  variant={previewTarget === "booking" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setPreviewTarget("booking")}
                >
                  الحجز
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={previewDevice === "desktop" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setPreviewDevice("desktop")}
                >
                  <Monitor size={14} />
                </Button>
                <Button
                  variant={previewDevice === "mobile" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setPreviewDevice("mobile")}
                >
                  <Smartphone size={14} />
                </Button>
              </div>
            </div>
            <div className="rounded-[2.5rem] border border-border bg-slate-950 p-4 min-h-[600px] flex justify-center overflow-hidden">
              <iframe
                key={`${previewVersion}-${previewTarget}`}
                src={`${previewTarget === "site" ? finalPublicSiteUrl : finalPublicBookingUrl}?livePreview=1&v=${previewVersion}`}
                className={
                  previewDevice === "mobile"
                    ? "w-[375px] h-[667px] rounded-3xl border-8 border-slate-900"
                    : "w-full h-[700px] rounded-xl border-none"
                }
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PublicLinkCard({ title, url, qrCode, onCopy }: { title: string; url: string; qrCode: string; onCopy: () => void }) {
  return (
    <PremiumCard className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h3 className="text-lg font-black text-main">{title}</h3>
          <p
            className="text-[10px] font-bold text-muted tabular-nums"
            dir="ltr"
          >
            {url}
          </p>
        </div>
        <div className="p-2 bg-accent/10 text-accent rounded-xl">
          <Globe size={20} />
        </div>
      </div>

      <div className="flex items-center gap-4 bg-soft p-4 rounded-2xl border border-border">
        <div className="h-24 w-24 bg-white p-1 rounded-xl shrink-0">
          <img src={qrCode} alt="QR" className="w-full h-full" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted leading-relaxed">
            شارك هذا الرمز مع عملائك للوصول الفوري للخدمة.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-4 text-[10px]"
            onClick={() => {
              const a = document.createElement("a");
              a.href = qrCode;
              a.download = "qr.png";
              a.click();
            }}
          >
            <Download size={12} className="ml-1" /> تحميل QR
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={onCopy} className="flex-1 h-12 rounded-xl text-xs">
          <Copy size={14} className="ml-2" /> نسخ الرابط
        </Button>
        <Button
          variant="outline"
          onClick={() => window.open(url, "_blank")}
          className="h-12 w-12 rounded-xl p-0"
        >
          <ExternalLink size={16} />
        </Button>
      </div>
    </PremiumCard>
  );
}
