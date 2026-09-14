import { useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { validateImageSize } from "@/lib/media/upload";
import {
  DEFAULT_FORM,
  DEFAULT_STOCK_FORM,
  getUnitMeta,
  normalizeUnit,
} from "@/features/inventory";

 
export type InventoryProductAny = Record<string, any>;

export interface ProductFormData {
  name: string;
  sku: string;
  company_name: string;
  description: string;
  sell_price: string;
  cost_price: string;
  weight: string;
  min_quantity_alert: number;
  category: string;
  unit: string;
}

export interface StockFormData {
  amount: string;
  note: string;
  create_expense: boolean;
  purchase_price: string;
  invoice_image_url: string;
}

/**
 * Product create/edit form + stock/history/view modals state and actions.
 * Extracted from pages/cashier/Inventory (Phase 2 pilot).
 */
export function useInventoryForm(options: {
  fetchProducts: () => Promise<void>;
  isOwner: boolean;
}) {
  const { fetchProducts, isOwner } = options;

  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<InventoryProductAny | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({ ...DEFAULT_FORM });
  const [stockFormData, setStockFormData] = useState<StockFormData>({
    ...DEFAULT_STOCK_FORM,
  });
  const [historyLogs, setHistoryLogs] = useState<InventoryProductAny[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [viewProduct, setViewProduct] = useState<InventoryProductAny | null>(
    null,
  );
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [showPriceAlert, setShowPriceAlert] = useState(false);
  const [newSellPrice, setNewSellPrice] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedUnit = useMemo(
    () => getUnitMeta(formData.unit),
    [formData.unit],
  );
  const stockUnit = useMemo(
    () => getUnitMeta(editingProduct?.unit),
    [editingProduct?.unit],
  );

  function openCreate() {
    setEditingProduct(null);
    setFormData({ ...DEFAULT_FORM });
    setProductImage(null);
    setImagePreview(null);
    setIsModalOpen(true);
  }

  function openEdit(product: InventoryProductAny) {
    if (Number(product.quantity) > 0 && !isOwner) {
      toast.error("لا يمكن تعديل المنتج بعد تسجيل توريد. تواصل مع المالك.");
      return;
    }
    setEditingProduct(product);
    setFormData({
      name: product.name || "",
      sku: product.sku || "",
      company_name: product.company_name || "",
      description: product.description || "",
      sell_price: product.sell_price ?? "",
      cost_price: product.cost_price ?? "",
      weight: product.weight ?? "",
      min_quantity_alert: product.min_quantity_alert ?? 5,
      category: product.category || "زيوت",
      unit: normalizeUnit(product.unit || "g"),
    });
    setProductImage(product.image_url || null);
    setImagePreview(product.image_url || null);
    setIsModalOpen(true);
  }

  function openStockModal(product: InventoryProductAny) {
    setEditingProduct(product);
    setStockFormData({ ...DEFAULT_STOCK_FORM });
    setIsStockModalOpen(true);
  }

  function openView(product: InventoryProductAny) {
    setViewProduct(product);
    setIsViewOpen(true);
  }

  async function openHistory(product: InventoryProductAny) {
    setEditingProduct(product);
    setHistoryLoading(true);
    setIsHistoryModalOpen(true);
    try {
      const res = await api.get(`/products/${product.id}/logs`);
      setHistoryLogs(res.data || []);
    } catch (err) {
      toast.error("فشل تحميل سجل الحركات");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleImageUpload(file: File | null | undefined) {
    if (!file || !validateImageSize(file)) return;
    try {
      setUploading(true);
      const payload = new FormData();
      payload.append("file", file);
      const res = await api.post("/products/upload-image", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.url;
      if (url) {
        setProductImage(url);
        setImagePreview(url);
        toast.success("تم رفع الصورة بنجاح");
      }
    } catch (err) {
      toast.error("فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!formData.name.trim()) return toast.error("اسم الصنف مطلوب");
    const payload = {
      ...formData,
      sell_price: Number(formData.sell_price || 0),
      cost_price: Number(formData.cost_price || 0),
      weight: formData.weight ? Number(formData.weight) : null,
      min_quantity_alert: Number(formData.min_quantity_alert || 0),
      unit: normalizeUnit(formData.unit || "g"),
      image_url: productImage || null,
    };
    try {
      setSaving(true);
      if (editingProduct?.id) {
        await api.put(`/products/${editingProduct.id}`, payload);
        toast.success("تم تحديث المنتج");
      } else {
        await api.post("/products", payload);
        toast.success("تم إدراج الصنف بنجاح.");
      }
      setIsModalOpen(false);
      await fetchProducts();
    } catch (error) {
      const apiErr = error as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr?.response?.data?.detail as string) || "تعذر حفظ بيانات المنتج");
    } finally {
      setSaving(false);
    }
  }

  const handleAddStock = async () => {
    if (!stockFormData.amount || Number(stockFormData.amount) <= 0)
      return toast.error("الكمية مطلوبة");
    if (
      stockFormData.create_expense &&
      (!stockFormData.purchase_price ||
        Number(stockFormData.purchase_price) <= 0)
    )
      return toast.error("يجب إدخال سعر الشراء");
    try {
      setSaving(true);
      const res = await api.post(`/products/${editingProduct?.id}/add-stock`, {
        amount: Number(stockFormData.amount),
        note: stockFormData.note,
        create_expense: stockFormData.create_expense,
        purchase_price: stockFormData.purchase_price
          ? Number(stockFormData.purchase_price)
          : null,
        invoice_image_url: stockFormData.invoice_image_url,
      });
      const updatedProduct = res.data;
      const oldCost = Number(editingProduct?.cost_price || 0);
      const newCost = Number(updatedProduct.cost_price || 0);
      if (newCost !== oldCost && oldCost > 0) {
        setShowPriceAlert(true);
        setNewSellPrice(updatedProduct.sell_price || "");
        toast.success("تم التوريد وتحديث سعر الشراء");
      } else {
        toast.success("تمت إضافة الكمية");
        setIsStockModalOpen(false);
      }
      await fetchProducts();
    } catch (error) {
      const apiErr = error as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr?.response?.data?.detail as string) || "فشل تحديث المخزون");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSellPrice = async () => {
    try {
      setSaving(true);
      await api.patch(`/products/${editingProduct?.id}/update-prices`, null, {
        params: { sell_price: Number(newSellPrice) },
      });
      toast.success("تم تحديث سعر البيع");
      setShowPriceAlert(false);
      setIsStockModalOpen(false);
      await fetchProducts();
    } catch (err) {
      toast.error("فشل تحديث سعر البيع");
    } finally {
      setSaving(false);
    }
  };

  return {
    saving,
    isModalOpen,
    setIsModalOpen,
    isStockModalOpen,
    setIsStockModalOpen,
    isHistoryModalOpen,
    setIsHistoryModalOpen,
    editingProduct,
    formData,
    setFormData,
    stockFormData,
    setStockFormData,
    historyLogs,
    historyLoading,
    uploading,
    productImage,
    setProductImage,
    imagePreview,
    setImagePreview,
    viewProduct,
    isViewOpen,
    setIsViewOpen,
    showPriceAlert,
    setShowPriceAlert,
    newSellPrice,
    setNewSellPrice,
    selectedUnit,
    stockUnit,
    fileInputRef,
    openCreate,
    openEdit,
    openStockModal,
    openView,
    openHistory,
    handleImageUpload,
    handleSave,
    handleAddStock,
    handleUpdateSellPrice,
  };
}
