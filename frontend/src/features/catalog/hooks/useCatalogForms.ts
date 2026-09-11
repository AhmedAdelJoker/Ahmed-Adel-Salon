/**
 * Catalog feature: form state + CRUD (moved from ServicesManagement page, no logic changes).
 */
import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import serviceCategoryService from "@/services/serviceCategoryService";
import offerService from "@/services/offerService";
import type {
  CategoryFormData,
  CategoryRecord,
  ConfirmAction,
  OfferFormData,
  OfferRecord,
  ServiceFormData,
  ServiceIngredient,
  ServiceRecord,
} from "@/types/catalog";
import { DEFAULT_CATEGORY_FORM, DEFAULT_OFFER_FORM, DEFAULT_SERVICE_FORM } from "@/features/catalog/constants";
import { isItemActive } from "@/features/catalog/constants";
import { safePositive } from "@/lib/core/utils";

export function useCatalogForms(
  activeTab: string,
  refreshAllData: () => Promise<void>,
) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>({ ...DEFAULT_SERVICE_FORM });
  const [deleteTarget, setDeleteTarget] = useState<{ id: number | string; type: string } | null>(null);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryRecord | null>(null);
  const [catForm, setCatForm] = useState<CategoryFormData>({ ...DEFAULT_CATEGORY_FORM });
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<OfferRecord | null>(null);
  const [offerForm, setOfferForm] = useState<OfferFormData>({ ...DEFAULT_OFFER_FORM });

  const [isActionLoading, setIsActionLoading] = useState(false);
