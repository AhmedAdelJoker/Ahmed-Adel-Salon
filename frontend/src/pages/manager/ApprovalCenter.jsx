import { useAuth } from "../../context/AuthContext";
import React, { useState, useEffect } from "react";



import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Bell,
  History,
  ChevronRight,
  Activity,
  FileText,
} from "lucide-react";
import api from "../../services/api";
import { toast } from "react-hot-toast";
import { adaptList } from "../../services/apiAdapter";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";

const ApprovalCenter = () => {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await api.get("/discount-approvals");
      setRequests(adaptList(res).filter((r) => r.status === "pending"));
    } catch (err) {
      toast.error("فشل تحميل طلبات الاعتماد");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {

    fetchRequests();
  }, []);

  const handleAction = async (
    id,
    status,
    decisionNote = "تم المعالجة من لوحة التحكم",
  ) => {
    try {
      setActionLoading(id);
      const endpoint = status === "APPROVED" ? "approve" : "reject";
      await api.post(`/discount-approvals/${id}/${endpoint}`, {
        decision_note: decisionNote,
      });
      toast.success(
        status === "APPROVED" ? "تم اعتماد الطلب بنجاح" : "تم رفض الطلب",
      );
      fetchRequests();
    } catch (err) {
      toast.error("فشل تنفيذ الإجراء");
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    await handleAction(confirmAction.id, confirmAction.status);
  };

  const requestRows = Array.isArray(requests) ? requests : [];

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-accent">
          <Bell className="w-10 h-10 animate-pulse" />
          <p className="text-muted font-black text-[10px] uppercase tracking-widest text-center">
            جاري مراجعة طلبات الاعتماد...
          </p>
        </div>
      </div>
    );

  return (
    <div className="space-y-8 pb-24 erp-page-container" dir="rtl">
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={
          confirmAction?.status === "APPROVED"
            ? "تأكيد اعتماد الطلب الاستراتيجي؟"
            : "تأكيد رفض الطلب؟"
        }
        description={
          confirmAction?.status === "APPROVED"
            ? "بمجرد الاعتماد، سيتم تطبيق الخصم أو التعديل فوراً على السجل المالي للعملية."
            : "هل أنت متأكد من رفض هذا الطلب؟ سيتم إخطار مقدم الطلب فوراً بالقرار الإداري."
        }
        confirmText="تأكيد القرار"
        cancelText="تراجع"
        variant={confirmAction?.status === "APPROVED" ? "primary" : "warning"}
        loading={!!actionLoading}
        onConfirm={handleConfirmAction}
      />

      {/* SaaS Executive Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center shadow-lg shadow-accent/20 transition-transform hover:scale-105">
            <Bell className="text-white w-8 h-8" strokeWidth={2} />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-main uppercase tracking-tight leading-none">
              مركز الاعتمادات
            </h1>
            <p className="text-base font-medium text-muted">
              مراجعة والبت في طلبات تعديل العمليات الحساسة والخصومات الاستثنائية
            </p>
          </div>
        </div>
        <Badge
          variant="warning"
          className="h-10 px-6 rounded-xl shadow-sm shadow-warning/20 font-black text-[10px] uppercase tracking-widest gap-3"
        >
          <ShieldAlert size={16} strokeWidth={2.5} /> {requestRows.length} طلبات
          قيد الانتظار
        </Badge>
      </div>

      {/* Main Approval Panel */}
      <Card className="rounded-premium border-border/60 bg-card shadow-soft overflow-hidden transition-all hover:shadow-premium">
        <CardHeader className="p-8 border-b border-border/40 bg-soft/30 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-black text-main uppercase leading-none">
              طلبات تعديل العمليات
            </CardTitle>
            <CardDescription className="text-sm font-medium text-muted mt-2 uppercase tracking-widest">
              تتطلب هذه العمليات موافقة إدارية صريحة بناءً على بروتوكولات الأمان
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-border bg-soft/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                    كود العملية
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                    مقدم الطلب
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                    القيمة المطلوبة
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                    السبب الإداري
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                    توقيت الطلب
                  </th>
                  <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-muted">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {requestRows.length > 0 ? (
                  requestRows.map((req) => (
                    <tr
                      key={req.id}
                      className="group transition-all hover:bg-accent-subtle/30"
                    >
                      <td className="px-8 py-5">
                        <Badge
                          variant="outline"
                          className="font-black px-4 h-7 rounded-lg border-border text-accent bg-soft uppercase tracking-tight"
                        >
                          {req.invoice_no || `REQ-${req.id}`}
                        </Badge>
                      </td>
                      <td className="px-8 py-5">
                        <div className="font-black text-main leading-none group-hover:text-accent transition-colors">
                          {req.requested_by_name || "موظف معتمد"}
                        </div>
                        <div className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">
                          كادر تشغيلي
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="text-lg font-black text-accent tracking-tighter">
                          {req.requested_discount_amount}{" "}
                          <small className="text-[10px] font-bold mr-1">
                            ج.م
                          </small>
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm font-medium text-muted max-w-xs truncate leading-relaxed">
                          {req.reason}
                        </p>
                      </td>
                      <td className="px-8 py-5">
                        <div className="text-xs font-bold text-muted tabular-nums uppercase">
                          {req.created_at
                            ? new Date(req.created_at).toLocaleTimeString(
                                "ar-EG",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                },
                              )
                            : "---"}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-center gap-3">
                          <Button
                            type="button"
                            variant="success"
                            loading={actionLoading === req.id}
                            className="h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-success/10"
                            onClick={() =>
                              setConfirmAction({
                                id: req.id,
                                status: "APPROVED",
                              })
                            }
                            title="اعتماد العملية وتطبيق التعديل"
                          >
                            <CheckCircle size={16} className="ml-2" /> اعتماد
                          </Button>
                          <Button
                            type="button"
                            variant="dangerSoft"
                            loading={actionLoading === req.id}
                            className="h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest"
                            onClick={() =>
                              setConfirmAction({
                                id: req.id,
                                status: "REJECTED",
                              })
                            }
                            title="رفض الطلب نهائياً"
                          >
                            <XCircle size={16} className="ml-2" /> رفض
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-32 text-center opacity-40">
                      <div className="flex flex-col items-center gap-4">
                        <Activity
                          size={80}
                          strokeWidth={1}
                          className="text-muted"
                        />
                        <p className="font-black text-xl text-main uppercase tracking-tight">
                          لا توجد طلبات معلقة
                        </p>
                        <p className="text-sm font-medium">
                          سجل الاعتمادات خالي من أي طلبات تعديل حالياً
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Decision Log Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        <Card
          disabled={loading}
          onClick={() => navigate("/activity-logs")}
          className="rounded-premium p-10 border border-border/60 bg-card shadow-soft hover:shadow-premium hover:border-accent/20 transition-all duration-500 group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl -mr-16 -mt-16 transition-transform group-hover:scale-125" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="w-16 h-16 rounded-2xl bg-soft border border-border/40 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all duration-500 shadow-sm">
                <History size={28} strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-xl text-main uppercase tracking-tight leading-none group-hover:text-accent transition-colors">
                  سجل القرارات التاريخي
                </h4>
                <p className="text-sm text-muted font-medium mt-2 max-w-[240px]">
                  مراجعة كافة الطلبات التي تم البت فيها مسبقاً والنتائج
                  التشغيلية
                </p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-soft border border-border flex items-center justify-center transition-all group-hover:bg-accent group-hover:text-white group-hover:translate-x-[-8px]">
              <ChevronRight size={18} strokeWidth={3} className="rotate-180" />
            </div>
          </div>
        </Card>

        <Card
          disabled={loading}
          onClick={() => navigate("/owner/financial")}
          className="rounded-premium p-10 border border-border/60 bg-[#1B1714] shadow-premium hover:shadow-2xl transition-all duration-500 group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-2xl -mr-16 -mt-16 transition-transform group-hover:scale-125" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-accent transition-all duration-500 shadow-inner group-hover:bg-accent group-hover:text-white">
                <FileText size={28} strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-xl text-white uppercase tracking-tight leading-none">
                  مؤشرات الرقابة الإدارية
                </h4>
                <p className="text-sm text-white/50 font-medium mt-2 max-w-[240px]">
                  تحليل معدلات الخصم والتعديل لكل قسم وربطها بالأداء المالي
                </p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-white/40 transition-all group-hover:bg-accent group-hover:text-white group-hover:translate-x-[-8px]">
              <ChevronRight size={18} strokeWidth={3} className="rotate-180" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ApprovalCenter;

