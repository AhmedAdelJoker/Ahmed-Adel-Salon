import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import api, { staticURL } from "@/services/api";

export function useProductBundles() {
  const [offers, setOffers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<any>(null);

  const [formData, setFormData] = useState<any>({
    name: "",
    name_ar: "",
    description_ar: "",
    offer_price: "",
    image_url: "",
    is_active: true,
    is_public: true,
    products: [],
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [offersRes, productsRes] = await Promise.all([
        api.get("/offers"),
        api.get("/products"),
      ]);
      setOffers(offersRes.data || []);
      setProducts(productsRes.data?.items || productsRes.data || []);
    } catch (_err) {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setFormData({
      name: "",
      name_ar: "",
      description_ar: "",
      offer_price: "",
      image_url: "",
      is_active: true,
      is_public: true,
      products: [],
    });
    setIsModalOpen(true);
  };

  const openEdit = (offer: any) => {
    setEditingId(offer.id);
    setFormData({
      name: offer.name || "",
      name_ar: offer.name_ar || "",
      description_ar: offer.description_ar || "",
      offer_price: offer.offer_price || "",
      image_url: offer.image_url || "",
      is_active: offer.is_active ?? true,
      is_public: offer.is_public ?? true,
      products: (offer.offer_products || []).map((op: any) => ({
        product_id: op.product_id,
        name: op.product_name,
        quantity: op.quantity,
        price: op.product_price,
      })),
    });
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    try {
      setUploading(true);
      const res = await api.post("/offers/upload-image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFormData((prev: any) => ({ ...prev, image_url: res.data.url }));
      toast.success("تم رفع الصورة بنجاح");
    } catch (_err) {
      toast.error("فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const handleAddProductToBundle = (product: any) => {
    if (formData.products.find((p: any) => p.product_id === product.id))
      return toast.error("هذا المنتج مضاف بالفعل");
    setFormData((prev: any) => ({
      ...prev,
      products: [
        ...prev.products,
        {
          product_id: product.id,
          name: product.name,
          quantity: 1,
          price: product.sell_price,
        },
      ],
    }));
  };

  const handleRemoveProduct = (id: any) => {
    setFormData((prev: any) => ({
      ...prev,
      products: prev.products.filter((p: any) => p.product_id !== id),
    }));
  };

  const totalPrice = useMemo(() => {
    return formData.products.reduce(
      (sum: number, p: any) => sum + Number(p.price || 0) * Number(p.quantity || 1),
      0,
    );
  }, [formData.products]);

  const handleSave = async () => {
    if (!formData.name_ar) return toast.error("اسم العرض مطلوب");
    if (formData.products.length === 0)
      return toast.error("يجب إضافة منتج واحد على الأقل");
    if (!formData.offer_price) return toast.error("سعر العرض مطلوب");

    try {
      setSaving(true);
      const payload = {
        ...formData,
        name: formData.name_ar,
        original_price: totalPrice,
        offer_price: Number(formData.offer_price),
      };

      if (editingId) {
        await api.put(`/offers/${editingId}`, payload);
        toast.success("تم تحديث الحزمة بنجاح");
      } else {
        await api.post("/offers", payload);
        toast.success("تم إنشاء الحزمة بنجاح");
      }

      setIsModalOpen(false);
      fetchData();
    } catch (_err) {
      toast.error("فشل حفظ العرض");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOffer = async (id: any) => {
    if (!confirm("هل أنت متأكد من حذف هذا العرض؟")) return;
    try {
      await api.delete(`/offers/${id}`);
      toast.success("تم الحذف بنجاح");
      fetchData();
    } catch (_err) {
      toast.error("فشل الحذف");
    }
  };

  const availableProducts = useMemo(() => {
    return products.filter(
      (p: any) => !formData.products.find((x: any) => x.product_id === p.id),
    );
  }, [products, formData.products]);

  return {
    offers,
    products,
    loading,
    isModalOpen,
    setIsModalOpen,
    saving,
    uploading,
    editingId,
    formData,
    setFormData,
    totalPrice,
    availableProducts,
    openCreate,
    openEdit,
    handleImageUpload,
    handleAddProductToBundle,
    handleRemoveProduct,
    handleSave,
    handleDeleteOffer,
    fetchData,
  };
}