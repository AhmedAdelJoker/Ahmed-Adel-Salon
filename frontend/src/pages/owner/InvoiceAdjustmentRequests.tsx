import React, { useEffect, useMemo, useState } from "react";

import {
  CheckCircle2,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import { getApiErrorMessage } from "@/lib/core/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const requestTypeLabel = {
  discount: "تعديل خصم",
  payment_method: "تعديل طريقة دفع",
  item: "تعديل/حذف بند",
  price: "تعديل سعر",
  void: "إلغاء الفاتورة بالكامل",
};

const statusLabel = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  PENDING: "قيد المراجعة",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
};

const statusVariant = (status) => {
  const value = String(status || "pending").toLowerCase();
  if (value === "approved") return "success";
  if (value === "rejected") return "danger";
  return "warning";
};

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("ar-EG");
  } catch (err) {
    return String(value);
  }
};

const getRequestId = (request) =>
  request?.id || request?.request_id || request?.requestId;
const getInvoiceId = (request) =>
  request?.invoice_id || request?.invoiceId || request?.invoice?.id;
const getInvoiceNo = (request) =>
  request?.invoice_no ||
  request?.invoiceNo ||
  request?.invoice?.invoice_no ||
  getInvoiceId(request) ||
  "-";
const getRequestStatus = (request) =>
  String(request?.status || "pending").toLowerCase();

