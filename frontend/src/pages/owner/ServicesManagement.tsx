import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { normalizeListResponse } from "@/services/apiAdapter";
import serviceCategoryService from "@/services/serviceCategoryService";
import offerService from "@/services/offerService";
import { toast } from "react-hot-toast";
import type {
  CategoryFormData,
  CategoryRecord,
  ConfirmAction,
  OfferFormData,
  OfferRecord,
  ProductRecord,
  ServiceFormData,
  ServiceRecord,
  ServiceIngredient,
} from "@/types/catalog";
import {
  Scissors,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Zap,
  CheckCircle,
  XCircle,
  Layers,
  Gift,
  Percent,
  RefreshCw,
  Search,
  Package,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, safePositive, cn } from "@/lib/core/utils";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { validateImageSize } from "@/lib/media/upload";
import {
  PageHeader,
  StatCard,
  ContentPanel,
} from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const TABS = [
  {
    key: "services",
    label: "الخدمات",
    icon: Scissors,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    key: "categories",
    label: "التصنيفات",
    icon: Layers,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  {
    key: "offers",
    label: "العروض",
    icon: Gift,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
];

const DEFAULT_SERVICE_FORM = {
  name: "",
  name_ar: "",
  name_en: "",
  description_ar: "",
  description_en: "",
  duration_minutes: 30,
  price: "",
  category: "شعر",
  category_id: "",
  image_url: "",
  isActive: true,
  ingredients: [],
};

const DEFAULT_CATEGORY_FORM = {
  name: "",
  name_ar: "",
  icon: "",
  sort_order: 0,
  is_active: true,
};

const DEFAULT_OFFER_FORM = {
  name: "",
  name_ar: "",
  name_en: "",
  description: "",
  description_ar: "",
  description_en: "",
  image_url: "",
  original_price: "",
  offer_price: "",
  discount_percentage: "",
  start_date: new Date().toISOString().split("T")[0],
  end_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
  is_active: true,
  service_ids: [],
  is_public: false,
};

const _FALLBACK_SERVICE_CATEGORIES = [
  { value: "شعر", label: "حلاقة وتصفيف شعر" },
  { value: "ذقن", label: "تهذيب وحلاقة ذقن" },
  { value: "بشرة", label: "ماسك وعناية بشرة" },
  { value: "عناية", label: "باقات عناية متكاملة" },
];

function isItemActive(item) {
  return item?.isActive ?? item?.is_active ?? false;
}

const ServicesManagement = ({ hideHeader = false }: { hideHeader?: boolean }) => {
  const [activeTab, setActiveTab] = useState("services");
  const [searchTerm, setSearchTerm] = useState("");

  // Services state
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>({ ...DEFAULT_SERVICE_FORM });
  const [deleteTarget, setDeleteTarget] = useState<{ id: number | string; type: string } | null>(null);

  // Categories state
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryRecord | null>(null);
  const [catForm, setCatForm] = useState<CategoryFormData>({ ...DEFAULT_CATEGORY_FORM });

  // Offers state
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<OfferRecord | null>(null);
  const [offerForm, setOfferForm] = useState<OfferFormData>({ ...DEFAULT_OFFER_FORM });

  const [_isUploading, setUploading] = useState(false);

  // Inventory state for ingredients
  const [products, setProducts] = useState<ProductRecord[]>([]);

  const _handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, type = "service") => {
    const file = event.target.files?.[0];
    if (!file || !validateImageSize(file)) return;

    const uploadPayload = new FormData();
    uploadPayload.append("file", file);

    try {
      setUploading(true);
      const response = await api.post("/services/upload-image", uploadPayload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const url = response.data.url;
      if (type === "service") {
        setFormData((prev) => ({ ...prev, image_url: url }));
      } else {
        setOfferForm((prev) => ({ ...prev, image_url: url }));
      }
      toast.success("تم رفع الصورة بنجاح");
    } catch (_error) {
      console.error("Upload error:", _error);
      toast.error("فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const fetchServices = useCallback(async () => {
    try {
      setServicesLoading(true);
      const res = await api.get("/services", { params: { limit: 1000 } });
      const data = normalizeListResponse(res).items;
      setServices(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("فشل في مزامنة قائمة الخدمات");
    } finally {
      setServicesLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const res = await serviceCategoryService.list();
      setCategories(Array.isArray(res.items) ? res.items : []);
    } catch (err) {
      console.error("Failed to fetch categories");
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const fetchOffers = useCallback(async () => {
    try {
      setOffersLoading(true);
      const res = await offerService.list();
      setOffers(Array.isArray(res.items) ? res.items : []);
    } catch (err) {
      console.error("Failed to fetch offers");
    } finally {
      setOffersLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get("/products", { params: { limit: 1000 } });
      const data = normalizeListResponse(res);
      setProducts(data.items || []);
    } catch (err) {
      console.error("Failed to fetch products for ingredients");
    }
  }, []);

  const refreshAllData = useCallback(
    async ({ showLoader = false } = {}) => {
      try {
        if (!showLoader) setRefreshing(true);

        await Promise.all([
          fetchServices(),
          fetchCategories(),
          fetchOffers(),
          fetchProducts(),
        ]);
      } finally {
        setRefreshing(false);
      }
    },
    [fetchCategories, fetchOffers, fetchServices, fetchProducts],
  );

  useEffect(() => {
    refreshAllData({ showLoader: true });
  }, [refreshAllData]);

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

  const serviceRows = useMemo(
    () => (Array.isArray(services) ? services : []),
    [services],
  );
  const categoryRows = useMemo(
    () => (Array.isArray(categories) ? categories : []),
    [categories],
  );
  const offerRows = useMemo(
    () => (Array.isArray(offers) ? offers : []),
    [offers],
  );
  const productRows = useMemo(
    () => (Array.isArray(products) ? products : []),
    [products],
  );
  const productIndex = useMemo(
    () => new Map(productRows.map((product) => [Number(product.id), product])),
    [productRows],
  );

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredServiceRows = useMemo(() => {
    if (!normalizedSearchTerm) return serviceRows;

    return serviceRows.filter((service) => {
      const haystack = [
        service?.name,
        service?.name_ar,
        service?.category,
        service?.price,
        isItemActive(service) ? "نشط متاح" : "معطل متوقف",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearchTerm);
    });
  }, [normalizedSearchTerm, serviceRows]);

  const filteredCategoryRows = useMemo(() => {
    if (!normalizedSearchTerm) return categoryRows;

    return categoryRows.filter((category) => {
      const haystack = [
        category?.name,
        category?.name_ar,
        category?.icon,
        isItemActive(category) ? "نشط" : "معطل",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearchTerm);
    });
  }, [categoryRows, normalizedSearchTerm]);

  const filteredOfferRows = useMemo(() => {
    if (!normalizedSearchTerm) return offerRows;

    return offerRows.filter((offer) => {
      const includedServices = Array.isArray(offer?.services)
        ? offer.services.map((service) => service?.name).join(" ")
        : "";
      const haystack = [
        offer?.name,
        offer?.description,
        offer?.offer_price,
        offer?.discount_percentage,
        includedServices,
        offer?.is_public ? "عام" : "داخلي",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearchTerm);
    });
  }, [normalizedSearchTerm, offerRows]);

  const getIngredientProduct = useCallback(
    (ingredient) => {
      const productId = Number(ingredient?.product_id);
      if (productIndex.has(productId)) {
        return productIndex.get(productId);
      }

      return {
        id: ingredient?.product_id,
        name: ingredient?.product_name,
        unit: ingredient?.product_unit || "g",
        quantity: ingredient?.product_quantity || 0,
        cost_price: ingredient?.product_cost_price || 0,
        weight: ingredient?.product_weight || 0,
      };
    },
    [productIndex],
  );

  const getProductGramCost = useCallback((product) => {
    const weight = Number(product?.weight || 0);
    const costPrice = Number(product?.cost_price || 0);

    if (weight > 0) return costPrice / weight;
    if ((product?.unit || "g").toLowerCase() === "g") return costPrice;
    return 0;
  }, []);

  const getIngredientCost = useCallback(
    (ingredient) => {
      const amountUsed = Number(ingredient?.amount_used || 0);
      const product = getIngredientProduct(ingredient);
      return amountUsed * getProductGramCost(product);
    },
    [getIngredientProduct, getProductGramCost],
  );

  const getServiceOperationalCost = useCallback(
    (service) =>
      (service?.ingredients || []).reduce(
        (sum, ingredient) => sum + getIngredientCost(ingredient),
        0,
      ),
    [getIngredientCost],
  );

  const getServiceProfit = useCallback(
    (service) =>
      Number(service?.price || 0) - getServiceOperationalCost(service),
    [getServiceOperationalCost],
  );

  const getServiceMargin = useCallback(
    (service) => {
      const price = Number(service?.price || 0);
      if (price <= 0) return 0;
      return (getServiceProfit(service) / price) * 100;
    },
    [getServiceProfit],
  );

  const getServiceLowStockCount = useCallback(
    (service) =>
      (service?.ingredients || []).filter((ingredient) => {
        const product = getIngredientProduct(ingredient);
        return (
          Number(product?.quantity || 0) < Number(ingredient?.amount_used || 0)
        );
      }).length,
    [getIngredientProduct],
  );

  const serviceSummary = useMemo(
    () => ({
      total: serviceRows.length,
      active: serviceRows.filter((service) => isItemActive(service)).length,
      categories: new Set(
        serviceRows.map((service) => service.category).filter(Boolean),
      ).size,
      averageMargin:
        serviceRows.length > 0
          ? serviceRows.reduce(
              (sum, service) => sum + getServiceMargin(service),
              0,
            ) / serviceRows.length
          : 0,
      lowStock: serviceRows.filter(
        (service) => getServiceLowStockCount(service) > 0,
      ).length,
    }),
    [getServiceLowStockCount, getServiceMargin, serviceRows],
  );

  const _serviceFormInsights = useMemo(() => {
    const ingredients = (formData.ingredients as ServiceIngredient[]) || [];
    const totals = ingredients.reduce<{
      totalCost: number;
      lowStockCount: number;
      missingCostCount: number;
    }>((accumulator, ingredient) => {
        const amountUsed = Number(ingredient?.amount_used || 0);
        const product = getIngredientProduct(ingredient);
        const unitCost = getProductGramCost(product);
        const lineCost = amountUsed * unitCost;
        const availableQuantity = Number(product?.quantity || 0);

        return {
          totalCost: accumulator.totalCost + lineCost,
          lowStockCount:
            accumulator.lowStockCount +
            (ingredient?.product_id && availableQuantity < amountUsed ? 1 : 0),
          missingCostCount:
            accumulator.missingCostCount +
            (ingredient?.product_id && unitCost <= 0 ? 1 : 0),
        };
      },
      { totalCost: 0, lowStockCount: 0, missingCostCount: 0 },
    );

    const servicePrice = Number(formData.price || 0);
    const projectedProfit = servicePrice - totals.totalCost;
    const projectedMargin =
      servicePrice > 0 ? (projectedProfit / servicePrice) * 100 : 0;

    return {
      ...totals,
      projectedProfit,
      projectedMargin,
    };
  }, [
    formData.ingredients,
    formData.price,
    getIngredientProduct,
    getProductGramCost,
  ]);

  const currentSearchPlaceholder =
    activeTab === "services"
      ? "ابحث عن خدمة أو تصنيف..."
      : activeTab === "categories"
        ? "ابحث عن تصنيف..."
        : "ابحث عن عرض أو خدمة مشمولة...";

  const _activeResultCount =
    activeTab === "services"
      ? filteredServiceRows.length
      : activeTab === "categories"
        ? filteredCategoryRows.length
        : filteredOfferRows.length;

const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  // --- Common Action Handler ---
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

  // --- Common Delete Handler ---
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

  // --- Services CRUD ---
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

  // --- Categories CRUD ---
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

  // --- Offers CRUD ---
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

  const loading = servicesLoading || categoriesLoading || offersLoading;

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-accent">
          <Zap className="w-10 h-10 animate-pulse" />
          <p className="text-muted font-bold text-sm">
            جاري مزامنة لائحة الخدمات...
          </p>
        </div>
      </div>
    );

  return (
    <div className={`erp-page space-y-8 pb-12`} dir="rtl">
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          deleteTarget?.type === "service"
            ? "حذف الخدمة؟"
            : deleteTarget?.type === "category"
              ? "حذف التصنيف؟"
              : "حذف العرض؟"
        }
        description="هل أنت متأكد من الحذف؟ لا يمكن التراجع عن هذا الإجراء."
        onConfirm={confirmDelete}
        loading={isActionLoading}
      />

      <PageHeader
        title="إدارة الخدمات"
        subtitle="إدارة الخدمات، التصنيفات، العروض، وربط استهلاك المنتجات من مساحة تشغيلية واحدة."
        badge="كتالوج العمليات"
        icon={Zap}
        actions={
          <Button
            onClick={openCreateDialog}
            className="h-11 px-8 shadow-accent"
          >
            {activeTab === "services"
              ? "إضافة خدمة"
              : activeTab === "categories"
                ? "إضافة تصنيف"
                : "إضافة عرض"}{" "}
            <Plus className="mr-2" size={18} />
          </Button>
        }
      />

      {/* Advanced Tabs Navigation */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex bg-card/80 backdrop-blur-md border border-border/50 p-1.5 rounded-2xl shadow-soft">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "relative flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300",
                    isActive
                      ? "bg-white dark:bg-black/40 text-main shadow-premium border border-border/10 scale-105 z-10"
                      : "text-muted hover:text-main hover:bg-soft",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                      isActive ? tab.bg : "bg-transparent",
                    )}
                  >
                    <Icon
                      size={16}
                      className={isActive ? tab.color : "text-muted"}
                    />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute inset-0 bg-primary/5 rounded-xl -z-10"
                      initial={false}
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <div className="h-1 w-12 rounded-full bg-border/40" />
            <Badge
              variant="outline"
              className="h-9 rounded-xl px-4 font-black uppercase tracking-widest text-[9px] bg-card/50"
            >
              كتالوج العمليات النشط
            </Badge>
          </div>
        </div>

        {/* Toolbar: Search and Global Actions */}
        <div className="flex flex-col lg:flex-row items-center gap-4">
          <div className="relative flex-1 w-full group">
            <Search
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors duration-300"
              size={18}
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={currentSearchPlaceholder}
              className="h-14 w-full pr-12 rounded-[18px] border-border/60 bg-card shadow-soft-sm focus:bg-white dark:focus:bg-black/20 focus:ring-4 focus:ring-primary/5 text-sm font-bold transition-all duration-300"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-soft flex items-center justify-center text-muted hover:text-main transition-colors"
              >
                <XCircle size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Button
              variant="outline"
              onClick={() => refreshAllData()}
              disabled={refreshing}
              className="h-14 flex-1 lg:flex-initial rounded-[18px] border-border/60 bg-card px-6 font-black text-xs uppercase tracking-widest hover:bg-soft transition-all"
            >
              <RefreshCw
                size={16}
                className={cn("ml-2", refreshing && "animate-spin")}
              />
              تحديث البيانات
            </Button>

            <Button
              onClick={openCreateDialog}
              className="h-14 flex-1 lg:flex-initial rounded-[18px] px-8 font-black text-xs uppercase tracking-widest shadow-premium hover:scale-[1.02] transition-all"
            >
              <Plus size={18} className="ml-2" />
              {activeTab === "services"
                ? "إضافة خدمة"
                : activeTab === "categories"
                  ? "إضافة تصنيف"
                  : "إنشاء عرض"}
            </Button>
          </div>
        </div>
      </div>

      {/* ====== TAB: SERVICES ====== */}
      {activeTab === "services" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard
              label="إجمالي الخدمات"
              value={serviceSummary.total}
              icon={Scissors}
              variant="info"
              delay={0.1}
            />
            <StatCard
              label="خدمات نشطة"
              value={serviceSummary.active}
              icon={Sparkles}
              variant="success"
              delay={0.2}
            />
            <StatCard
              label="الفئات الفنية"
              value={serviceSummary.categories}
              icon={Layers}
              variant="primary"
              delay={0.3}
            />
            <StatCard
              label="متوسط الهامش"
              value={`${serviceSummary.averageMargin.toFixed(1)}%`}
              icon={Percent}
              variant="warning"
              trend={serviceSummary.averageMargin > 40 ? "up" : "down"}
              trendValue={serviceSummary.averageMargin.toFixed(0)}
              delay={0.4}
            />
            <StatCard
              label="نقص مخزوني"
              value={serviceSummary.lowStock}
              icon={Package}
              variant="danger"
              delay={0.5}
            />
          </div>

          <ContentPanel
            title="لائحة الخدمات والأسعار المعتمدة"
            subtitle="عرض وتحليل أداء الخدمات، التكاليف التشغيلية، وهوامش الربح لكل عملية."
            noPadding
          >
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-soft/30">
                  <TableRow className="hover:bg-transparent border-border/40 h-16">
                    <TableHead className="font-black text-muted px-8 text-right text-[10px] uppercase tracking-[0.15em]">
                      الخدمة والوصف
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      التصنيف الفني
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      سعر البيع
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      التكلفة والربح
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      الوقت القياسي
                    </TableHead>
                    <TableHead className="font-black text-muted text-center text-[10px] uppercase tracking-[0.15em]">
                      الحالة التشغيلية
                    </TableHead>
                    <TableHead className="font-black text-muted text-left px-8 text-[10px] uppercase tracking-[0.15em]">
                      الإجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServiceRows.map((service, _idx) => (
                    <TableRow
                      key={service.id}
                      className="group border-border/40 hover:bg-soft/40 transition-all duration-200"
                    >
                      <TableCell className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-soft flex items-center justify-center text-primary/40 group-hover:text-primary group-hover:bg-primary/10 transition-all">
                            <Scissors size={20} />
                          </div>
                          <div>
                            <div className="font-black text-main text-sm leading-none mb-1.5">
                              {service.name_ar || service.name}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="h-5 px-1.5 rounded-md text-[8px] font-bold text-muted border-border/40"
                              >
                                ID: {service.id}
                              </Badge>
                              {(service.ingredients || []).length > 0 && (
                                <span className="text-[10px] font-bold text-primary/60">
                                  • {(service.ingredients || []).length} منتجات مربوطة
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="rounded-lg px-3 py-1.5 font-black text-[9px] uppercase tracking-widest bg-soft/50 border-none text-muted-foreground"
                        >
                          {service.category || "عام"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-lg font-black text-primary tracking-tighter tabular-nums">
                          {service.price}
                          <span className="text-[10px] text-muted font-bold mr-1 uppercase">
                            ج.م
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted w-12">
                              التكلفة:
                            </span>
                            <span className="text-xs font-black text-main tabular-nums">
                              {formatCurrency(
                                getServiceOperationalCost(service),
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted w-12">
                              الربح:
                            </span>
                            <span
                              className={cn(
                                "text-xs font-black tabular-nums px-1.5 rounded bg-opacity-10",
                                getServiceProfit(service) >= 0
                                  ? "text-emerald-600 bg-emerald-500"
                                  : "text-rose-600 bg-rose-500",
                              )}
                            >
                              {formatCurrency(getServiceProfit(service))}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-black text-main tabular-nums">
                          <Clock size={14} className="text-muted" />
                          {service.duration_minutes || 30}
                          <span className="text-[10px] text-muted font-bold mr-1">
                            دقيقة
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          {isItemActive(service) ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 font-black text-[10px] uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
                              <CheckCircle size={12} strokeWidth={3} /> متاحة
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-rose-600 font-black text-[10px] uppercase tracking-widest bg-rose-500/10 px-3 py-1 rounded-full">
                              <XCircle size={12} strokeWidth={3} /> معطلة
                            </div>
                          )}
                          {getServiceLowStockCount(service) > 0 && (
                            <div className="flex items-center gap-1.5 text-amber-600 font-black text-[8px] uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-200/50">
                              <AlertTriangle size={10} /> نقص مخزون
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-8">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(service)}
                            className="h-10 w-10 rounded-xl text-muted hover:text-primary hover:bg-primary/5"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDeleteTarget({
                                id: service.id as number | string,
                                type: "service",
                              })
                            }
                            className="h-10 w-10 rounded-xl text-muted hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredServiceRows.length === 0 && (
              <div className="py-32 flex flex-col items-center justify-center text-center opacity-40">
                <div className="h-20 w-20 rounded-3xl bg-soft flex items-center justify-center mb-6">
                  <Scissors size={40} className="text-muted" />
                </div>
                <h4 className="text-lg font-black text-main uppercase tracking-widest">
                  لا توجد خدمات مطابقة
                </h4>
                <p className="text-xs font-bold text-muted mt-2">
                  جرب تعديل معايير البحث أو إضافة خدمة جديدة
                </p>
              </div>
            )}
          </ContentPanel>
        </div>
      )}

      {/* ====== TAB: CATEGORIES ====== */}
      {activeTab === "categories" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ContentPanel
            title="إدارة التصنيفات الفنية"
            subtitle="تنظيم الخدمات في مجموعات منطقية لتسهيل الوصول إليها في الـ POS والموقع العام."
            noPadding
          >
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-soft/30">
                  <TableRow className="hover:bg-transparent border-border/40 h-16">
                    <TableHead className="font-black text-muted px-8 text-right text-[10px] uppercase tracking-[0.15em]">
                      التصنيف
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      ترتيب العرض
                    </TableHead>
                    <TableHead className="font-black text-muted text-center text-[10px] uppercase tracking-[0.15em]">
                      حالة الظهور
                    </TableHead>
                    <TableHead className="font-black text-muted text-left px-8 text-[10px] uppercase tracking-[0.15em]">
                      إجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategoryRows.map((cat) => (
                    <TableRow
                      key={cat.id}
                      className="group border-border/40 hover:bg-soft/40 transition-all duration-200"
                    >
                      <TableCell className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black">
                            {cat.name_ar?.charAt(0) || cat.name?.charAt(0)}
                          </div>
                          <div className="font-black text-main text-sm">
                            {cat.name_ar || cat.name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="h-8 w-8 rounded-lg bg-soft flex items-center justify-center font-black text-xs text-muted">
                          {cat.sort_order || 0}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {isItemActive(cat) ? (
                          <Badge
                            variant="success"
                            className="px-4 rounded-full font-black text-[9px] uppercase tracking-widest"
                          >
                            نشط
                          </Badge>
                        ) : (
                          <Badge
                            variant="danger"
                            className="px-4 rounded-full font-black text-[9px] uppercase tracking-widest"
                          >
                            معطل
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-8">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startCatEdit(cat)}
                            className="h-10 w-10 rounded-xl text-muted hover:text-primary hover:bg-primary/5"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDeleteTarget({ id: cat.id as number | string, type: "category" })
                            }
                            className="h-10 w-10 rounded-xl text-muted hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ContentPanel>
        </div>
      )}

      {/* ====== TAB: OFFERS ====== */}
      {activeTab === "offers" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ContentPanel
            title="باقات العروض الترويجية"
            subtitle="إدارة الحزم التسويقية والخصومات الزمنية لزيادة معدل مبيعات الخدمات."
            noPadding
          >
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-soft/30">
                  <TableRow className="hover:bg-transparent border-border/40 h-16">
                    <TableHead className="font-black text-muted px-8 text-right text-[10px] uppercase tracking-[0.15em]">
                      العرض والوصف
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      السعر الجديد
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      الخصم الفعلي
                    </TableHead>
                    <TableHead className="font-black text-muted text-center text-[10px] uppercase tracking-[0.15em]">
                      الحالة
                    </TableHead>
                    <TableHead className="font-black text-muted text-left px-8 text-[10px] uppercase tracking-[0.15em]">
                      إجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOfferRows.map((offer) => (
                    <TableRow
                      key={offer.id}
                      className="group border-border/40 hover:bg-soft/40 transition-all duration-200"
                    >
                      <TableCell className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                            <Gift size={24} />
                          </div>
                          <div>
                            <div className="font-black text-main text-sm mb-1">
                              {offer.name_ar || offer.name}
                            </div>
                            <div className="text-[10px] font-bold text-muted line-clamp-1 max-w-[200px]">
                              {offer.description_ar ||
                                offer.description ||
                                "بدون وصف إضافي"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-lg font-black text-emerald-600 tracking-tighter tabular-nums">
                            {offer.offer_price}{" "}
                            <span className="text-[9px] font-bold mr-1">
                              ج.م
                            </span>
                          </div>
                          {offer.original_price && (
                            <div className="text-[10px] font-bold text-muted line-through opacity-60">
                              {offer.original_price} ج.م
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 font-black text-[11px] tabular-nums">
                          <Percent size={12} />
                          {offer.discount_percentage || 0}%
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {isItemActive(offer) ? (
                          <Badge
                            variant="success"
                            className="px-4 rounded-full font-black text-[9px] uppercase tracking-widest"
                          >
                            نشط
                          </Badge>
                        ) : (
                          <Badge
                            variant="danger"
                            className="px-4 rounded-full font-black text-[9px] uppercase tracking-widest"
                          >
                            معطل
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-8">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startOfferEdit(offer)}
                            className="h-10 w-10 rounded-xl text-muted hover:text-primary hover:bg-primary/5"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDeleteTarget({ id: offer.id as number | string, type: "offer" })
                            }
                            className="h-10 w-10 rounded-xl text-muted hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ContentPanel>
        </div>
      )}

      {/* ====== MODAL: SERVICE ADD/EDIT ====== */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="sm:max-w-[620px] bg-card border-border"
          dir="rtl"
        >
          <DialogHeader className="text-right">
            <DialogTitle className="text-xl font-black text-main">
              {editingService
                ? "تعديل بيانات الخدمة"
                : "إضافة خدمة جديدة للكتالوج"}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted">
              قم بملء تفاصيل الخدمة والأسعار والمواد المستهلكة من المخزون بدقة.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4 max-h-[60vh] overflow-y-auto pl-2 custom-scrollbar">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  اسم الخدمة (عربي)
                </label>
                <Input
                  value={formData.name_ar}
                  onChange={(e) =>
                    setFormData({ ...formData, name_ar: e.target.value })
                  }
                  placeholder="مثال: حلاقة شعر وتصفيف مميز"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  السعر (ج.م)
                </label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="0.00"
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  المدة المتوقعة (بالدقائق)
                </label>
                <Input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration_minutes: Number(e.target.value),
                    })
                  }
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  تصنيف الفئة
                </label>
                <Select
                  value={formData.category_id}
                  onValueChange={(val) => {
                    const found = categories.find(
                      (c) => (c.id?.toString() ?? "") === val,
                    );
                    setFormData({
                      ...formData,
                      category_id: val,
                      category: found?.name || "",
                    });
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl border-border">
                    <SelectValue placeholder="اختر التصنيف الفني" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {categories.map((c) => (
                      <SelectItem key={c.id ?? ""} value={c.id?.toString() ?? ""}>
                        {c.name_ar || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Link Ingredients / Products */}
            <div className="space-y-3 border-t border-border/40 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-muted uppercase tracking-wider">
                  ربط استهلاك المواد والمنتجات (المخزون التشغيلي)
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addIngredient}
                  className="h-9 rounded-xl px-3 font-bold text-xs"
                >
                  <Plus size={14} className="ml-1.5" /> إضافة منتج مستهلك
                </Button>
              </div>

              {(formData.ingredients as ServiceIngredient[]).map((ing, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 bg-soft p-3 rounded-xl border border-border/30"
                >
                  <div className="flex-1">
                    <Select
                      value={ing.product_id?.toString()}
                      onValueChange={(val) =>
                        updateIngredient(idx, "product_id", val)
                      }
                    >
                      <SelectTrigger className="h-10 rounded-lg border-border text-xs">
                        <SelectValue placeholder="اختر المنتج المستهلك" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {products.map((p) => (
                          <SelectItem key={p.id?.toString()} value={p.id?.toString() || ""}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      placeholder="الكمية المستهلكة"
                      value={ing.amount_used}
                      onChange={(e) =>
                        updateIngredient(idx, "amount_used", e.target.value)
                      }
                      className="h-10 rounded-lg text-xs text-center"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeIngredient(idx)}
                    className="h-10 w-10 text-muted hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border/40 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="h-11 rounded-xl font-bold"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              loading={isActionLoading}
              className="h-11 rounded-xl px-6 font-black"
            >
              حفظ وتأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== MODAL: CATEGORY ADD/EDIT ====== */}
      <Dialog open={isCatModalOpen} onOpenChange={setIsCatModalOpen}>
        <DialogContent className="bg-card border-border" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-xl font-black text-main">
              {editingCat ? "تعديل التصنيف" : "إضافة تصنيف جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-main">
                اسم التصنيف (عربي)
              </label>
              <Input
                value={catForm.name_ar}
                onChange={(e) =>
                  setCatForm({
                    ...catForm,
                    name_ar: e.target.value,
                    name: e.target.value,
                  })
                }
                placeholder="مثال: عناية بالبشرة والوجه"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-main">
                ترتيب الأولوية في العرض
              </label>
              <Input
                type="number"
                value={catForm.sort_order}
                onChange={(e) =>
                  setCatForm({
                    ...catForm,
                    sort_order: parseInt(e.target.value) || 0,
                  })
                }
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border/40 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsCatModalOpen(false)}
              className="h-11 rounded-xl font-bold"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleCatSubmit}
              loading={isActionLoading}
              className="h-11 rounded-xl px-6 font-black"
            >
              حفظ التصنيف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== MODAL: OFFER ADD/EDIT ====== */}
      <Dialog open={isOfferModalOpen} onOpenChange={setIsOfferModalOpen}>
        <DialogContent
          className="sm:max-w-[520px] bg-card border-border"
          dir="rtl"
        >
          <DialogHeader className="text-right">
            <DialogTitle className="text-xl font-black text-main">
              {editingOffer ? "تعديل باقة العرض" : "إنشاء باقة عرض جديدة"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              إنشاء عروض ترويجية تجمع عدة خدمات بسعر مخفض للعملاء.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pl-2 custom-scrollbar">
            <div className="space-y-2">
              <label className="text-xs font-black text-main">
                اسم العرض الترويجي
              </label>
              <Input
                value={offerForm.name_ar}
                onChange={(e) =>
                  setOfferForm({
                    ...offerForm,
                    name_ar: e.target.value,
                    name: e.target.value,
                  })
                }
                placeholder="مثال: عرض الصيف الذهبي المتكامل"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  سعر العرض (ج.م)
                </label>
                <Input
                  type="number"
                  value={offerForm.offer_price}
                  onChange={(e) =>
                    setOfferForm({ ...offerForm, offer_price: e.target.value })
                  }
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  السعر الأصلي للمقارنة
                </label>
                <Input
                  type="number"
                  value={offerForm.original_price}
                  onChange={(e) =>
                    setOfferForm({
                      ...offerForm,
                      original_price: e.target.value,
                    })
                  }
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  تاريخ بداية العرض
                </label>
                <Input
                  type="date"
                  value={offerForm.start_date}
                  onChange={(e) =>
                    setOfferForm({ ...offerForm, start_date: e.target.value })
                  }
                  className="h-11 rounded-xl text-right"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-main">
                  تاريخ انتهاء العرض
                </label>
                <Input
                  type="date"
                  value={offerForm.end_date}
                  onChange={(e) =>
                    setOfferForm({ ...offerForm, end_date: e.target.value })
                  }
                  className="h-11 rounded-xl text-right"
                />
              </div>
            </div>
            <div className="space-y-2 border-t border-border/40 pt-4">
              <label className="text-xs font-black text-muted block mb-2">
                اختر الخدمات المشمولة داخل هذا العرض:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto border border-border p-3 rounded-xl bg-soft custom-scrollbar">
                {services.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2.5 text-xs font-bold p-1.5 cursor-pointer hover:bg-card rounded-lg transition-colors text-main"
                  >
                    <input
                      type="checkbox"
                      checked={offerForm.service_ids.includes(s.id as number | string)}
                      onChange={() => s.id && toggleOfferService(s.id as number | string)}
                      className="rounded accent-accent h-4 w-4"
                    />
                    {s.name_ar || s.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border/40 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsOfferModalOpen(false)}
              className="h-11 rounded-xl font-bold"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleOfferSubmit}
              loading={isActionLoading}
              className="h-11 rounded-xl px-6 font-black"
            >
              تفعيل ونشر العرض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesManagement;
