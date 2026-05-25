import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  Box,
  Database,
  Package,
  Plus,
  Save,
  Search,
  FileDown,
  FileUp,
  Image as ImageIcon,
  History,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import { normalizeListResponse } from "../../services/apiAdapter";
import { exportService } from "../../services/exportService";
import { importService } from "../../services/importService";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Switch } from "../../components/ui/switch";
import { formatCurrency } from "../../lib/utils";

const DEFAULT_FORM = {
  name: "",
  description: "",
  sell_price: "",
  cost_price: "",
  weight: "",
  quantity: 0,
  min_quantity_alert: 5,
  category: "زيوت",
};

const DEFAULT_STOCK_FORM = {
  amount: "",
  note: "",
  create_expense: true,
  purchase_price: "",
  invoice_image_url: "",
};

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [stockFormData, setStockFormData] = useState(DEFAULT_STOCK_FORM);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const invoiceInputRef = useRef(null);

  async function handleExport(type = "excel") {
    const filename = `inventory_${new Date().toISOString().split("T")[0]}`;
    if (type === "excel") {
      await exportService.downloadExcel("/exports/products/excel", filename, {
        q: searchTerm,
      });
    } else {
      await exportService.downloadCsv("/exports/products/csv", filename, {
        q: searchTerm,
      });
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await importService.importProducts(file);
      await fetchProducts();
    } catch (error) {
      console.error("Import error:", error);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function fetchProducts() {
    try {
      setLoading(true);
      const response = await api.get("/products");
      setProducts(normalizeListResponse(response).items || []);
    } catch (error) {
      console.error("Inventory fetch error:", error);
      toast.error("فشل مزامنة المخزون");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  const productRows = Array.isArray(products) ? products : [];
  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return productRows;
    return productRows.filter((product) =>
      `${product.name || ""} ${product.category || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [productRows, searchTerm]);

  const lowStockCount = productRows.filter(
    (product) =>
      Number(product.quantity || 0) <= Number(product.min_quantity_alert || 0),
  ).length;
  const inventoryValue = productRows.reduce(
    (sum, product) =>
      sum +
      Number(product.sell_price ?? product.price ?? 0) *
        Number(product.quantity ?? 0),
    0,
  );

  function openCreate() {
    setEditingProduct(null);
    setFormData(DEFAULT_FORM);
    setIsModalOpen(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setFormData({
      name: product.name || "",
      description: product.description || "",
      sell_price: product.sell_price ?? product.price ?? "",
      cost_price: product.cost_price ?? "",
      weight: product.weight ?? "",
      quantity: product.quantity ?? 0,
      min_quantity_alert: product.min_quantity_alert ?? 5,
      category: product.category || "زيوت",
    });
    setIsModalOpen(true);
  }

  function openStockModal(product) {
    setEditingProduct(product);
    setStockFormData({
      ...DEFAULT_STOCK_FORM,
      purchase_price: product.cost_price || "",
    });
    setIsStockModalOpen(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error("اسم الصنف مطلوب");
      return;
    }
    const payload = {
      ...formData,
      sell_price: Number(formData.sell_price || 0),
      cost_price: Number(formData.cost_price || 0),
      weight: formData.weight ? Number(formData.weight) : null,
      quantity: Number(formData.quantity || 0),
      min_quantity_alert: Number(formData.min_quantity_alert || 0),
    };
    try {
      setSaving(true);
      if (editingProduct?.id) {
        await api.put(`/products/${editingProduct.id}`, payload);
        toast.success("تم تحديث المنتج");
      } else {
        await api.post("/products", payload);
        toast.success("تم إدراج المنتج");
      }
      setIsModalOpen(false);
      await fetchProducts();
    } catch (error) {
      console.error("Inventory save error:", error);
      toast.error(error?.response?.data?.detail || "تعذر حفظ بيانات المنتج");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddStock() {
    if (!stockFormData.amount || Number(stockFormData.amount) <= 0) {
      toast.error("الكمية مطلوبة");
      return;
    }
    try {
      setSaving(true);
      await api.post(`/products/${editingProduct.id}/add-stock`, {
        amount: Number(stockFormData.amount),
        note: stockFormData.note,
        create_expense: stockFormData.create_expense,
        purchase_price: stockFormData.purchase_price ? Number(stockFormData.purchase_price) : null,
        invoice_image_url: stockFormData.invoice_image_url,
      });
      toast.success("تمت إضافة الكمية وتحديث المخزون");
      setIsStockModalOpen(false);
      await fetchProducts();
    } catch (error) {
      console.error("Add stock error:", error);
      toast.error(error?.response?.data?.detail || "فشل تحديث المخزون");
    } finally {
      setSaving(false);
    }
  }

  async function handleInvoiceUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      const response = await api.post("/expenses/upload-invoice", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStockFormData((prev) => ({
        ...prev,
        invoice_image_url: response.data.url,
      }));
      toast.success("تم رفع صورة الفاتورة");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-[#6D28D9] dark:text-[#22D3EE]">
          <Activity className="h-10 w-10 animate-pulse" />
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            مراجعة بيانات المستودع...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page-container space-y-8 pb-24" dir="rtl">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-gray-950 dark:text-gray-50">
            إدارة المستودع
          </h1>
          <p className="mt-2 text-base font-bold text-gray-500 dark:text-gray-400">
            متابعة الأصول السلعية، تتبع الكميات، وإدارة سلسلة التوريد
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            className="h-12 px-6 border-black/10 dark:border-white/10"
          >
            <FileUp size={18} className="ml-2" /> استيراد
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport("excel")}
            className="h-12 px-6 border-black/10 dark:border-white/10"
          >
            <FileDown size={18} className="ml-2" /> تصدير
          </Button>
          <Button onClick={openCreate} className="h-12 px-8 text-base">
            <Plus size={20} className="ml-2" /> إضافة صنف
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard
          title="إجمالي الأصول السلعية"
          value={`${productRows.length} صنف`}
          icon={Package}
          tone="accent"
        />
        <StatCard
          title="نواقص المستودع"
          value={`${lowStockCount} تنبيه`}
          icon={AlertTriangle}
          tone={lowStockCount > 0 ? "danger" : "success"}
        />
        <StatCard
          title="إجمالي القيمة السوقية"
          value={formatCurrency(inventoryValue)}
          icon={Database}
          tone="success"
        />
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="البحث بالأصناف أو التصنيفات..."
            className="pr-11"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredProducts.map((product, index) => {
          const isLow =
            Number(product.quantity || 0) <=
            Number(product.min_quantity_alert || 0);
          return (
            <Card key={product.id || index} className="overflow-hidden">
              <CardHeader className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-[#6D28D9] dark:bg-cyan-400/10 dark:text-[#22D3EE]">
                      <Box size={24} />
                    </div>
                    <div>
                      <CardTitle>{product.name || "صنف غير مسمى"}</CardTitle>
                      <CardDescription>
                        {product.category || "General"}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={isLow ? "danger" : "success"}>
                    {isLow ? "Critical Stock" : "In Stock"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-6 pt-0">
                <p className="line-clamp-2 text-sm font-bold text-gray-500 dark:text-gray-400">
                  {product.description || "لا توجد مواصفات إضافية لهذا الصنف."}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <InfoBox
                    label="المخزون"
                    value={`${product.quantity || 0} وحدة`}
                  />
                  <InfoBox
                    label="سعر البيع"
                    value={formatCurrency(
                      product.sell_price ?? product.price ?? 0,
                    )}
                    accent
                  />
                  <InfoBox
                    label="سعر الشراء"
                    value={formatCurrency(product.cost_price || 0)}
                  />
                  <InfoBox
                    label="الوزن"
                    value={product.weight ? `${product.weight} جرام` : "-"}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => openEdit(product)}
                  >
                    تعديل
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-[#6D28D9]/30 text-[#6D28D9] dark:border-[#22D3EE]/30 dark:text-[#22D3EE]"
                    onClick={() => openStockModal(product)}
                  >
                    <Plus size={16} className="ml-1" /> توريد
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredProducts.length === 0 ? (
          <Card className="p-14 text-center md:col-span-2 xl:col-span-3">
            <Package className="mx-auto mb-4 h-14 w-14 text-gray-400" />
            <h3 className="text-xl font-black text-gray-950 dark:text-gray-50">
              لا توجد أصناف مطابقة
            </h3>
          </Card>
        ) : null}
      </div>

      {/* Main Product Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "تحديث بيانات الصنف" : "إدراج صنف جديد"}
            </DialogTitle>
            <DialogDescription>
              ضبط بيانات المنتج والكميات وحد الإنذار.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <Field label="اسم الصنف">
              <Input
                value={formData.name}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="الوصف">
              <textarea
                className="min-h-24 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-[#6D28D9]/50 focus:ring-4 focus:ring-[#6D28D9]/10 dark:border-white/10 dark:bg-[#171717]"
                value={formData.description}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="سعر البيع">
                <Input
                  type="number"
                  value={formData.sell_price}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      sell_price: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="سعر الشراء">
                <Input
                  type="number"
                  value={formData.cost_price}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      cost_price: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="الوزن (جرام)">
                <Input
                  type="number"
                  value={formData.weight}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      weight: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="التصنيف">
                <Input
                  value={formData.category}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      category: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="الكمية الافتتاحية">
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      quantity: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="حد الإنذار">
                <Input
                  type="number"
                  value={formData.min_quantity_alert}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      min_quantity_alert: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button loading={saving} onClick={handleSave}>
              <Save size={18} /> حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Stock Modal */}
      <Dialog open={isStockModalOpen} onOpenChange={setIsStockModalOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة كمية للمخزون (توريد)</DialogTitle>
            <DialogDescription>
              توريد كمية جديدة للمنتج: {editingProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Field label="الكمية المضافة">
              <Input
                type="number"
                value={stockFormData.amount}
                onChange={(e) => setStockFormData(p => ({ ...p, amount: e.target.value }))}
                placeholder="0"
              />
            </Field>
            <Field label="ملاحظات">
              <Input
                value={stockFormData.note}
                onChange={(e) => setStockFormData(p => ({ ...p, note: e.target.value }))}
                placeholder="رقم الفاتورة أو المورد..."
              />
            </Field>
            <div className="flex items-center space-x-2 space-x-reverse py-2">
              <Switch
                id="create_expense"
                checked={stockFormData.create_expense}
                onCheckedChange={(val) => setStockFormData(p => ({ ...p, create_expense: val }))}
              />
              <label htmlFor="create_expense" className="text-sm font-bold cursor-pointer">
                تسجيل كمصروف مشتريات
              </label>
            </div>

            {stockFormData.create_expense && (
              <>
                <Field label="سعر شراء الوحدة">
                  <Input
                    type="number"
                    value={stockFormData.purchase_price}
                    onChange={(e) => setStockFormData(p => ({ ...p, purchase_price: e.target.value }))}
                  />
                </Field>
                <div className="mt-2">
                  <p className="text-xs font-bold text-gray-500 mb-2">فاتورة الشراء</p>
                  <input
                    type="file"
                    ref={invoiceInputRef}
                    onChange={handleInvoiceUpload}
                    className="hidden"
                    accept="image/*"
                  />
                  <div 
                    onClick={() => invoiceInputRef.current?.click()}
                    className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-4 cursor-pointer hover:bg-soft text-main dark:hover:bg-white/5 transition"
                  >
                    {stockFormData.invoice_image_url ? (
                      <img src={stockFormData.invoice_image_url} alt="Invoice" className="h-20 w-auto rounded-lg mb-2" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                    )}
                    <span className="text-xs font-bold text-gray-500">
                      {uploading ? "جارِ الرفع..." : stockFormData.invoice_image_url ? "تم الرفع - تغيير الصورة" : "اضغط لرفع صورة الفاتورة"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsStockModalOpen(false)}>
              إلغاء
            </Button>
            <Button loading={saving} onClick={handleAddStock}>
              تأكيد التوريد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, tone }) {
  const color =
    tone === "danger"
      ? "text-red-600 dark:text-red-300"
      : tone === "success"
        ? "text-emerald-600 dark:text-emerald-300"
        : "text-[#6D28D9] dark:text-[#22D3EE]";
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {title}
          </div>
          <div className={`mt-2 text-2xl font-black ${color}`}>{value}</div>
        </div>
        <div className={`rounded-2xl bg-soft text-main p-4 bg-soft text-main ${color}`}>
          <Icon size={30} />
        </div>
      </div>
    </Card>
  );
}
function InfoBox({ label, value, accent }) {
  return (
    <div className="rounded-2xl bg-soft text-main p-4 bg-soft text-main">
      <div className="text-[10px] font-black text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-black ${accent ? "text-[#6D28D9] dark:text-[#22D3EE]" : "text-gray-950 dark:text-gray-50"}`}
      >
        {value}
      </div>
    </div>
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
