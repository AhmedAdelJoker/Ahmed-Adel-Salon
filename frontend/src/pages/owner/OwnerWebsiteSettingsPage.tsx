import { Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PremiumUI";
import WebsiteSettingsPanel from "@/pages/owner/WebsiteSettingsPanel";
import { useNavigate } from "react-router-dom";

export default function OwnerWebsiteSettingsPage() {
  const navigate = useNavigate();
  return (
    <div className="erp-page space-y-6 pb-10">
      <PageHeader
        title="إعدادات الموقع"
        subtitle="إدارة محتوى وصور الموقع العام — معاينة حية قبل النشر"
        badge="الموقع العام"
        icon={Globe}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/owner/business-settings")}
              className="h-11 rounded-xl px-4 font-black border-border bg-card"
            >
              الإعدادات المتقدمة
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(`${window.location.origin}/`, "_blank")}
              className="h-11 rounded-xl px-4 font-black border-border bg-card"
            >
              <ExternalLink size={14} className="ml-1.5" /> عرض الموقع
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="h-11 rounded-xl px-4 font-black border-border bg-card sm:hidden"
            >
              رجوع
            </Button>
          </div>
        }
      />
      <WebsiteSettingsPanel embedded onSaved={() => {}} onChangeDraft={() => {}} />
    </div>
  );
}
