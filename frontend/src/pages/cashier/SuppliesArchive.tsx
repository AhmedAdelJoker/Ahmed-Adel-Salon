import React, { useEffect, useState, useCallback } from "react";
import {
  History,
  Search,
  ArrowLeft,
  Package,
  Plus,
  Minus,
  Settings,
  Calendar,
  User,
  ExternalLink,
  Eye,
  FileText,
  Hash,
  Clock,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn, formatNumber } from "@/lib/core/utils";
import EmptyState from "@/components/shared/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SuppliesArchive() {
   
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, add, remove, adjust
  const navigate = useNavigate();
   
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
   
  const [productMap, setProductMap] = useState<Record<string, any>>({});

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/products/logs/all", {
        params: { limit: 200 },
      });
      setLogs(res.data || []);
    } catch (_err) {
      toast.error("فشل تحميل سجل التوريدات");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProductsMap = useCallback(async () => {
    try {
      const res = await api.get("/products", { params: { limit: 1000 } });
      const items = res.data || [];
       
      const map: Record<string, any> = {};
      (Array.isArray(items) ? items : []).forEach((p) => {
        map[p.id] = p;
      });
      setProductMap(map);
    } catch (err) {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchProductsMap();
  }, [fetchLogs, fetchProductsMap]);

  const openDetail = (log) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.note
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || log.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="erp-page-container space-y-8 pb-10" dir="rtl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/inventory")}
              className="rounded-xl border border-border bg-white shadow-sm"
            >
              <ArrowLeft size={18} />
            </Button>
            <h1 className="text-3xl font-black text-slate-900">
              أرشيف التوريدات والحركات
            </h1>
          </div>
          <p className="text-slate-500 font-bold mr-12">
            سجل تاريخي مفصل لجميع عمليات دخول وخروج الأصناف من المستودع.
          </p>
        </div>
      </div>

      <Card className="rounded-[2rem] border border-border shadow-soft overflow-hidden">
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative col-span-1 md:col-span-2">
              <Search
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث في ملاحظات الحركة..."
                className="h-12 rounded-2xl pr-11 font-bold"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-12 rounded-2xl border border-border bg-soft px-4 text-sm font-bold text-main outline-none focus:border-accent"
            >
              <option value="all">كل الحركات</option>
              <option value="add">عمليات التوريد (إضافة)</option>
              <option value="remove">عمليات الصرف (سحب)</option>
              <option value="adjust">تعديلات المخزون</option>
            </select>
            <Button
              onClick={fetchLogs}
              variant="outline"
              className="h-12 rounded-2xl font-black"
            >
              تحديث البيانات
            </Button>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 font-bold">جاري مراجعة الأرشيف...</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-slate-400 text-xs font-black uppercase tracking-widest">
                    <th className="px-4 py-2">النوع</th>
                    <th className="px-4 py-2">التفاصيل / الملاحظات</th>
                    <th className="px-4 py-2 text-center">الكمية</th>
                    <th className="px-4 py-2">التاريخ</th>
                    <th className="px-4 py-2 text-center">الحالة</th>
                    <th className="px-4 py-2 text-left">عرض</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="bg-white group hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-4 first:rounded-r-2xl border-y border-r border-border/60">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            log.type === "add"
                              ? "bg-emerald-50 text-emerald-600"
                              : log.type === "remove"
                                ? "bg-rose-50 text-rose-600"
                                : "bg-sky-50 text-sky-600",
                          )}
                        >
                          {log.type === "add" ? (
                            <Plus size={18} />
                          ) : log.type === "remove" ? (
                            <Minus size={18} />
                          ) : (
                            <Settings size={18} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 border-y border-border/60">
                        <div className="space-y-1">
                          <div className="text-sm font-black text-slate-900">
                            {log.note || "حركة مخزنية"}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                            <Package size={12} /> معرف الصنف: #{log.product_id}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 border-y border-border/60 text-center">
                        <div
                          className={cn(
                            "text-lg font-black",
                            log.change_amount > 0
                              ? "text-emerald-600"
                              : log.change_amount < 0
                                ? "text-rose-600"
                                : "text-slate-600",
                          )}
                        >
                          {log.change_amount > 0 ? "+" : ""}
                          {formatNumber(log.change_amount)}
                        </div>
                      </td>
                      <td className="px-4 py-4 border-y border-border/60">
                        <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-300" />
                          {new Date(log.created_at).toLocaleDateString("ar-EG")}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1">
                          {new Date(log.created_at).toLocaleTimeString(
                            "ar-EG",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 border-y border-border/60 text-center">
                        <Badge
                          variant="outline"
                          className="rounded-full bg-slate-50 border-slate-200 text-[10px] font-black"
                        >
                          تم التسجيل
                        </Badge>
                      </td>
                      <td className="px-4 py-4 last:rounded-l-2xl border-y border-l border-border/60 text-left">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDetail(log)}
                          className="h-9 w-9 rounded-xl bg-card border border-border text-muted hover:bg-accent hover:text-white hover:border-accent shadow-sm"
                          title="عرض التفاصيل (قراءة فقط)"
                        >
                          <Eye size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="الأرشيف فارغ"
              text="لم نجد أي عمليات مسجلة تطابق بحثك."
              icon={History}
            />
          )}
        </CardContent>
      </Card>

      {/* Detail View Dialog - Read Only */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent
          dir="rtl"
          className="max-w-lg rounded-[2rem] border-0 p-0 overflow-hidden bg-card shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]"
        >
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white relative overflow-hidden">
            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/5" />
            <div className="absolute -right-10 -bottom-10 h-24 w-24 rounded-full bg-accent/10" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/10">
                  <FileText size={22} className="text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-white">تفاصيل الحركة</DialogTitle>
                  <DialogDescription className="text-xs font-bold text-slate-300">عرض قراءة فقط - بدون تعديل</DialogDescription>
                </div>
              </div>
              <Badge
                className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-black border-0",
                  selectedLog?.type === "add"
                    ? "bg-emerald-500 text-white"
                    : selectedLog?.type === "remove"
                      ? "bg-rose-500 text-white"
                      : "bg-sky-500 text-white",
                )}
              >
                {selectedLog?.type === "add" ? "توريد" : selectedLog?.type === "remove" ? "صرف" : "تعديل"}
              </Badge>
            </div>
            {selectedLog && (
              <div className="relative mt-4 flex items-center gap-2 text-[11px] font-bold text-slate-400">
                <Hash size={12} />
                <span>رقم الحركة #{selectedLog.id}</span>
                <span className="mx-1">•</span>
                <Calendar size={12} />
                <span>{new Date(selectedLog.created_at).toLocaleString("ar-EG")}</span>
              </div>
            )}
          </div>

          {selectedLog ? (
            <div className="p-6 space-y-5">
              {/* Product Info */}
              <div className="rounded-2xl border border-border bg-soft/50 p-4 flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-card border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {productMap[selectedLog.product_id]?.image_url ? (
                    <img
                      src={
                        productMap[selectedLog.product_id].image_url.startsWith("http")
                          ? productMap[selectedLog.product_id].image_url
                          : `${api.defaults.baseURL?.replace("/api/v1","")}${productMap[selectedLog.product_id].image_url}`
                      }
                      alt={productMap[selectedLog.product_id].name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package size={20} className="text-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-main truncate">
                    {productMap[selectedLog.product_id]?.name || `صنف #${selectedLog.product_id}`}
                  </div>
                  <div className="text-[11px] font-bold text-muted truncate">
                    {productMap[selectedLog.product_id]?.category || "غير مصنف"} • {productMap[selectedLog.product_id]?.company_name || "---"}
                  </div>
                  <div className="text-[10px] font-bold text-muted/70">معرف الصنف: #{selectedLog.product_id}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-soft border border-border/60 p-4">
                  <div className="flex items-center gap-2 text-[9px] font-black text-muted uppercase tracking-widest mb-2">
                    <Clock size={12} /> الكمية المتغيرة
                  </div>
                  <div className={cn("text-xl font-black", selectedLog.change_amount > 0 ? "text-emerald-600" : selectedLog.change_amount < 0 ? "text-rose-600" : "text-main")}>
                    {selectedLog.change_amount > 0 ? "+" : ""}{formatNumber(selectedLog.change_amount)}
                  </div>
                  <div className="text-[10px] font-bold text-muted mt-1">الوحدة: {productMap[selectedLog.product_id]?.unit || "---"}</div>
                </div>
                <div className="rounded-2xl bg-soft border border-border/60 p-4">
                  <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-2">نوع العملية</div>
                  <div className="text-sm font-black text-main">
                    {selectedLog.type === "add" ? "إضافة مخزون (توريد)" : selectedLog.type === "remove" ? "صرف مخزون" : "تعديل يدوي"}
                  </div>
                  <div className="text-[10px] font-bold text-muted mt-1">النوع: {selectedLog.type}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1">
                  <FileText size={12} /> الملاحظات / التفاصيل
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 min-h-[70px]">
                  <p className="text-sm font-bold leading-relaxed text-main whitespace-pre-wrap">
                    {selectedLog.note || "لا توجد ملاحظات إضافية لهذه الحركة."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-soft border border-border p-3">
                  <div className="text-[9px] font-black text-muted uppercase mb-1">تاريخ الإنشاء</div>
                  <div className="font-black text-main flex items-center gap-1.5">
                    <Calendar size={12} className="text-muted" />
                    {new Date(selectedLog.created_at).toLocaleDateString("ar-EG")}
                  </div>
                  <div className="text-[10px] font-bold text-muted mt-0.5">{new Date(selectedLog.created_at).toLocaleTimeString("ar-EG")}</div>
                </div>
                <div className="rounded-xl bg-soft border border-border p-3">
                  <div className="text-[9px] font-black text-muted uppercase mb-1">المنشئ</div>
                  <div className="font-black text-main flex items-center gap-1.5">
                    <User size={12} className="text-muted" />
                    {selectedLog.created_by_user_id ? `مستخدم #${selectedLog.created_by_user_id}` : "النظام"}
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 mt-1">• قراءة فقط - لا يمكن التعديل من الأرشيف</div>
                </div>
              </div>

              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Eye size={14} />
                </div>
                <p className="text-[11px] font-bold leading-relaxed text-amber-800">
                  هذا العرض للقراءة فقط. لإجراء أي تعديل أو توريد جديد يرجى العودة لصفحة <span className="underline">إدارة المستودع</span>.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={() => setIsDetailOpen(false)} variant="outline" className="flex-1 h-11 rounded-xl font-black">
                  إغلاق
                </Button>
                <Button onClick={() => { setIsDetailOpen(false); navigate("/inventory"); }} className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black">
                  الذهاب للمخزون <ExternalLink size={14} className="mr-2" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-muted font-bold">جاري التحميل...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
