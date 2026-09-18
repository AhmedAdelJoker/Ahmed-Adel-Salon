import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  CheckCircle,
  XCircle,
  Bell,
  Activity,
  FileText,
  DollarSign,
  Briefcase,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import { adaptList } from "@/services/apiAdapter";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatCurrency } from "@/lib/core/utils";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";

const ApprovalCenter = () => {

   
  const [discountRequests, setDiscountRequests] = useState<any[]>([]);
   
  const [pendingExpenses, setPendingExpenses] = useState<any[]>([]);
   
  const [pendingPayroll, setPendingPayroll] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
   
  const [actionLoading, setActionLoading] = useState<any>(null);
  interface ConfirmAction {
    type: string;
    id: string | number;
    status: string;
  }
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [discountsRes, expensesRes, payrollRes] = await Promise.all([
        api.get("/discount-approvals"),
        api.get("/expenses"),
        api.get("/payroll/all"), // Assuming an endpoint to get all payroll records
      ]);

      setDiscountRequests(
         
        adaptList(discountsRes).filter((r: any) => r.status === "pending"),
      );
      setPendingExpenses(
         
        adaptList(expensesRes).filter((e: any) => e.status === "pending_audit"),
      );
      setPendingPayroll(
        adaptList(payrollRes).filter(
           
          (p: any) => p.status === "generated" || p.status === "draft",
        ),
      );
    } catch (err) {
      console.error("Fetch data error:", err);
      // Fallback for missing endpoints
      setDiscountRequests([]);
      setPendingExpenses([]);
      setPendingPayroll([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDiscountAction = async (id: string | number, status: string) => {
    try {
      setActionLoading(id);
      const endpoint = status === "APPROVED" ? "approve" : "reject";
      await api.post(`/discount-approvals/${id}/${endpoint}`, {
        decision_note: "معتمد من مركز القيادة",
      });
      toast.success("تم تنفيذ الإجراء بنجاح");
      fetchData();
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      const msg = apiErr?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "فشل تنفيذ الإجراء");
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleExpenseAction = async (id: string | number, status: string) => {
    try {
      setActionLoading(id);
      const endpoint = status === "APPROVED" ? "approve" : "reject";
      await api.post(`/expenses/${id}/${endpoint}`);
      toast.success("تم تحديث حالة المصروف");
      fetchData();
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      const msg = apiErr?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "فشل تحديث حالة المصروف");
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handlePayrollAction = async (id: string | number, status: string) => {
    try {
      setActionLoading(id);
      if (status === "APPROVED") {
        await api.post(`/payroll/${id}/audit`);
        toast.success("تم تدقيق الراتب بنجاح");
      } else {
        await api.delete(`/payroll/${id}`);
        toast.success("تم حذف مسودة الراتب");
      }
      fetchData();
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      const msg = apiErr?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "فشل معالجة طلب الراتب");
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, id, status } = confirmAction;
    if (type === "discount") await handleDiscountAction(id, status);
    if (type === "expense") await handleExpenseAction(id, status);
    if (type === "payroll") await handlePayrollAction(id, status);
  };

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-accent">
          <Activity className="w-10 h-10 animate-spin" />
          <p className="text-muted font-black text-[10px] uppercase tracking-widest text-center">
            جاري مزامنة طلبات الاعتماد...
          </p>
        </div>
      </div>
    );

  const totalPending =
    discountRequests.length + pendingExpenses.length + pendingPayroll.length;

  return (
    <div className="space-y-8 pb-24 erp-page-container">
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={
          confirmAction?.status === "APPROVED"
            ? "تأكيد الاعتماد؟"
            : "تأكيد الرفض؟"
        }
        description="هذا الإجراء سيؤثر على السجلات المالية للمؤسسة بشكل دائم."
        confirmText="تأكيد القرار"
        cancelText="تراجع"
        loading={!!actionLoading}
        onConfirm={handleConfirmAction}
      />

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 transition-transform hover:scale-105">
            <Bell className="text-white w-8 h-8" strokeWidth={2} />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight leading-none">
              مركز القيادة والتحكم
            </h1>
            <p className="text-base font-medium text-slate-500">
              مراجعة واعتماد العمليات المالية والإدارية المعلقة (Audit Before
              Action)
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="h-10 px-6 rounded-xl border-indigo-200 bg-indigo-50 text-indigo-700 font-black text-[10px] uppercase tracking-widest gap-3 shrink-0"
        >
          <ShieldAlert size={16} strokeWidth={2.5} /> {totalPending} عمليات
          بانتظار قرارك
        </Badge>
      </div>

      {/* Stats Overview - World Class */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PremiumCard className="p-5 group hover:shadow-premium transition-all" delay={0}>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black text-muted uppercase tracking-widest truncate">تعديلات الفواتير</div>
              <div className="text-2xl font-black text-main">{discountRequests.length}</div>
            </div>
            <div className={`h-2 w-2 rounded-full ${discountRequests.length > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
          </div>
        </PremiumCard>
        <PremiumCard className="p-5 group hover:shadow-premium transition-all" delay={0.05}>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Briefcase size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black text-muted uppercase tracking-widest truncate">مصروفات معلقة</div>
              <div className="text-2xl font-black text-main">{pendingExpenses.length}</div>
            </div>
            <div className={`h-2 w-2 rounded-full ${pendingExpenses.length > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
          </div>
        </PremiumCard>
        <PremiumCard className="p-5 group hover:shadow-premium transition-all" delay={0.1}>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <DollarSign size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black text-muted uppercase tracking-widest truncate">رواتب قيد المراجعة</div>
              <div className="text-2xl font-black text-main">{pendingPayroll.length}</div>
            </div>
            <div className={`h-2 w-2 rounded-full ${pendingPayroll.length > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
          </div>
        </PremiumCard>
        <PremiumCard className="p-5 group hover:shadow-premium transition-all border-indigo-200 bg-indigo-50/50" delay={0.15}>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
              <Activity size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate">إجمالي المعلق</div>
              <div className="text-2xl font-black text-indigo-700">{totalPending}</div>
            </div>
          </div>
        </PremiumCard>
      </div>

      <Tabs defaultValue="discounts" className="w-full">
        <TabsList className="bg-slate-100 p-1.5 rounded-2xl h-auto mb-6 w-full overflow-x-auto flex flex-nowrap gap-1 scrollbar-thin">
          <TabsTrigger
            value="discounts"
            className="rounded-xl px-8 py-3 font-black text-xs uppercase data-[state=active]:bg-white data-[state=active]:shadow-lg"
          >
            تعديلات الفواتير ({discountRequests.length})
          </TabsTrigger>
          <TabsTrigger
            value="expenses"
            className="rounded-xl px-8 py-3 font-black text-xs uppercase data-[state=active]:bg-white data-[state=active]:shadow-lg"
          >
            المصروفات النثرية ({pendingExpenses.length})
          </TabsTrigger>
          <TabsTrigger
            value="payroll"
            className="rounded-xl px-8 py-3 font-black text-xs uppercase data-[state=active]:bg-white data-[state=active]:shadow-lg"
          >
            كشوف الرواتب ({pendingPayroll.length})
          </TabsTrigger>
        </TabsList>

        {/* DISCOUNTS TAB */}
        <TabsContent value="discounts">
          <Card className="rounded-[2.5rem] border-slate-200 overflow-hidden shadow-xl bg-white/50 backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">
                    كود العملية
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">
                    مقدم الطلب
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 text-center">
                    القيمة
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">
                    السبب
                  </th>
                  <th className="px-8 py-5 text-center text-[10px] font-black uppercase text-slate-400">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {discountRequests.length > 0 ? (
                   
                  discountRequests.map((req: any) => (
                    <tr
                      key={req.id}
                      className="group hover:bg-white transition-colors"
                    >
                      <td className="px-8 py-5">
                        <Badge
                          variant="outline"
                          className="font-black bg-white"
                        >
                          {req.invoice_no || `REQ-${req.id}`}
                        </Badge>
                      </td>
                      <td className="px-8 py-5 font-black text-slate-900">
                        {req.requested_by_name}
                      </td>
                      <td className="px-8 py-5 text-center font-black text-indigo-600">
                        {formatCurrency(req.requested_discount_amount)}
                      </td>
                      <td className="px-8 py-5 text-xs font-bold text-slate-500">
                        {req.reason}
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex justify-center gap-2">
                          <Button
                            onClick={() =>
                              setConfirmAction({
                                type: "discount",
                                id: req.id,
                                status: "APPROVED",
                              })
                            }
                            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[10px] font-black uppercase shadow-lg shadow-emerald-100"
                          >
                            <CheckCircle size={14} className="ml-2" /> اعتماد
                          </Button>
                          <Button
                            onClick={() =>
                              setConfirmAction({
                                type: "discount",
                                id: req.id,
                                status: "REJECTED",
                              })
                            }
                            variant="ghost"
                            className="h-9 px-4 rounded-xl text-rose-600 hover:bg-rose-50 text-[10px] font-black uppercase"
                          >
                            <XCircle size={14} className="ml-2" /> رفض
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-16">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <CheckCircle size={32} />
                        </div>
                        <div className="text-sm font-black text-main">لا توجد طلبات معلقة ✨</div>
                        <div className="text-xs font-bold text-muted">جميع تعديلات الفواتير تمت مراجعتها</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
              </div>
          </Card>
        </TabsContent>

        {/* EXPENSES TAB */}
        <TabsContent value="expenses">
          <Card className="rounded-[2.5rem] border-slate-200 overflow-hidden shadow-xl bg-white/50 backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">
                    التصنيف
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">
                    المستفيد
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 text-center">
                    المبلغ
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">
                    الوصف
                  </th>
                  <th className="px-8 py-5 text-center text-[10px] font-black uppercase text-slate-400">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pendingExpenses.length > 0 ? (
                   
                  pendingExpenses.map((exp: any) => (
                    <tr
                      key={exp.id}
                      className="group hover:bg-white transition-colors"
                    >
                      <td className="px-8 py-5">
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                          {exp.category}
                        </Badge>
                      </td>
                      <td className="px-8 py-5 font-black text-slate-900">
                        {exp.recipient_name}
                      </td>
                      <td className="px-8 py-5 text-center font-black text-rose-600">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-8 py-5 text-xs font-bold text-slate-500">
                        {exp.description}
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex justify-center gap-2">
                          <Button
                            onClick={() =>
                              setConfirmAction({
                                type: "expense",
                                id: exp.id,
                                status: "APPROVED",
                              })
                            }
                            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[10px] font-black uppercase shadow-lg shadow-emerald-100"
                          >
                            <CheckCircle size={14} className="ml-2" /> تدقيق
                          </Button>
                          <Button
                            onClick={() =>
                              setConfirmAction({
                                type: "expense",
                                id: exp.id,
                                status: "REJECTED",
                              })
                            }
                            variant="ghost"
                            className="h-9 px-4 rounded-xl text-rose-600 hover:bg-rose-50 text-[10px] font-black uppercase"
                          >
                            <XCircle size={14} className="ml-2" /> رفض
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-16">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                          <CheckCircle size={32} />
                        </div>
                        <div className="text-sm font-black text-main">لا توجد مصروفات معلقة ✨</div>
                        <div className="text-xs font-bold text-muted">جميع المصروفات تم تدقيقها</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
              </div>
          </Card>
        </TabsContent>

        {/* PAYROLL TAB */}
        <TabsContent value="payroll">
          <Card className="rounded-[2.5rem] border-slate-200 overflow-hidden shadow-xl bg-white/50 backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">
                    الموظف
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">
                    الفترة
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 text-center">
                    صافي الراتب
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">
                    الحالة الحالية
                  </th>
                  <th className="px-8 py-5 text-center text-[10px] font-black uppercase text-slate-400">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pendingPayroll.length > 0 ? (
                   
                  pendingPayroll.map((pay: any) => (
                    <tr
                      key={pay.id}
                      className="group hover:bg-white transition-colors"
                    >
                      <td className="px-8 py-5 font-black text-slate-900">
                        {pay.employee_name}
                      </td>
                      <td className="px-8 py-5 font-bold text-slate-500 text-xs">
                        {pay.period_month}/{pay.period_year}
                      </td>
                      <td className="px-8 py-5 text-center font-black text-emerald-600">
                        {formatCurrency(pay.net_salary)}
                      </td>
                      <td className="px-8 py-5">
                        <Badge
                          variant="outline"
                          className="text-[9px] uppercase font-black"
                        >
                          {pay.status}
                        </Badge>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex justify-center gap-2">
                          <Button
                            onClick={() =>
                              setConfirmAction({
                                type: "payroll",
                                id: pay.id,
                                status: "APPROVED",
                              })
                            }
                            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[10px] font-black uppercase shadow-lg shadow-indigo-100"
                          >
                            <CheckCircle size={14} className="ml-2" /> اعتماد
                          </Button>
                          <Button
                            onClick={() =>
                              setConfirmAction({
                                type: "payroll",
                                id: pay.id,
                                status: "REJECTED",
                              })
                            }
                            variant="ghost"
                            className="h-9 px-4 rounded-xl text-rose-600 hover:bg-rose-50 text-[10px] font-black uppercase"
                          >
                            <Trash2 size={14} className="ml-2" /> حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-16">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <CheckCircle size={32} />
                        </div>
                        <div className="text-sm font-black text-main">لا توجد كشوف معلقة ✨</div>
                        <div className="text-xs font-bold text-muted">جميع الرواتب معتمدة</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
              </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApprovalCenter;
