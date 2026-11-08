/** HR DocumentsTab (moved from HRManagement page, no logic changes). */
import { toast } from "react-hot-toast";
import { EmptyState } from "@/components/shared/EmptyState";
import type { EmployeeRecord, DocumentRecord } from "@/types/employee";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, FileText, Clock, Eye, Trash2, Plus, Activity } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { staticURL } from "@/services/api";
import { useTranslation } from "react-i18next";
import employeeDocumentService from "@/features/hr/services/employeeDocumentService";
import { formatEmployeeDate } from "@/features/hr/utils/helpers";
import { getIntlLocale } from "@/lib/format/locale";

export default function DocumentsTab({
  editingEmp,
  employeeDocs,
  docLoading,
  setDocLoading,
  onRefreshDocs,
}: {
  editingEmp: EmployeeRecord | null;
  employeeDocs: DocumentRecord[];
  docLoading: boolean;
  setDocLoading: (v: boolean) => void;
  onRefreshDocs: (empId: string | number | undefined) => void;
}) {
  const { t, i18n } = useTranslation("owner");
  const locale = getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar");
  return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="p-6 rounded-[2rem] bg-accent/5 border border-accent/10 flex flex-col md:flex-row items-center gap-6">
              <div className="h-16 w-16 shrink-0 rounded-2xl bg-primary-soft text-primary flex items-center justify-center">
                <Archive size={32} />
              </div>
              <div className="flex-1 text-center md:text-start">
                <h3 className="text-xl font-black text-main">
                   {t("hr.digitalVault")}
                </h3>
                <p className="text-xs font-bold text-muted mt-1">
                   {t("hr.digitalVaultDesc")}

                </p>
              </div>
              <Button
                onClick={() => (document.getElementById("doc-upload") as HTMLInputElement | null)?.click()}
                className="h-12 px-6 rounded-xl bg-accent font-black text-xs uppercase tracking-widest shadow-lg shadow-accent/20"
              >
                 <Plus size={18} className="ms-2" /> {t("hr.uploadDoc")}
                <input
                  id="doc-upload"
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const title = prompt(
                         t("hr.docTitle"),
                      );
                      const type = prompt(
                         t("hr.docType"),
                        "CONTRACT",
                      );
                      const expiry = prompt(
                         t("hr.docExpiry"),
                      );

                      const fd = new FormData();
                      fd.append("file", file);
                      fd.append("title", title || file.name);
                      fd.append("file_type", type || "OTHER");
                      if (expiry) fd.append("expiry_date", expiry);

                      if (!editingEmp?.id) {
                         toast.error(t("hr.selectEmployeeFirst"));
                        return;
                      }
                      try {
                        setDocLoading(true);
                        await employeeDocumentService.upload(editingEmp.id, fd);
                         toast.success(t("hr.docUploaded"));
                        onRefreshDocs(editingEmp?.id);
                      } catch (_err) {
                         toast.error(t("hr.docUploadFailed"));
                      } finally {
                        setDocLoading(false);
                      }
                    }
                  }}
                />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {docLoading ? (
                <div className="flex justify-center p-12">
                  <Activity className="animate-spin text-accent" size={32} />
                </div>
              ) : employeeDocs.length > 0 ? (
                employeeDocs.map((doc: DocumentRecord) => (
                  <div
                    key={doc.id}
                    className="group flex items-center justify-between p-5 rounded-[2rem] bg-card border border-border hover:border-accent/40 hover:shadow-xl hover:shadow-accent/5 transition-all"
                  >
                    <div className="flex items-center gap-5">
                      <div className="h-12 w-12 rounded-xl bg-soft text-muted flex items-center justify-center group-hover:bg-accent/5 group-hover:text-accent transition-colors">
                        <FileText size={24} />
                      </div>
                      <div>
                        <div className="text-sm font-black text-main">
                          {(doc as DocumentRecord).title || ""}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge
                            variant="outline"
                            className="rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-border text-muted"
                          >
                            {(doc as DocumentRecord).file_type || "OTHER"}
                          </Badge>
                          {doc.expiry_date && (
                            <div
                              className={cn(
                                "flex items-center gap-1 text-xs font-bold",
                                new Date(doc.expiry_date) < new Date()
                                  ? "text-danger"
                                  : "text-success",
                              )}
                            >
                               <Clock size={10} /> {t("hr.expiresOn")}{" "}
                              {formatEmployeeDate(doc.expiry_date, locale) ??
                                doc.expiry_date}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          window.open(`${staticURL}${doc.file_url}`, "_blank")
                        }
                        className="h-10 w-10 rounded-xl text-muted hover:bg-accent/5 hover:text-accent"
                      >
                        <Eye size={18} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                           if (confirm(t("hr.deleteDocConfirm"))) {
                            try {
                              await employeeDocumentService.remove(doc.id);
                               toast.success(t("hr.docDeleted"));
                              if (editingEmp?.id) onRefreshDocs(editingEmp?.id);
                            } catch (_err) {
                               toast.error(t("hr.docDeleteFailed"));
                            }
                          }
                        }}
                        className="h-10 w-10 rounded-xl text-muted hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                 <EmptyState variant="section" icon={Archive} title={t("hr.noDocs")} />
              )}
            </div>
          </div>
  );
}