const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const resetServiceForm = useCallback(() => {
    setEditingService(null);
    setFormData({ ...DEFAULT_SERVICE_FORM });
  }, []);

  const resetCategoryForm = useCallback(() => {
    setEditingCat(null);
    setCatForm({ ...DEFAULT_CATEGORY_FORM });
  }, []);

  const resetOfferForm = useCallback(() => {
    setEditingOffer(null);
    setOfferForm({ ...DEFAULT_OFFER_FORM });
  }, []);

  const openCreateDialog = useCallback(() => {
    if (activeTab === "services") {
      resetServiceForm();
      setIsModalOpen(true);
      return;
    }

    if (activeTab === "categories") {
      resetCategoryForm();
      setIsCatModalOpen(true);
      return;
    }

    resetOfferForm();
    setIsOfferModalOpen(true);
  }, [activeTab, resetCategoryForm, resetOfferForm, resetServiceForm]);

  const _handleConfirmAction = async () => {
    if (!confirmAction) return;
    try {
      setIsActionLoading(true);
      if (confirmAction.type === "delete") {
        await confirmDelete();
      } else if (confirmAction.type === "toggle-category") {
        await serviceCategoryService.toggleActive(confirmAction.id);
        await refreshAllData();
      } else if (confirmAction.type === "toggle-offer") {
        await offerService.toggleActive(confirmAction.id);
        await refreshAllData();
      }
      setConfirmAction(null);
    } catch (err) {
      toast.error("فشل تنفيذ الإجراء");
    } finally {
      setIsActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "service") {
        await api.delete(`/services/${deleteTarget.id}`);
        toast.success("تم حذف الخدمة");
      } else if (deleteTarget.type === "category") {
        await serviceCategoryService.remove(deleteTarget.id);
        toast.success("تم حذف التصنيف");
      } else if (deleteTarget.type === "offer") {
        await offerService.remove(deleteTarget.id);
        toast.success("تم حذف العرض");
      }
      await refreshAllData();
      setDeleteTarget(null);
    } catch (err) {
      toast.error("فشل في تنفيذ الحذف");
    }
  };

  const handleSubmit = async () => {
    try {
      const normalizedPrice = safePositive(formData.price);
      if (!(formData.name_ar || formData.name).trim() || !normalizedPrice) {
        toast.error("يرجى إدخال البيانات الأساسية");
        return;
      }
      setIsActionLoading(true);
      const payload = {
        name: (
          formData.name ||
          formData.name_ar ||
          formData.name_en ||
          ""
        ).trim(),
        name_ar: formData.name_ar || null,
        name_en: formData.name_en || null,
        description_ar: formData.description_ar || null,
        description_en: formData.description_en || null,
        image_url: formData.image_url || null,
        price: normalizedPrice,
        duration_minutes: Number(formData.duration_minutes || 30),
        category: formData.category || null,
        category_id: formData.category_id
          ? parseInt(formData.category_id)
          : null,
        is_active: Boolean(formData.isActive),
        ingredients: (formData.ingredients as ServiceIngredient[]).map((ing) => ({
          product_id: ing.product_id,
          amount_used: Number(ing.amount_used),
        })),
      };
      if (editingService) {
        await api.put(`/services/${editingService.id}`, payload);
        toast.success("تم تحديث بيانات الخدمة");
      } else {
        await api.post("/services", payload);
        toast.success("تم إدراج الخدمة الجديدة بنجاح");
      }
      setIsModalOpen(false);
      resetServiceForm();
      await refreshAllData();
    } catch (err) {
      toast.error("حدث خطأ أثناء معالجة البيانات");
    } finally {
      setIsActionLoading(false);
    }
  };

  const startEdit = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name || "",
      name_ar: service.name_ar || "",
      name_en: service.name_en || "",
      description_ar: service.description_ar || "",
      description_en: service.description_en || "",
      price: service.price || "",
      category: service.category || "شعر",
      category_id: service.category_id?.toString() || "",
      image_url: service.image_url || service.imageUrl || "",
      isActive: isItemActive(service),
      duration_minutes: service.duration_minutes || 30,
      ingredients: (service.ingredients || []).map((ingredient: ServiceIngredient) => ({
        product_id: ingredient.product_id,
        amount_used: ingredient.amount_used,
      })),
    });
    setIsModalOpen(true);
  };

  const addIngredient = () => {
    setFormData((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { product_id: "", amount_used: 10 }],
    }));
  };

  const removeIngredient = (index) => {
    setFormData((prev) => ({
      ...prev,
      ingredients: (prev.ingredients || []).filter((_, i) => i !== index),
    }));
  };

  const updateIngredient = (index: number, field: string, value: unknown) => {
    const newIngredients = [...(formData.ingredients || [])];
    newIngredients[index] = { ...(newIngredients[index] || {}), [field]: value };
    setFormData((prev) => ({ ...prev, ingredients: newIngredients }));
  };

  const handleCatSubmit = async () => {
    try {
      if (!catForm.name.trim()) {
        toast.error("يرجى إدخال اسم التصنيف");
        return;
      }
      setIsActionLoading(true);
      if (editingCat) {
        await serviceCategoryService.update(editingCat.id, catForm);
        toast.success("تم تحديث التصنيف");
      } else {
        await serviceCategoryService.create(catForm);
        toast.success("تم إضافة التصنيف");
      }
      setIsCatModalOpen(false);
      resetCategoryForm();
      await refreshAllData();
    } catch (err) {
      toast.error("حدث خطأ");
    } finally {
      setIsActionLoading(false);
    }
  };

  const startCatEdit = (cat) => {
    setEditingCat(cat);
    setCatForm({
      name: cat.name || "",
      name_ar: cat.name_ar || "",
      icon: cat.icon || "",
      sort_order: cat.sort_order || 0,
      is_active: isItemActive(cat),
    });
    setIsCatModalOpen(true);
  };

  const handleOfferSubmit = async () => {
    try {
      if (
        !(offerForm.name || offerForm.name_ar).trim() ||
        !offerForm.offer_price
      ) {
        toast.error("يرجى إدخال اسم وسعر العرض");
        return;
      }
      if (offerForm.service_ids.length === 0) {
        toast.error("اختر خدمة واحدة على الأقل داخل العرض");
        return;
      }
      if (
        offerForm.start_date &&
        offerForm.end_date &&
        offerForm.end_date < offerForm.start_date
      ) {
        toast.error("تاريخ نهاية العرض يجب أن يكون بعد تاريخ البداية");
        return;
      }
      setIsActionLoading(true);
      const payload = {
        name: (
          offerForm.name ||
          offerForm.name_ar ||
          offerForm.name_en ||
          ""
        ).trim(),
        name_ar: offerForm.name_ar || null,
        name_en: offerForm.name_en || null,
        description: offerForm.description || offerForm.description_ar || null,
        description_ar: offerForm.description_ar || null,
        description_en: offerForm.description_en || null,
        image_url: offerForm.image_url || null,
        original_price: offerForm.original_price
          ? safePositive(offerForm.original_price)
          : null,
        offer_price: safePositive(offerForm.offer_price),
        discount_percentage: offerForm.discount_percentage
          ? safePositive(offerForm.discount_percentage)
          : null,
        start_date: offerForm.start_date || null,
        end_date: offerForm.end_date || null,
      };
      if (editingOffer) {
        await offerService.update(editingOffer.id, payload);
        toast.success("تم تحديث العرض");
      } else {
        await offerService.create(payload);
        toast.success("تم إضافة العرض");
      }
      setIsOfferModalOpen(false);
      resetOfferForm();
      await refreshAllData();
    } catch (err) {
      toast.error("حدث خطأ");
    } finally {
      setIsActionLoading(false);
    }
  };

  const startOfferEdit = (offer) => {
    setEditingOffer(offer);
    setOfferForm({
      name: offer.name || "",
      name_ar: offer.name_ar || "",
      name_en: offer.name_en || "",
      description: offer.description || "",
      description_ar: offer.description_ar || "",
      description_en: offer.description_en || "",
      image_url: offer.image_url || offer.imageUrl || "",
      original_price: offer.original_price?.toString() || "",
      offer_price: offer.offer_price?.toString() || "",
      discount_percentage: offer.discount_percentage?.toString() || "",
      start_date: offer.start_date || "",
      end_date: offer.end_date || "",
      is_public: offer.is_public ?? true,
      is_active: isItemActive(offer),
      service_ids: (offer.services || []).map((s) => s.id),
    });
    setIsOfferModalOpen(true);
  };

  const toggleOfferService = (sid: number | string) => {
    setOfferForm((prev) => ({
      ...prev,
      service_ids: prev.service_ids.includes(sid)
        ? prev.service_ids.filter((id) => id !== sid)
        : [...prev.service_ids, sid],
    }));
  };


  return {
    formData,
    setFormData,
    editingService,
    isModalOpen,
    setIsModalOpen,
    catForm,
    setCatForm,
    editingCat,
    isCatModalOpen,
    setIsCatModalOpen,
    offerForm,
    setOfferForm,
    editingOffer,
    isOfferModalOpen,
    setIsOfferModalOpen,
    deleteTarget,
    setDeleteTarget,
    confirmAction,
    setConfirmAction,
    isActionLoading,
    openCreateDialog,
    handleSubmit,
    startEdit,
    addIngredient,
    removeIngredient,
    updateIngredient,
    handleCatSubmit,
    startCatEdit,
    handleOfferSubmit,
    startOfferEdit,
    toggleOfferService,
    confirmDelete,
  };
}
