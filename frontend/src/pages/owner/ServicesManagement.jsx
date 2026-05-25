import { useAuth } from "../../context/AuthContext";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import api from "../../services/api";
import { normalizeListResponse } from "../../services/apiAdapter";
import serviceCategoryService from "../../services/serviceCategoryService";
import offerService from "../../services/offerService";
import { toast } from "react-hot-toast";
import {
  Scissors,
  Tag,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Zap,
  CheckCircle,
  XCircle,
  ChevronRight,
  Layers,
  Gift,
  CalendarDays,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  Percent,
  RefreshCw,
  Search,
  Image as ImageIcon,
  Package,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { safePositive } from "../../lib/utils";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";

const TABS = [
  { key: "services", label: "الخدمات", icon: Scissors },
  { key: "categories", label: "التصنيفات", icon: Layers },
  { key: "offers", label: "العروض", icon: Gift },
];
const DEFAULT_SERVICE_FORM = {
  name: "",
  name_ar: "",
  name_en: "",
  description_ar: "",
  description_en: "",
  price: "",
  category: "شعر",
  category_id: "",
  imageUrl: "",
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
  description: "",
  description_ar: "",
  description_en: "",
  imageUrl: "",
  original_price: "",
  offer_price: "",
  discount_percentage: "",
  start_date: "",
  end_date: "",
  service_ids: [],
  is_active: true,
};
const FALLBACK_SERVICE_CATEGORIES = [
  { value: "شعر", label: "حلاقة وتصفيف شعر" },
  { value: "ذقن", label: "تهذيب وحلاقة ذقن" },
  { value: "بشرة", label: "ماسك وعناية بشرة" },
  { value: "عناية", label: "باقات عناية متكاملة" },
];

function isItemActive(item) {
  return item?.isActive ?? item?.is_active ?? false;
}

const ServicesManagement = ({ hideHeader = false }) => {
  const [activeTab, setActiveTab] = useState("services");
  const [searchTerm, setSearchTerm] = useState("");

  // Services state
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({ ...DEFAULT_SERVICE_FORM });
  const [deleteTarget, setDeleteTarget] = useState(null); // {id, type}

  // Categories state
  const [categories, setCategories] = useState([]);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({ ...DEFAULT_CATEGORY_FORM });

  // Offers state
  const [offers, setOffers] = useState([]);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [offerForm, setOfferForm] = useState({ ...DEFAULT_OFFER_FORM });

  // Inventory state for ingredients
  const [products, setProducts] = useState([]);

  const fetchServices = useCallback(async () => {
    try {
      const res = await api.get("/services", { params: { limit: 1000 } });
      return normalizeListResponse(res).items;
    } catch {
      toast.error("فشل في مزامنة قائمة الخدمات");
      return [];
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await serviceCategoryService.list();
      return res.items;
    } catch {
      return [];
    }
  }, []);

  const fetchOffers = useCallback(async () => {
    try {
      const res = await offerService.list();
      return res.items;
    } catch {
      return [];
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get("/products", { params: { limit: 1000 } });
      const data = normalizeListResponse(res);
      setProducts(data.items || []);
    } catch {
      console.error("Failed to fetch products for ingredients");
    }
  }, []);

  const refreshAllData = useCallback(
    async ({ showLoader = false } = {}) => {
      try {
        if (showLoader) setLoading(true);
        else setRefreshing(true);

        const [servicesData, categoriesData, offersData] = await Promise.all([
          fetchServices(),
          fetchCategories(),
          fetchOffers(),
        ]);

        setServices(Array.isArray(servicesData) ? servicesData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setOffers(Array.isArray(offersData) ? offersData : []);
        fetchProducts();
      } finally {
        setLoading(false);
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

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredServiceRows = useMemo(() => {
    if (!normalizedSearchTerm) return serviceRows;

    return serviceRows.filter((service) => {
      const haystack = [
        service?.name,
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

  const serviceSummary = useMemo(
    () => ({
      total: serviceRows.length,
      active: serviceRows.filter((service) => isItemActive(service)).length,
      categories: new Set(
        serviceRows.map((service) => service.category).filter(Boolean),
      ).size,
    }),
    [serviceRows],
  );

  const currentSearchPlaceholder =
    activeTab === "services"
      ? "ابحث عن خدمة أو تصنيف..."
      : activeTab === "categories"
        ? "ابحث عن تصنيف..."
        : "ابحث عن عرض أو خدمة مشمولة...";

  const activeResultCount =
    activeTab === "services"
      ? filteredServiceRows.length
      : activeTab === "categories"
        ? filteredCategoryRows.length
        : filteredOfferRows.length;

  const [confirmAction, setConfirmAction] = useState(null);

  // --- Common Action Handler ---
  const handleConfirmAction = async () => {
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
    } catch {
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
    } catch {
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
        ...formData,
        name: formData.name || formData.name_ar || formData.name_en,
        price: normalizedPrice,
        category_id: formData.category_id
          ? parseInt(formData.category_id)
          : null,
        ingredients: formData.ingredients.map(ing => ({
          product_id: ing.product_id,
          amount_used: Number(ing.amount_used)
        }))
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
    } catch {
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
      imageUrl: service.image_url || service.imageUrl || "",
      isActive: isItemActive(service),
      ingredients: service.ingredients || [],
    });
    setIsModalOpen(true);
  };

  const addIngredient = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { product_id: "", amount_used: 1 }]
    }));
  };

  const removeIngredient = (index) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const updateIngredient = (index, field, value) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setFormData(prev => ({ ...prev, ingredients: newIngredients }));
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
    } catch {
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
      if (!offerForm.name.trim() || !offerForm.offer_price) {
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
        ...offerForm,
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
    } catch {
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
      description: offer.description || "",
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

  const toggleOfferService = (sid) => {
    setOfferForm((prev) => ({
      ...prev,
      service_ids: prev.service_ids.includes(sid)
        ? prev.service_ids.filter((id) => id !== sid)
        : [...prev.service_ids, sid],
    }));
  };

  if (loading)
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-accent">
          <Zap className="w-10 h-10 animate-pulse" />
          <p className="text-muted font-bold text-sm">
            جاري مزامنة لائحة الخدمات...
          </p>
        </div>
      </div>
    );

  return (
    <div className={`space-y-8 ${!hideHeader ? "pb-24" : ""}`} dir="rtl">
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

      {/* Header */}
      {!hideHeader && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-soft">
              <Zap className="text-inverse w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-main tracking-tight">
                إدارة الخدمات
              </h1>
              <p className="text-sm text-muted">
                إدارة وتسعير باقات العناية الشخصية المتاحة في المتجر
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            disabled={loading}
            onClick={openCreateDialog}
            className="rounded-xl font-black px-10 h-14 shadow-soft transition-all"
          >
            {activeTab === "services"
              ? "إضافة خدمة"
              : activeTab === "categories"
                ? "إضافة تصنيف"
                : "إضافة عرض"}{" "}
            <Plus className="mr-2" size={20} />
          </Button>
        </div>
      )}

      {/* Action Buttons for Panel Mode */}
      {hideHeader && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            disabled={loading}
            onClick={openCreateDialog}
            className="rounded-xl font-black px-6 h-12 shadow-soft transition-all"
          >
            <Plus className="mr-2" size={18} />{" "}
            {activeTab === "services"
              ? "إضافة خدمة"
              : activeTab === "categories"
                ? "إضافة تصنيف"
                : "إضافة عرض"}
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 bg-soft p-1.5 rounded-xl border border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              type="button"
              key={tab.key}
              disabled={loading}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex-1 ${activeTab === tab.key ? "bg-primary text-inverse shadow-soft" : "text-muted hover:bg-card hover:text-accent"}`}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-[22px] border border-border bg-card p-4 shadow-soft md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search
            size={18}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={searchTerm || ""}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={currentSearchPlaceholder}
            className="h-12 rounded-xl border-border bg-soft pr-11 font-bold text-main"
          />
        </div>

        <div className="flex items-center justify-between gap-3 md:justify-end">
          <Badge className="rounded-xl bg-soft px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted">
            النتائج: {activeResultCount}
          </Badge>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => refreshAllData()}
            loading={refreshing}
            className="h-12 rounded-xl px-5 font-black"
          >
            <RefreshCw size={16} className="ml-2" />
            تحديث
          </Button>
        </div>
      </div>

      {/* ====== TAB: SERVICES ====== */}
      {activeTab === "services" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="rounded-[26px] border border-border bg-card shadow-soft p-8 flex items-center gap-6">
              <div className="w-16 h-16 rounded-xl bg-accent-soft/30 flex items-center justify-center text-accent shadow-soft">
                <Scissors className="w-7 h-7" />
              </div>
              <div>
                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">
                  إجمالي الخدمات
                </p>
                <h3 className="text-3xl font-black text-main tracking-tighter">
                  {serviceSummary.total}
                </h3>
              </div>
            </Card>
            <Card className="rounded-[26px] border border-border bg-card shadow-soft p-8 flex items-center gap-6">
              <div className="w-16 h-16 rounded-xl bg-success-soft/30 flex items-center justify-center text-success shadow-soft">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">
                  خدمات نشطة
                </p>
                <h3 className="text-3xl font-black text-main tracking-tighter">
                  {serviceSummary.active}
                </h3>
              </div>
            </Card>
            <Card className="rounded-[26px] border border-border bg-card shadow-soft p-8 flex items-center gap-6">
              <div className="w-16 h-16 rounded-xl bg-info-soft/30 flex items-center justify-center text-info shadow-soft">
                <Layers size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">
                  الفئات الفنية
                </p>
                <h3 className="text-3xl font-black text-main tracking-tighter">
                  {serviceSummary.categories}
                </h3>
              </div>
            </Card>
          </div>

          <Card className="rounded-[26px] overflow-hidden border border-border bg-card shadow-soft">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-black text-main uppercase tracking-tight">
                لائحة الخدمات والأسعار
              </h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-soft/50">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="font-bold text-muted h-14 px-8 text-right">
                      اسم الخدمة
                    </TableHead>
                    <TableHead className="font-bold text-muted text-right">
                      التصنيف
                    </TableHead>
                    <TableHead className="font-bold text-muted text-right">
                      السعر
                    </TableHead>
                    <TableHead className="font-bold text-muted text-center">
                      الحالة
                    </TableHead>
                    <TableHead className="font-bold text-muted text-left px-8">
                      إجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServiceRows.map((service) => (
                    <TableRow
                      key={service.id}
                      className="group border-border/50"
                    >
                      <TableCell className="font-bold text-main px-8 py-4 uppercase tracking-tight text-right">
                        {service.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-soft text-accent border-none rounded-lg px-3 py-1 font-bold text-[10px] uppercase tracking-widest">
                          {service.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-lg font-black text-accent">
                          {service.price}{" "}
                          <span className="text-[10px] text-muted font-bold ml-1 uppercase">
                            ج.م
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {isItemActive(service) ? (
                          <Badge className="bg-success-soft text-success border-none px-4 rounded-full font-black text-[10px]">
                            متاحة
                          </Badge>
                        ) : (
                          <Badge className="bg-danger-soft text-danger border-none px-4 rounded-full font-black text-[10px]">
                            متوقفة
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-left px-8">
                        <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={loading}
                            onClick={() => startEdit(service)}
                            className="text-muted hover:text-accent hover:bg-accent-soft/50 rounded-xl w-10 h-10"
                            title="تعديل"
                          >
                            <Pencil size={18} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDeleteTarget({
                                id: service.id,
                                type: "service",
                              })
                            }
                            className="text-muted hover:text-danger hover:bg-danger-soft/50 rounded-xl w-10 h-10"
                            title="حذف"
                          >
                            <Trash2 size={18} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredServiceRows.length === 0 && (
              <div className="py-20 text-center border-t border-border">
                <Scissors size={48} className="mx-auto mb-4 text-muted/20" />
                <h4 className="text-sm font-black text-muted uppercase tracking-[0.2em]">
                  {searchTerm ? "لا توجد نتائج مطابقة" : "لا توجد خدمات حالية"}
                </h4>
              </div>
            )}
          </Card>

          {/* Service Dialog */}
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="rounded-[26px] p-8 bg-card border border-border shadow-premium max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="mb-6 text-right">
                <DialogTitle className="text-2xl font-black text-main uppercase tracking-tight">
                  {editingService ? "تعديل الخدمة" : "إضافة خدمة جديدة"}
                </DialogTitle>
                <DialogDescription className="text-muted font-medium mt-1">
                  أدخل تفاصيل الخدمة والسعر والتصنيف والمنتجات المستهلكة
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                      اسم الخدمة (AR)
                    </label>
                    <Input
                      className="h-12 rounded-xl pr-4 font-bold bg-soft border-border text-main focus:border-accent"
                      value={formData.name_ar || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, name_ar: e.target.value })
                      }
                      placeholder="مثال: حلاقة شعر VIP..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                      Service Name (EN)
                    </label>
                    <Input
                      className="h-12 rounded-xl pr-4 font-bold bg-soft border-border text-main focus:border-accent"
                      value={formData.name_en || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, name_en: e.target.value })
                      }
                      placeholder="e.g. VIP Haircut..."
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                    رابط صورة الخدمة
                  </label>
                  <div className="flex gap-2">
                    <Input
                      className="h-12 rounded-xl pr-4 font-bold bg-soft border-border text-main focus:border-accent"
                      value={formData.imageUrl || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, imageUrl: e.target.value })
                      }
                      placeholder="https://..."
                    />
                    <Button
                      variant="outline"
                      className="h-12 w-12 rounded-xl border-border hover:border-accent group"
                    >
                      <ImageIcon
                        size={18}
                        className="text-muted group-hover:text-accent"
                      />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                      السعر (ج.م)
                    </label>
                    <Input
                      type="number"
                      className="h-12 rounded-xl font-black bg-soft border-border text-main focus:border-accent"
                      value={formData.price || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                      التصنيف
                    </label>
                    {categoryRows.length > 0 ? (
                      <Select
                        value={formData.category_id || ""}
                        onValueChange={(val) => {
                          setFormData({
                            ...formData,
                            category_id: val,
                            category:
                              categoryRows.find((c) => c.id.toString() === val)
                                ?.name || formData.category,
                          });
                        }}
                      >
                        <SelectTrigger className="h-12 rounded-xl bg-soft border-border font-bold px-4 text-main focus:border-accent">
                          <SelectValue placeholder="اختر التصنيف..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-card shadow-premium">
                          {categoryRows.map((c) => (
                            <SelectItem
                              key={c.id}
                              value={c.id.toString() || ""}
                            >
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        value={formData.category || ""}
                        onValueChange={(val) =>
                          setFormData({ ...formData, category: val })
                        }
                      >
                        <SelectTrigger className="h-12 rounded-xl bg-soft border-border font-bold px-4 text-main focus:border-accent">
                          <SelectValue placeholder="اختر التصنيف..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-card shadow-premium">
                          {FALLBACK_SERVICE_CATEGORIES.map((category) => (
                            <SelectItem
                              key={category.value}
                              value={category.value || ""}
                            >
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Ingredients Section */}
                <div className="space-y-4 border-t border-border pt-6">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest">
                      المنتجات المستهلكة (التكاليف التشغيلية)
                    </label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={addIngredient}
                      className="h-8 rounded-lg text-[10px] font-black"
                    >
                      <Plus size={14} className="ml-1" /> إضافة منتج
                    </Button>
                  </div>
                  
                  {formData.ingredients.length > 0 ? (
                    <div className="space-y-3">
                      {formData.ingredients.map((ing, idx) => (
                        <div key={idx} className="flex gap-3 items-end bg-soft p-3 rounded-xl border border-border">
                          <div className="flex-1 space-y-1">
                            <label className="text-[9px] font-bold text-muted pr-1">المنتج</label>
                            <Select
                              value={ing.product_id?.toString()}
                              onValueChange={(val) => updateIngredient(idx, "product_id", parseInt(val))}
                            >
                              <SelectTrigger className="h-10 rounded-lg bg-card border-border text-xs">
                                <SelectValue placeholder="اختر المنتج..." />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map(p => (
                                  <SelectItem key={p.id} value={p.id.toString()}>
                                    {p.name} ({p.quantity} {p.unit})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-24 space-y-1">
                            <label className="text-[9px] font-bold text-muted pr-1">الكمية</label>
                            <Input
                              type="number"
                              className="h-10 rounded-lg bg-card border-border text-xs font-bold"
                              value={ing.amount_used}
                              onChange={(e) => updateIngredient(idx, "amount_used", e.target.value)}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeIngredient(idx)}
                            className="h-10 w-10 text-danger hover:bg-danger-soft/50 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 bg-soft/50 rounded-xl border border-dashed border-border">
                      <Package size={24} className="text-muted/30 mb-2" />
                      <p className="text-[10px] font-bold text-muted/60">لم يتم تحديد منتجات مستهلكة لهذه الخدمة</p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, isActive: !formData.isActive })
                  }
                  className={`w-full flex items-center justify-between p-6 rounded-xl border transition-all ${formData.isActive ? "bg-accent-soft/20 border-accent/20 text-accent" : "bg-soft border-border text-muted"}`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-xl transition-colors ${formData.isActive ? "bg-accent text-inverse shadow-soft" : "bg-muted/10"}`}
                    >
                      {formData.isActive ? (
                        <CheckCircle size={18} />
                      ) : (
                        <XCircle size={18} />
                      )}
                    </div>
                    <span className="text-sm font-black uppercase tracking-tight">
                      {formData.isActive ? "متاحة" : "معطلة"}
                    </span>
                  </div>
                  <ChevronRight size={16} className="opacity-20" />
                </button>
              </div>
              <DialogFooter className="mt-8 flex items-center justify-between">
                <Button
                  variant="secondary"
                  disabled={loading}
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-10 font-black h-12"
                >
                  إلغاء
                </Button>
                <Button
                  disabled={loading}
                  onClick={handleSubmit}
                  loading={isActionLoading}
                  variant="primary"
                  className="rounded-xl px-14 font-black h-14 shadow-soft transition-all"
                >
                  حفظ التغييرات
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ====== TAB: CATEGORIES ====== */}
      {activeTab === "categories" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCategoryRows.map((cat) => (
              <Card
                key={cat.id}
                className="rounded-[26px] border border-border bg-card shadow-soft p-6 flex flex-col justify-between group hover:border-accent/30 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-accent-soft/30 flex items-center justify-center text-accent">
                      {cat.icon ? (
                        <span className="text-xl">{cat.icon}</span>
                      ) : (
                        <Layers size={22} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-main uppercase tracking-tight">
                        {cat.name}
                      </h3>
                      {cat.name_ar && (
                        <p className="text-xs text-muted mt-0.5">
                          {cat.name_ar}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    className={
                      cat.is_active
                        ? "bg-success-soft text-success border-none text-[9px] font-black"
                        : "bg-danger-soft text-danger border-none text-[9px] font-black"
                    }
                  >
                    {cat.is_active ? "نشط" : "معطل"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-muted uppercase tracking-widest pt-4 border-t border-border">
                  <span>ترتيب: {cat.sort_order}</span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setConfirmAction({
                          type: "toggle-category",
                          id: cat.id,
                        })
                      }
                      className="w-8 h-8 rounded-lg text-muted hover:text-accent hover:bg-accent-soft/50"
                      title={cat.is_active ? "تعطيل التصنيف" : "تفعيل التصنيف"}
                      aria-label={
                        cat.is_active ? "تعطيل التصنيف" : "تفعيل التصنيف"
                      }
                    >
                      {cat.is_active ? (
                        <ToggleRight size={16} />
                      ) : (
                        <ToggleLeft size={16} />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={loading}
                      onClick={() => startCatEdit(cat)}
                      className="w-8 h-8 rounded-lg text-muted hover:text-accent hover:bg-accent-soft/50"
                      title="تعديل بيانات التصنيف"
                      aria-label="تعديل بيانات التصنيف"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDeleteTarget({ id: cat.id, type: "category" })
                      }
                      className="w-8 h-8 rounded-lg text-muted hover:text-danger hover:bg-danger-soft/50"
                      title="حذف التصنيف"
                      aria-label="حذف التصنيف"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {filteredCategoryRows.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <Layers size={48} className="mx-auto mb-4 text-muted/20" />
                <h4 className="text-sm font-black text-muted uppercase tracking-[0.2em]">
                  {searchTerm ? "لا توجد نتائج مطابقة" : "لا توجد تصنيفات"}
                </h4>
                <p className="text-[10px] font-bold text-muted/60 mt-1">
                  {searchTerm
                    ? "جرّب تعديل كلمات البحث"
                    : "ابدأ بإضافة أول تصنيف"}
                </p>
              </div>
            )}
          </div>

          {/* Category Dialog */}
          <Dialog open={isCatModalOpen} onOpenChange={setIsCatModalOpen}>
            <DialogContent className="rounded-[26px] p-8 bg-card border border-border shadow-premium max-lg:max-w-lg">
              <DialogHeader className="mb-6 text-right">
                <DialogTitle className="text-xl font-black text-main uppercase tracking-tight">
                  {editingCat ? "تعديل التصنيف" : "إضافة تصنيف جديد"}
                </DialogTitle>
                <DialogDescription className="text-muted font-medium mt-1">
                  أدخل تفاصيل التصنيف والأيقونة وترتيب العرض
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                    اسم التصنيف
                  </label>
                  <Input
                    className="h-12 rounded-xl pr-4 font-bold bg-soft border-border text-main focus:border-accent"
                    value={catForm.name || ""}
                    onChange={(e) =>
                      setCatForm({ ...catForm, name: e.target.value })
                    }
                    placeholder="مثال: حلاقة شعر"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                    الاسم بالعربي
                  </label>
                  <Input
                    className="h-12 rounded-xl pr-4 font-bold bg-soft border-border text-main focus:border-accent"
                    value={catForm.name_ar || ""}
                    onChange={(e) =>
                      setCatForm({ ...catForm, name_ar: e.target.value })
                    }
                    placeholder="حلاقة شعر"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                      أيقونة (emoji)
                    </label>
                    <Input
                      className="h-12 rounded-xl pr-4 font-bold bg-soft border-border text-main focus:border-accent"
                      value={catForm.icon || ""}
                      onChange={(e) =>
                        setCatForm({ ...catForm, icon: e.target.value })
                      }
                      placeholder="✂️"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                      ترتيب العرض
                    </label>
                    <Input
                      type="number"
                      className="h-12 rounded-xl font-bold bg-soft border-border text-main focus:border-accent"
                      value={catForm.sort_order || ""}
                      onChange={(e) =>
                        setCatForm({
                          ...catForm,
                          sort_order: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCatForm({ ...catForm, is_active: !catForm.is_active })
                  }
                  className={`w-full flex items-center justify-between p-5 rounded-xl border transition-all ${catForm.is_active ? "bg-accent-soft/20 border-accent/20 text-accent" : "bg-soft border-border text-muted"}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-lg transition-colors ${catForm.is_active ? "bg-accent text-inverse" : "bg-muted/10"}`}
                    >
                      {catForm.is_active ? (
                        <CheckCircle size={16} />
                      ) : (
                        <XCircle size={16} />
                      )}
                    </div>
                    <span className="text-sm font-black uppercase tracking-tight">
                      {catForm.is_active ? "نشط" : "معطل"}
                    </span>
                  </div>
                  <ChevronRight size={16} className="opacity-20" />
                </button>
              </div>
              <DialogFooter className="mt-8 flex items-center justify-between">
                <Button
                  variant="secondary"
                  disabled={loading}
                  onClick={() => setIsCatModalOpen(false)}
                  className="rounded-xl px-10 font-black h-12"
                >
                  إلغاء
                </Button>
                <Button
                  disabled={loading}
                  onClick={handleCatSubmit}
                  loading={isActionLoading}
                  variant="primary"
                  className="rounded-xl px-14 font-black h-12 shadow-soft transition-all"
                >
                  حفظ
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ====== TAB: OFFERS ====== */}
      {activeTab === "offers" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOfferRows.map((offer) => {
              const originalTotal = (offer.services || []).reduce(
                (s, sv) => s + Number(sv.price || 0),
                0,
              );
              const isActive =
                offer.is_active &&
                (!offer.start_date ||
                  new Date(offer.start_date) <= new Date()) &&
                (!offer.end_date || new Date(offer.end_date) >= new Date());
              return (
                <Card
                  key={offer.id}
                  className="rounded-[26px] border border-border bg-card shadow-soft p-5 flex flex-col justify-between group hover:border-accent/30 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg bg-accent-soft/30 flex items-center justify-center text-accent">
                          <Gift size={18} />
                        </div>
                        <h3 className="text-sm font-black text-main uppercase tracking-tight line-clamp-1">
                          {offer.name}
                        </h3>
                      </div>
                      {offer.discount_percentage > 0 && (
                        <Badge className="bg-warning-soft text-warning border-none text-[9px] font-black">
                          <Percent size={10} className="ml-1" />{" "}
                          {offer.discount_percentage}%
                        </Badge>
                      )}
                    </div>
                    {offer.description && (
                      <p className="text-[10px] text-muted mb-3 line-clamp-2">
                        {offer.description}
                      </p>
                    )}
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-xl font-black text-accent tracking-tighter">
                        {Number(offer.offer_price).toLocaleString()}
                      </span>
                      <span className="text-[9px] text-muted font-bold uppercase">
                        ج.م
                      </span>
                      {originalTotal > Number(offer.offer_price) && (
                        <span className="text-xs text-muted line-through">
                          {originalTotal.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {(offer.services || []).slice(0, 3).map((s) => (
                        <Badge
                          key={s.id}
                          className="bg-soft text-muted border-none text-[8px] font-bold"
                        >
                          {s.name}
                        </Badge>
                      ))}
                      {(offer.services || []).length > 3 && (
                        <Badge className="bg-soft text-muted border-none text-[8px] font-bold">
                          +{offer.services.length - 3}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-muted">
                      {offer.is_public ? (
                        <Eye size={12} className="text-accent" />
                      ) : (
                        <EyeOff size={12} />
                      )}
                      <span>{offer.is_public ? "عام" : "داخلي"}</span>
                      {offer.start_date && (
                        <>
                          <span className="mx-1">•</span>
                          <CalendarDays size={10} />
                          <span>{offer.start_date}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                    <Badge
                      className={
                        isActive
                          ? "bg-success-soft text-success border-none text-[9px] font-black"
                          : "bg-danger-soft text-danger border-none text-[9px] font-black"
                      }
                    >
                      {isActive ? "نشط" : "معطل"}
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setConfirmAction({
                            type: "toggle-offer",
                            id: offer.id,
                          })
                        }
                        className="w-8 h-8 rounded-lg text-muted hover:text-accent hover:bg-accent-soft/50"
                        title={offer.is_active ? "تعطيل العرض" : "تفعيل العرض"}
                        aria-label={
                          offer.is_active ? "تعطيل العرض" : "تفعيل العرض"
                        }
                      >
                        {offer.is_active ? (
                          <ToggleRight size={16} />
                        ) : (
                          <ToggleLeft size={16} />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={loading}
                        onClick={() => startOfferEdit(offer)}
                        className="w-8 h-8 rounded-lg text-muted hover:text-accent hover:bg-accent-soft/50"
                        title="تعديل بيانات العرض"
                        aria-label="تعديل بيانات العرض"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setDeleteTarget({ id: offer.id, type: "offer" })
                        }
                        className="w-8 h-8 rounded-lg text-muted hover:text-danger hover:bg-danger-soft/50"
                        title="حذف العرض"
                        aria-label="حذف العرض"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
            {filteredOfferRows.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <Gift size={48} className="mx-auto mb-4 text-muted/20" />
                <h4 className="text-sm font-black text-muted uppercase tracking-[0.2em]">
                  {searchTerm ? "لا توجد نتائج مطابقة" : "لا توجد عروض"}
                </h4>
                <p className="text-[10px] font-bold text-muted/60 mt-1">
                  {searchTerm
                    ? "جرّب تعديل كلمات البحث"
                    : "ابدأ بإضافة أول عرض ترويجي"}
                </p>
              </div>
            )}
          </div>

          {/* Offer Dialog */}
          <Dialog open={isOfferModalOpen} onOpenChange={setIsOfferModalOpen}>
            <DialogContent className="rounded-[26px] p-8 bg-card border border-border shadow-premium max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="mb-6 text-right">
                <DialogTitle className="text-xl font-black text-main uppercase tracking-tight">
                  {editingOffer ? "تعديل العرض" : "إضافة عرض جديد"}
                </DialogTitle>
                <DialogDescription className="text-muted font-medium mt-1">
                  أدخل تفاصيل العرض والأسعار والخدمات المشمولة
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                    اسم العرض
                  </label>
                  <Input
                    className="h-12 rounded-xl pr-4 font-bold bg-soft border-border text-main focus:border-accent"
                    value={offerForm.name || ""}
                    onChange={(e) =>
                      setOfferForm({ ...offerForm, name: e.target.value })
                    }
                    placeholder="مثال: باقة الصيف"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                      اسم العرض (AR)
                    </label>
                    <Input
                      className="h-12 rounded-xl pr-4 font-bold bg-soft border-border text-main focus:border-accent"
                      value={offerForm.name_ar || ""}
                      onChange={(e) =>
                        setOfferForm({ ...offerForm, name_ar: e.target.value })
                      }
                      placeholder="مثال: باقة العيد الملكية"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                      Offer Name (EN)
                    </label>
                    <Input
                      className="h-12 rounded-xl pr-4 font-bold bg-soft border-border text-main focus:border-accent"
                      value={offerForm.name_en || ""}
                      onChange={(e) =>
                        setOfferForm({ ...offerForm, name_en: e.target.value })
                      }
                      placeholder="e.g. Royal Eid Package"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                    رابط صورة العرض
                  </label>
                  <div className="flex gap-2">
                    <Input
                      className="h-12 rounded-xl pr-4 font-bold bg-soft border-border text-main focus:border-accent"
                      value={offerForm.imageUrl || ""}
                      onChange={(e) =>
                        setOfferForm({ ...offerForm, imageUrl: e.target.value })
                      }
                      placeholder="https://..."
                    />
                    <Button
                      variant="outline"
                      className="h-12 w-12 rounded-xl border-border hover:border-accent group"
                    >
                      <Gift
                        size={18}
                        className="text-muted group-hover:text-accent"
                      />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                    الوصف (بالعربية)
                  </label>
                  <textarea
                    className="w-full h-24 rounded-xl pr-4 py-4 font-bold bg-soft border-border text-main focus:border-accent outline-none"
                    value={offerForm.description_ar || ""}
                    onChange={(e) =>
                      setOfferForm({
                        ...offerForm,
                        description_ar: e.target.value,
                      })
                    }
                    placeholder="وصف العرض للعملاء في الموقع..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                      السعر الأصلي
                    </label>
                    <Input
                      type="number"
                      className="h-12 rounded-xl font-bold bg-soft border-border text-main focus:border-accent"
                      value={offerForm.original_price || ""}
                      onChange={(e) =>
                        setOfferForm({
                          ...offerForm,
                          original_price: e.target.value,
                        })
                      }
                      placeholder="اختياري"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                      سعر العرض *
                    </label>
                    <Input
                      type="number"
                      className="h-12 rounded-xl font-black bg-soft border-border text-accent focus:border-accent"
                      value={offerForm.offer_price || ""}
                      onChange={(e) =>
                        setOfferForm({
                          ...offerForm,
                          offer_price: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                      نسبة الخصم %
                    </label>
                    <Input
                      type="number"
                      className="h-12 rounded-xl font-bold bg-soft border-border text-main focus:border-accent"
                      value={offerForm.discount_percentage || ""}
                      onChange={(e) =>
                        setOfferForm({
                          ...offerForm,
                          discount_percentage: e.target.value,
                        })
                      }
                      placeholder="اختياري"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                      تاريخ البداية
                    </label>
                    <Input
                      type="date"
                      className="h-12 rounded-xl font-bold bg-soft border-border text-main focus:border-accent"
                      value={offerForm.start_date || ""}
                      onChange={(e) =>
                        setOfferForm({
                          ...offerForm,
                          start_date: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                      تاريخ النهاية
                    </label>
                    <Input
                      type="date"
                      className="h-12 rounded-xl font-bold bg-soft border-border text-main focus:border-accent"
                      value={offerForm.end_date || ""}
                      onChange={(e) =>
                        setOfferForm({ ...offerForm, end_date: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-muted uppercase tracking-widest mr-1">
                    الخدمات المشمولة
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-3 bg-soft rounded-xl border border-border">
                    {serviceRows
                      .filter((s) => isItemActive(s))
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          disabled={loading}
                          onClick={() => toggleOfferService(s.id)}
                          className={`p-3 rounded-lg border text-right text-xs font-bold transition-all ${offerForm.service_ids.includes(s.id) ? "border-accent bg-accent-soft/30 text-accent" : "border-border bg-card text-muted hover:border-accent/30"}`}
                        >
                          {s.name}
                          <span className="block text-[9px] mt-0.5">
                            {Number(s.price).toLocaleString()} ج.م
                          </span>
                        </button>
                      ))}
                  </div>
                  {offerForm.service_ids.length > 0 && (
                    <p className="text-[10px] font-bold text-accent">
                      تم اختيار {offerForm.service_ids.length} خدمة
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setOfferForm({
                        ...offerForm,
                        is_public: !offerForm.is_public,
                      })
                    }
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${offerForm.is_public ? "bg-accent-soft/20 border-accent/20 text-accent" : "bg-soft border-border text-muted"}`}
                  >
                    {offerForm.is_public ? (
                      <Eye size={16} />
                    ) : (
                      <EyeOff size={16} />
                    )}
                    <span className="text-xs font-black uppercase">
                      {offerForm.is_public ? "عام" : "داخلي"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOfferForm({
                        ...offerForm,
                        is_active: !offerForm.is_active,
                      })
                    }
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${offerForm.is_active ? "bg-success-soft/20 border-success/20 text-success" : "bg-soft border-border text-muted"}`}
                  >
                    {offerForm.is_active ? (
                      <CheckCircle size={16} />
                    ) : (
                      <XCircle size={16} />
                    )}
                    <span className="text-xs font-black uppercase">
                      {offerForm.is_active ? "نشط" : "معطل"}
                    </span>
                  </button>
                </div>
              </div>
              <DialogFooter className="mt-8 flex items-center justify-between">
                <Button
                  variant="secondary"
                  disabled={loading}
                  onClick={() => setIsOfferModalOpen(false)}
                  className="rounded-xl px-10 font-black h-12"
                >
                  إلغاء
                </Button>
                <Button
                  disabled={loading}
                  onClick={handleOfferSubmit}
                  loading={isActionLoading}
                  variant="primary"
                  className="rounded-xl px-14 font-black h-14 shadow-soft transition-all"
                >
                  حفظ العرض
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default ServicesManagement;
