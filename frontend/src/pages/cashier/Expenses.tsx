import React, { useEffect, useMemo, useState, useCallback } from "react";

import {
  TrendingDown,
  Wallet,
  Tag,
  Plus,
  Search,
  FileDown,
  User,
  Package,
  ChevronLeft,
  Box,
  Calendar as CalendarIcon,
  FileText,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { getApiErrorMessage, formatCurrency } from "@/lib/core/utils";
import api from "@/services/api";
import { adaptList, normalizeListResponse } from "@/services/apiAdapter";
import { exportService } from "@/services/exportService";
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
import {
  PageHeader,
  StatCard,
  ContentPanel,
} from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AnimatePresence } from "framer-motion";

const expenseCategories = [
  "إيجار",
  "أدوات ومستلزمات",
  "كهرباء ومياه",
  "صيانة",
  "رواتب",
  "مشتريات مخزون",
  "أخرى",
];

const emptyForm = {
  amount: "",
  category: "أخرى",
  description: "",
  recipient_name: "",
  product_id: null,
};

export default function Expenses() {
  const [isModalOpen, setIsModalOpen] = useState(false);
   
  const [expenses, setExpenses] = useState<any[]>([]);
   
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(emptyForm);
  const [productSearch, setProductSearch] = useState("");
  const [showProductResults, setShowProductSearch] = useState(false);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/expenses");
      setExpenses(adaptList(response));
    } catch (_error) {
      toast.error("فشل في مزامنة سجل المصروفات");
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await api.get("/products");
      setProducts(normalizeListResponse(response).items || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
    fetchProducts();
  }, [fetchExpenses, fetchProducts]);

  const filteredExpenses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return expenses;
    return expenses.filter((e) =>
      [e.description, e.category, e.recipient_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query)),
    );
  }, [expenses, searchTerm]);

  const stats = useMemo(() => {
    const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const count = expenses.length;
    const latestCat = expenses[0]?.category || "---";
    return { total, count, latestCat };
  }, [expenses]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())),
      )
      .slice(0, 5);
  }, [products, productSearch]);

  const handleSelectProduct = (product) => {
    setFormData({
      ...formData,
      recipient_name: product.company_name || product.name,
      description: `شراء مخزون: ${product.name}`,
      category: "مشتريات مخزون",
      product_id: product.id,
    });
    setProductSearch(product.name);
    setShowProductSearch(false);
    toast.success(`تم ربط المصروف بالمنتج: ${product.name}`);
  };

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

      if (formData.category === "مشتريات مخزون" && formData.product_id) {
        toast.success(
          "تم تسجيل المصروف. تذكر تسجيل 'إذن التوريد' في صفحة المخزون لزيادة الكمية.",
        );
      } else {
        toast.success("تم توثيق المصروف بنجاح");
      }

      setIsModalOpen(false);
      setFormData(emptyForm);
      setProductSearch("");
      await fetchExpenses();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "فشل تسجيل المصروف المالي"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleExport() {
    await exportService.downloadExcel(
      "/exports/expenses/excel",
      `expenses_${Date.now()}`,
    );
  }

  if (loading && expenses.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-primary">
          <TrendingDown className="h-10 w-10 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
            جاري مراجعة السجلات المالية...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page space-y-8 pb-12" dir="rtl">
      <PageHeader className={undefined}
        title="سجل المصروفات"
        subtitle="توثيق وإدارة التكاليف التشغيلية والربط مع المشتريات."
        badge="العمليات المالية"
        icon={TrendingDown}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExport}
              className="h-11 px-6"
            >
              <FileDown size={16} className="ml-2" /> تصدير السجل
            </Button>
            <Button
              disabled={loading}
              onClick={() => setIsModalOpen(true)}
              className="h-11 px-8 shadow-accent"
            >
              <Plus size={18} className="ml-2" /> تسجيل مصروف جديد
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="إجمالي المنصرف"
          value={formatCurrency(stats.total)}
          icon={Wallet}
          variant="danger"
         trend={undefined} trendValue={undefined} />
        <StatCard
          label="عدد العمليات"
          value={`${stats.count} عملية`}
          icon={TrendingDown}
          variant="primary"
         trend={undefined} trendValue={undefined} />
        <StatCard
          label="آخر فئة"
          value={stats.latestCat}
          icon={Tag}
          variant="secondary"
         trend={undefined} trendValue={undefined} />
      </div>

      <ContentPanel className={undefined}
        title="سجل المصروفات"
        subtitle={`${filteredExpenses.length} عملية مسجلة`}
        actions={
          <div className="relative">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/60"
              size={14}
            />
            <Input
              placeholder="البحث في المصروفات..."
              className="pr-9 h-9 text-[11px] font-bold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        }
      >
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredExpenses.map((expense) => (
              <motion.div
                key={expense.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div className="flex flex-col gap-4 p-4 sm:p-5 rounded-2xl border border-border/50 bg-white/60 dark:bg-white/5 hover:border-primary/20 transition-colors group">
                  <div className="flex flex-1 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-danger-soft text-danger">
                      <TrendingDown size={20} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black text-main truncate">
                          {expense.description}
                        </h3>
                        <Badge
                          variant="secondary"
                          className="text-[9px] font-black h-4"
                        >
                          {expense.category}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[10px] font-bold text-muted">
                        <span className="inline-flex items-center gap-1">
                          <CalendarIcon size={12} />{" "}
                          {new Date(expense.created_at).toLocaleDateString(
                            "ar-EG",
                          )}
                        </span>
                        {expense.recipient_name && (
                          <span className="inline-flex items-center gap-1">
                            <User size={12} /> {expense.recipient_name}
                          </span>
                        )}
                        {expense.category === "مشتريات مخزون" && (
                          <Badge
                            variant="success"
                            className="h-4 px-1.5 text-[8px]"
                          >
                            مرتبط بالمخزون
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-lg font-black text-danger tabular-nums shrink-0">
                      -{formatCurrency(expense.amount)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredExpenses.length === 0 && (
            <div className="py-16 text-center opacity-40">
              <FileText size={40} className="mx-auto text-muted mb-3" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                لا توجد عمليات صرف مطابقة
              </p>
            </div>
          )}
        </div>
      </ContentPanel>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="max-w-2xl rounded-[2.5rem] p-0 border-none shadow-2xl"
          dir="rtl"
        >
          <DialogHeader className="p-8 pb-6 bg-[#020617] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-full bg-primary/10 blur-[100px] pointer-events-none" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                <TrendingDown size={22} />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-white">
                  توثيق مصروف مالي
                </DialogTitle>
                <DialogDescription className="text-white/50 font-bold mt-0.5">
                  إدراج بند مصروفات جديد مع إمكانية الربط بالمخزون.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 p-8">
            <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
              <div className="flex items-center gap-3 text-primary mb-1">
                <Package size={18} />
                <span className="text-xs font-black">
                  هل هذا المصروف لشراء منتجات مخزنية؟
                </span>
              </div>
              <div className="relative">
                <Search
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40"
                  size={16}
                />
                <Input
                  placeholder="ابحث عن الصنف في المستودع لربطه تلقائياً..."
                  className="h-12 pr-11 border-primary/20 bg-white/80 focus:ring-primary/10"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductSearch(true);
                  }}
                  onFocus={() => setShowProductSearch(true)}
                />

                <AnimatePresence>
                  {showProductResults && filteredProducts.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute z-50 top-full mt-2 w-full bg-card border border-border rounded-2xl shadow-premium overflow-hidden"
                    >
                      {filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className="w-full flex items-center justify-between p-4 hover:bg-soft transition-colors border-b last:border-0 border-border/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              <Box size={16} />
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-black text-main">
                                {p.name}
                              </div>
                              <div className="text-[10px] font-bold text-muted">
                                {p.company_name || "بدون شركة"} •{" "}
                                {p.sku || "بدون كود"}
                              </div>
                            </div>
                          </div>
                          <ChevronLeft size={14} className="text-muted/40" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                  المبلغ المستقطع (ج.م)
                </span>
                <div className="relative">
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, amount: e.target.value }))
                    }
                    className="h-12 rounded-xl pl-12 font-black text-danger bg-soft border-border focus:bg-card"
                    placeholder="0.00"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted/40">
                    EGP
                  </span>
                </div>
              </label>
              <label className="block space-y-2">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                  تصنيف المصروف
                </span>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData((p) => ({ ...p, category: v }))
                  }
                >
                  <SelectTrigger className="h-12 rounded-xl font-black bg-soft border-border">
                    <SelectValue placeholder="اختر التصنيف" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c} value={c} className="font-bold">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                جهة الاستلام / المورد
              </span>
              <div className="relative">
                <User
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted/40"
                  size={16}
                />
                <Input
                  value={formData.recipient_name}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      recipient_name: e.target.value,
                    }))
                  }
                  className="h-12 rounded-xl pr-11 font-bold bg-soft border-border focus:bg-card"
                  placeholder="اسم الشخص أو الشركة..."
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                البيان التفصيلي
              </span>
              <textarea
                className="min-h-24 w-full rounded-xl border border-border bg-soft px-4 py-3 text-sm font-bold outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10 placeholder:text-muted/40"
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="اكتب الغرض من هذا المصروف بوضوح..."
              />
            </label>
          </div>

          <DialogFooter className="px-8 py-6 border-t border-border bg-soft/20 gap-3">
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              className="h-12 px-8 font-black text-muted"
            >
              إلغاء
            </Button>
            <Button
              loading={isSubmitting}
              onClick={handleSubmit}
              className="h-12 px-10 font-black shadow-lg shadow-primary/20"
            >
              اعتماد صرف المبلغ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
