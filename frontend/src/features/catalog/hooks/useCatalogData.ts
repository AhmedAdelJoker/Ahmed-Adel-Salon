/**
 * Catalog feature: lists data (moved from ServicesManagement page, no logic changes).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { normalizeListResponse } from "@/services/apiAdapter";
import serviceCategoryService from "@/features/catalog/services/serviceCategoryService";
import offerService from "@/features/catalog/services/offerService";
import type {
  CategoryRecord,
  OfferRecord,
  ProductRecord,
  ServiceRecord,
} from "@/types/catalog";
import { isItemActive } from "@/features/catalog/constants";
import {
  getIngredientCost,
  getIngredientProduct,
  getProductGramCost,
  getServiceLowStockCount,
  getServiceMargin,
  getServiceOperationalCost,
  getServiceProfit,
} from "@/features/catalog/utils/pricing";

export function useCatalogData(searchTerm: string) {
  // Services state
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Categories state
  const [categories, setCategories] = useState<CategoryRecord[]>([]);

  // Offers state
  const [offers, setOffers] = useState<OfferRecord[]>([]);

  // Inventory state for ingredients
  const [products, setProducts] = useState<ProductRecord[]>([]);

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

  const pricing = useMemo(
    () => ({
      getIngredientProduct: (ingredient) =>
        getIngredientProduct(productIndex, ingredient),
      getProductGramCost,
      getIngredientCost: (ingredient) =>
        getIngredientCost(productIndex, ingredient),
      getServiceOperationalCost: (service) =>
        getServiceOperationalCost(productIndex, service),
      getServiceProfit: (service) =>
        getServiceProfit(productIndex, service),
      getServiceMargin: (service) =>
        getServiceMargin(productIndex, service),
      getServiceLowStockCount: (service) =>
        getServiceLowStockCount(productIndex, service),
    }),
    [productIndex],
  );

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
              (sum, service) => sum + pricing.getServiceMargin(service),
              0,
            ) / serviceRows.length
          : 0,
      lowStock: serviceRows.filter(
        (service) => pricing.getServiceLowStockCount(service) > 0,
      ).length,
    }),
    [pricing, serviceRows],
  );

  return {
    services,
    categories,
    offers,
    products,
    servicesLoading,
    categoriesLoading,
    offersLoading,
    refreshing,
    refreshAllData,
    serviceRows,
    categoryRows,
    offerRows,
    filteredServiceRows,
    filteredCategoryRows,
    filteredOfferRows,
    serviceSummary,
    pricing,
  };
}
