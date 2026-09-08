import React from "react";
import { Cpu } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { FileSpreadsheet, Loader2 } from "lucide-react";

const ImportZone = ({ isImporting }) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="relative">
        <input
          type="file"
          id="excel-upload-main"
          className="hidden"
          accept=".xlsx,.xls,.csv"
          disabled={isImporting}
        />
        <label
          htmlFor="excel-upload-main"
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 transition-all hover:border-primary/40 hover:bg-primary/5",
            isImporting && "opacity-50 cursor-not-allowed",
          )}
        >
          <FileSpreadsheet
            className={cn("mb-2 text-primary", isImporting && "animate-spin")}
            size={32}
          />
          <span className="text-[10px] font-black uppercase tracking-wider text-muted">
            Excel
          </span>
          {isImporting && (
            <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-primary">
              <Loader2 size={10} className="animate-spin" /> جاري...
            </div>
          )}
        </label>
      </div>

      <div className="relative">
        <input
          type="file"
          id="biometric-upload-main"
          className="hidden"
          accept=".json,.csv"
          disabled={isImporting}
        />
        <label
          htmlFor="biometric-upload-main"
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 transition-all hover:border-primary/40 hover:bg-primary/5",
            isImporting && "opacity-50 cursor-not-allowed",
          )}
        >
          <Cpu
            className={cn("mb-2 text-accent", isImporting && "animate-pulse")}
            size={32}
          />
          <span className="text-[10px] font-black uppercase tracking-wider text-muted">
            Biometric
          </span>
          {isImporting && (
            <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-accent">
              <Loader2 size={10} className="animate-spin" /> جاري...
            </div>
          )}
        </label>
      </div>
    </div>
  );
};

export default ImportZone;
