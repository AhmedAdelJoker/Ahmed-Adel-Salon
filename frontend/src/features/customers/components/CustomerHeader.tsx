/** Customers CustomerHeader (moved from Customers page, no logic changes). */
import { useRef } from "react";
import { Archive, FileDown, FileUp, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui";
import { PageHeader } from "@/components/shared/PremiumUI";
import { importService } from "@/features/customers";

export default function CustomerHeader({
  isManagerOrOwner,
  onExport,
  onArchive,
  onCreate,
  onImported,
}: {
  isManagerOrOwner: boolean;
  onExport: (type: string) => void;
  onArchive: () => void;
  onCreate: () => void;
  onImported: () => Promise<void>;
}) {
  const fileInputRef = useRef<any>(null);

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importService.importCustomers(file);
      await onImported();
    } catch (error) {
      console.error("Import error:", error);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }
  return (
      <PageHeader
        title="سجل العملاء"
        subtitle="إدارة قاعدة البيانات وبناء علاقات ولاء مستدامة"
        icon={Users}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              className="hidden"
              accept=".csv, .xlsx, .xls"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 rounded-xl px-3 text-xs"
            >
              <FileUp size={14} className="ms-1.5" /> استيراد
            </Button>
            <Button
              variant="outline"
              onClick={() => onExport("excel")}
              className="h-10 rounded-xl px-3 text-xs"
            >
              <FileDown size={14} className="ms-1.5" /> تصدير
            </Button>
            {isManagerOrOwner && (
              <Button
                variant="outline"
                onClick={onArchive}
                className="h-10 rounded-xl px-3 text-xs"
              >
                <Archive size={14} className="ms-1.5" /> الأرشيف
              </Button>
            )}
            <Button
              variant="primary"
              onClick={onCreate}
              className="h-10 rounded-xl px-3 text-xs"
            >
              <Plus size={14} className="ms-1.5" /> إضافة عميل
            </Button>
          </div>
        }
      />
  );
}