export default function InvoiceAdjustmentRequests() {
   
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
   
  const [submittingId, setSubmittingId] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
   
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
   
  const [decisionDialog, setDecisionDialog] = useState<{ open: boolean; action: string; request: any | null }>({
    open: false,
    action: "approve",
    request: null,
  });
  const [managerNote, setManagerNote] = useState("");
  const [managerPin, setManagerPin] = useState("");

  async function fetchRequests() {
    try {
      setLoading(true);
      const response = await api.get("/invoice-adjustment-requests", {
        params: statusFilter !== "all" ? { status: statusFilter } : undefined,
      });
      setRequests(adaptList(response));
    } catch (error) {
      console.error(
        "Invoice adjustment requests load error:",
         
        (error as any)?.response?.data || error,
      );
      toast.error(getApiErrorMessage(error, "فشل تحميل طلبات تعديل الفواتير"));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
     
  }, [statusFilter]);

  const filteredRequests = useMemo(() => {
    const text = query.trim().toLowerCase();
    return requests.filter((request) => {
      if (!text) return true;
      return [
        getRequestId(request),
        getInvoiceNo(request),
        request.request_type,
        request.requestType,
        request.reason,
        request.notes,
        request.created_by_name,
        request.createdByName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
  }, [requests, query]);

  const summary = useMemo(() => {
    return requests.reduce(
      (acc, request) => {
        const status = getRequestStatus(request);
        acc.total += 1;
        if (status === "approved") acc.approved += 1;
        else if (status === "rejected") acc.rejected += 1;
        else acc.pending += 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, rejected: 0 },
    );
  }, [requests]);

  function openDecision(request, action) {
    setDecisionDialog({ open: true, action, request });
    setManagerNote("");
    setManagerPin("");
  }

  async function submitDecision() {
    const request = decisionDialog.request;
    const requestId = getRequestId(request);
    if (!requestId) {
      toast.error("لا يمكن تحديد رقم طلب التعديل");
      return;
    }

    if (decisionDialog.action === "approve" && !managerPin) {
      toast.error("يرجى إدخال كود الاعتماد السري");
      return;
    }

    const actionPath =
      decisionDialog.action === "approve" ? "approve" : "reject";
    try {
      setSubmittingId(requestId);
      await api.post(
        `/invoice-adjustment-requests/${requestId}/${actionPath}`,
        {
          manager_note: managerNote,
          managerNote,
          manager_pin: managerPin,
        },
      );
      toast.success(
        decisionDialog.action === "approve"
          ? "تم اعتماد الطلب"
          : "تم رفض الطلب",
      );
      setDecisionDialog({ open: false, action: "approve", request: null });
      setManagerNote("");
      setManagerPin("");
      fetchRequests();
    } catch (error) {
      console.error(
        "Submit adjustment decision error:",
         
        (error as any)?.response?.data || error,
      );
      toast.error(getApiErrorMessage(error, "فشل تنفيذ القرار"));
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="erp-page-container space-y-6 pb-24">
      <Card className="overflow-hidden border-purple-100 bg-linear-to-r from-white via-purple-50/50 to-blue-50 p-7 shadow-sm dark:border-white/10 dark:from-[#171717] dark:via-purple-500/10 dark:to-blue-500/5">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-purple-50 text-[#6D28D9] dark:bg-cyan-400/10 dark:text-[#22D3EE]">
              <ShieldCheck size={34} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-950 dark:text-gray-50">
                طلبات تعديل الفواتير
              </h1>
              <p className="mt-1 text-sm font-bold text-gray-500">
                مراجعة واعتماد أو رفض طلبات تعديل الفواتير الصادرة من الكاشير
              </p>
            </div>
          </div>
          <Button
            disabled={loading}
            onClick={fetchRequests}
            className="h-12 rounded-2xl px-6 font-black"
          >
            <RefreshCw
              size={18}
              className={loading ? "ml-2 animate-spin" : "ml-2"}
            />
            تحديث الطلبات
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-black text-gray-500">إجمالي الطلبات</p>
          <p className="mt-2 text-3xl font-black text-gray-950 dark:text-gray-50">
            {summary.total}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black text-gray-500">قيد المراجعة</p>
          <p className="mt-2 text-3xl font-black text-amber-600">
            {summary.pending}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black text-gray-500">معتمدة</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">
            {summary.approved}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black text-gray-500">مرفوضة</p>
          <p className="mt-2 text-3xl font-black text-red-600">
            {summary.rejected}
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query || ""}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="بحث برقم الطلب أو الفاتورة أو السبب..."
              className="h-12 pr-11"
            />
          </div>
          <Select value={statusFilter || ""} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="pending">قيد المراجعة</SelectItem>
              <SelectItem value="approved">معتمد</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b bg-gray-50 p-5 dark:bg-white/5">
          <h2 className="text-lg font-black text-gray-950 dark:text-gray-50">
            قائمة طلبات التعديل
          </h2>
        </div>
        {loading ? (
          <div className="flex min-h-52 items-center justify-center text-gray-500">
            <RefreshCw className="ml-2 h-5 w-5 animate-spin" /> جاري تحميل
            الطلبات...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center text-center text-gray-400">
            <FileText size={48} className="mb-3 opacity-40" />
            <p className="font-black">لا توجد طلبات تعديل مطابقة</p>
            <p className="mt-1 text-sm">
              طلبات الكاشير ستظهر هنا بعد إرسالها من شاشة POS.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-right text-sm">
              <thead className="bg-gray-50 text-xs font-black text-gray-500 dark:bg-white/5">
                <tr>
                  <th className="px-5 py-4">رقم الطلب</th>
                  <th className="px-5 py-4">الفاتورة</th>
                  <th className="px-5 py-4">نوع التعديل</th>
                  <th className="px-5 py-4">السبب</th>
                  <th className="px-5 py-4">الحالة</th>
                  <th className="px-5 py-4">تاريخ الطلب</th>
                  <th className="px-5 py-4">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {filteredRequests.map((request) => {
                  const requestId = getRequestId(request);
                  const status = getRequestStatus(request);
                  return (
                    <tr
                      key={requestId}
                      className="hover:bg-gray-50/70 dark:hover:bg-white/5"
                    >
                      <td className="px-5 py-4 font-black">#{requestId}</td>
                      <td className="px-5 py-4">#{getInvoiceNo(request)}</td>
                      <td className="px-5 py-4 font-bold">
                        {requestTypeLabel[
                          request.request_type || request.requestType
                        ] ||
                          request.request_type ||
                          request.requestType ||
                          "غير محدد"}
                      </td>
                      <td className="max-w-xs truncate px-5 py-4 text-gray-600 dark:text-gray-300">
                        {request.reason || "-"}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={statusVariant(status)}>
                          {statusLabel[status] ||
                            statusLabel[request.status] ||
                            status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-gray-500">
                        {formatDate(request.created_at || request.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loading}
                            onClick={() => setSelectedRequest(request)}
                          >
                            تفاصيل
                          </Button>
                          {status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                disabled={loading || submittingId === requestId}
                                onClick={() => openDecision(request, "approve")}
                              >
                                اعتماد
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                disabled={loading || submittingId === requestId}
                                onClick={() => openDecision(request, "reject")}
                              >
                                رفض
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
      >
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">
              تفاصيل طلب التعديل
            </DialogTitle>
            <DialogDescription>
              مراجعة بيانات الطلب قبل الاعتماد أو الرفض.
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                  <p className="text-xs font-black text-gray-500">رقم الطلب</p>
                  <p className="mt-1 font-black">
                    #{getRequestId(selectedRequest)}
                  </p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                  <p className="text-xs font-black text-gray-500">
                    رقم الفاتورة
                  </p>
                  <p className="mt-1 font-black">
                    #{getInvoiceNo(selectedRequest)}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                <p className="text-xs font-black text-gray-500">السبب</p>
                <p className="mt-2 text-sm font-bold leading-7">
                  {selectedRequest.reason || "-"}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                <p className="text-xs font-black text-gray-500">
                  ملاحظات الكاشير
                </p>
                <p className="mt-2 text-sm font-bold leading-7">
                  {selectedRequest.notes || "-"}
                </p>
              </div>
              <div
                className="rounded-2xl bg-gray-950 p-4 text-left text-xs text-gray-100"
                dir="ltr"
              >
                <pre className="whitespace-pre-wrap break-words">
                  {JSON.stringify(
                    selectedRequest.old_values ||
                      selectedRequest.oldValues ||
                      {},
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setSelectedRequest(null)}
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={decisionDialog.open}
        onOpenChange={(open) =>
          setDecisionDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">
              {decisionDialog.action === "approve"
                ? "اعتماد طلب التعديل"
                : "رفض طلب التعديل"}
            </DialogTitle>
            <DialogDescription>
              سيتم تسجيل القرار في سجل المراجعة. التنفيذ المالي التفصيلي يمكن
              تفعيله لاحقًا حسب نوع الطلب.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {decisionDialog.action === "approve" && (
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500">
                  كود الاعتماد السري
                </label>
                <Input
                  type="password"
                  placeholder="أدخل كود المدير السري"
                  className="h-12 rounded-2xl"
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500">
                ملاحظة القرار
              </label>
              <textarea
                value={managerNote || ""}
                onChange={(event) => setManagerNote(event.target.value)}
                placeholder="ملاحظة المدير / سبب القرار"
                className="min-h-28 w-full rounded-2xl border bg-gray-50 p-4 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 dark:bg-white/5"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() =>
                setDecisionDialog({
                  open: false,
                  action: "approve",
                  request: null,
                })
              }
            >
              إلغاء
            </Button>
            <Button
               
              variant={(decisionDialog.action === "approve" ? "default" : "danger") as any}
              disabled={loading}
              onClick={submitDecision}
              loading={Boolean(submittingId)}
            >
              {decisionDialog.action === "approve" ? (
                <CheckCircle2 size={18} />
              ) : (
                <XCircle size={18} />
              )}
              تأكيد القرار
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
