import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useMemo, useState } from "react";



import {
  Activity,
  ArrowDownCircle,
  Calendar as CalendarIcon,
  FileText,
  Filter,
  Plus,
  Search,
  Tag,
  Trash2,
  TrendingDown,
  User,
  Wallet,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import { adaptList } from "../../services/apiAdapter";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { formatCurrency } from "../../lib/utils";

const expenseCategories = [
  "إيجار",
  "أدوات ومستلزمات",
  "كهرباء ومياه",
  "صيانة",
  "رواتب",
  "أخرى",
];
const emptyForm = {
  amount: "",
  category: "أخرى",
  description: "",
  recipient_name: "",
};

export default function Expenses() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  async function fetchExpenses() {
    try {
      setLoading(true);
      const response = await api.get("/expenses");
      setExpenses(adaptList(response));
    } catch (error) {
      console.error("Expenses fetch error:", error);
      toast.error("فشل في مزامنة سجل المصروفات");
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {

    fetchExpenses();
  }, []);

  const expenseRows = Array.isArray(expenses) ? expenses : [];
  const filteredExpenses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return expenseRows;
    return expenseRows.filter((expense) => {
      return [
        expense.description,
        expense.category,
        expense.recipient_name,
        expense.recipientName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [expenseRows, searchTerm]);

  const totalAmount = expenseRows.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0,
  );

  async function handleSubmit() {
    if (!formData.amount || !formData.description.trim()) {
      toast.error("يرجى إدخال المبلغ ووصف العملية");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post("/expenses", {
        ...formData,
        amount: Number(formData.amount),
      });
      toast.success("تم توثيق المصروف بنجاح");
      setIsModalOpen(false);
      setFormData(emptyForm);
      await fetchExpenses();
    } catch (error) {
      console.error("Expense create error:", error);
      toast.error(error?.response?.data?.detail || "فشل تسجيل المصروف المالي");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/expenses/${deleteTarget.id}`);
      toast.success("تم الحذف بنجاح");
      setDeleteTarget(null);
      await fetchExpenses();
    } catch (error) {
      console.error("Expense delete error:", error);
      toast.error("فشل في تنفيذ عملية الحذف");
    }
  }

  if (loading && expenseRows.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-[#6D28D9] dark:text-[#22D3EE]">
          <Activity className="h-10 w-10 animate-pulse" />
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            جاري مراجعة السجلات المالية...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page-container space-y-8 pb-24" dir="rtl">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#6D28D9] text-white dark:bg-[#22D3EE] dark:text-[#121212]">
            <TrendingDown className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-gray-950 dark:text-gray-50">
              سجل المصروفات
            </h1>
            <p className="mt-2 text-sm font-bold text-gray-500 dark:text-gray-400">
              توثيق وإدارة التكاليف التشغيلية المباشرة
            </p>
          </div>
        </div>
        <Button
          disabled={loading}
          onClick={() => setIsModalOpen(true)}
          className="h-14 px-8 text-base"
        >
          تسجيل مصروف جديد <Plus size={20} />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Stat
          title="إجمالي المنصرف"
          value={formatCurrency(totalAmount) || ""}
          icon={Wallet}
          tone="danger"
        />
        <Stat
          title="عدد العمليات"
          value={`${expenseRows.length || ""} عملية`}
          icon={TrendingDown}
          tone="accent"
        />
        <Stat
          title="آخر فئة مسجلة"
          value={expenseRows[0]?.category || "---"}
          icon={Tag}
          tone="muted"
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="البحث في تفاصيل المصروفات أو أسماء المستلمين..."
              className="pr-11"
              value={searchTerm || ""}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => (searchTerm ? setSearchTerm("") : fetchExpenses())}
          >
            {searchTerm ? "مسح البحث" : "تحديث البيانات"} <Filter size={16} />
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {filteredExpenses.map((expense) => (
          <Card key={expense.id} className="overflow-hidden">
            <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-start gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                  <ArrowDownCircle size={28} />
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-black text-gray-950 dark:text-gray-50">
                      {expense.description || "مصروف بدون وصف"}
                    </h3>
                    <Badge variant="accent">{expense.category || "أخرى"}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-bold text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon size={14} />
                      {new Date(
                        expense.created_at || expense.createdAt || Date.now(),
                      ).toLocaleDateString("ar-EG")}
                    </span>
                    {expense.recipient_name || expense.recipientName ? (
                      <span className="inline-flex items-center gap-1">
                        <User size={14} />
                        {expense.recipient_name || expense.recipientName}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-5 border-t border-black/5 pt-5 md:border-t-0 md:pt-0 dark:border-white/10">
                <div className="text-2xl font-black text-red-600 dark:text-red-300">
                  -{formatCurrency(expense.amount || 0)}
                </div>
                <Button
                  variant="dangerSoft"
                  size="icon"
                  disabled={loading}
                  onClick={() => setDeleteTarget(expense)}
                  title="حذف"
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredExpenses.length === 0 ? (
          <Card className="p-16 text-center">
            <FileText className="mx-auto mb-4 h-14 w-14 text-gray-400" />
            <h3 className="text-xl font-black text-gray-950 dark:text-gray-50">
              لا توجد عمليات صرف موثقة
            </h3>
            <p className="mt-2 text-sm font-bold text-gray-500 dark:text-gray-400">
              جرب البحث بكلمات أخرى أو سجل مصروفًا جديدًا.
            </p>
          </Card>
        ) : null}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>توثيق مصروف مالي</DialogTitle>
            <DialogDescription>
              إدراج بند مصروفات جديد في سجل الرقابة المالية.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="المبلغ المطلوب (ج.م)">
                <Input
                  type="number"
                  min="0"
                  value={formData.amount || ""}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
              </Field>
              <Field label="تصنيف الحركة">
                <Select
                  value={formData.category || ""}
                  onValueChange={(value) =>
                    setFormData((previous) => ({
                      ...previous,
                      category: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر التصنيف" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((category) => (
                      <SelectItem key={category} value={category || ""}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="المستلم / المورد">
              <Input
                value={formData.recipient_name || ""}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    recipient_name: event.target.value,
                  }))
                }
                placeholder="اسم الجهة أو الشخص المستلم"
              />
            </Field>
            <Field label="بيان المصروف">
              <textarea
                className="min-h-28 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-[#6D28D9]/50 focus:ring-4 focus:ring-[#6D28D9]/10 dark:border-white/10 dark:bg-[#171717]"
                value={formData.description || ""}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                placeholder="اكتب الغرض التفصيلي من الصرف..."
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setIsModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              loading={isSubmitting}
              disabled={loading}
              onClick={handleSubmit}
            >
              اعتماد الصرف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف سجل المصروف؟</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا السجل المالي نهائيًا؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setDeleteTarget(null)}
            >
              إلغاء
            </Button>
            <Button variant="danger" disabled={loading} onClick={handleDelete}>
              تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ title, value, icon: Icon, tone = "accent" }) {
  const color =
    tone === "danger"
      ? "text-red-600 dark:text-red-300"
      : tone === "muted"
        ? "text-gray-500"
        : "text-[#6D28D9] dark:text-[#22D3EE]";
  return (
    <Card className="p-6">
      <div className="flex items-center gap-5">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-soft text-main bg-soft text-main ${color}`}
        >
          <Icon size={24} />
        </div>
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {title}
          </div>
          <div className={`mt-1 text-2xl font-black ${color}`}>{value}</div>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-black text-gray-600 dark:text-gray-300">
        {label}
      </span>
      {children}
    </label>
  );
}

