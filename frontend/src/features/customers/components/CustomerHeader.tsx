/** Customers CustomerHeader (moved from Customers page, no logic changes). */
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, FileDown, FileUp, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { importService } from "@/services/importService";

export default function CustomerHeader({
  loading,
  isManagerOrOwner,
  onExport,
  onArchive,
  onCreate,
  onImported,
}: {
  loading: boolean;
  isManagerOrOwner: boolean;
  onExport: (type: string) => void;
  onArchive: () => void;
  onCreate: () => void;
  onImported: () => Promise<void>;
}) {
  const navigate = useNavigate();
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
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950 dark:text-gray-50 sm:text-4xl">
            سجل العملاء
          </h1>
          <p className="page-subtitle mt-2">
            إدارة قاعدة البيانات وبناء علاقات ولاء مستدامة
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            className="hidden"
            accept=".csv, .xlsx, .xls"
          />
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="h-12 w-full px-6 border-black/10 dark:border-white/10 sm:w-auto"
          >
            <FileUp size={18} className="ml-2" /> استيراد
          </Button>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => onExport("excel")}
            className="h-12 w-full px-6 border-black/10 dark:border-white/10 sm:w-auto"
          >
            <FileDown size={18} className="ml-2" /> تصدير
          </Button>
          {isManagerOrOwner && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={onArchive}
              className="h-12 w-full px-6 border-black/10 dark:border-white/10 sm:w-auto"
            >
              <Archive size={18} className="ml-2" /> الأرشيف
            </Button>
          )}
          <Button
            disabled={loading}
            onClick={onCreate}
            className="h-12 w-full px-8 text-base sm:w-auto"
          >
            <Plus size={20} className="ml-2" /> إضافة عميل
          </Button>
        </div>
      </div>
  );
}
