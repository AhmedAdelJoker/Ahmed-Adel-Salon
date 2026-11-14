/** Catalog feature: shared constants (moved from ServicesManagement page). */
import { Scissors, Layers } from "lucide-react";

export const TABS = [
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
  /*
    The "offers" tab is gone. Offers are one row in one table, and they used to
    be edited from here (services + a date window) and from /inventory/bundles
    (products + image + publish), so each page silently dropped the other's
    fields. /inventory/bundles is now the whole offer; `?tab=offers` here
    redirects to it.
  */
];

export const DEFAULT_SERVICE_FORM = {
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

export const DEFAULT_CATEGORY_FORM = {
  name: "",
  name_ar: "",
  icon: "",
  sort_order: 0,
  is_active: true,
};

export const DEFAULT_OFFER_FORM = {
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

export const _FALLBACK_SERVICE_CATEGORIES = [
  { value: "شعر", label: "حلاقة وتصفيف شعر" },
  { value: "ذقن", label: "تهذيب وحلاقة ذقن" },
  { value: "بشرة", label: "ماسك وعناية بشرة" },
  { value: "عناية", label: "باقات عناية متكاملة" },
];

export function isItemActive(item) {
  return item?.isActive ?? item?.is_active ?? false;
}
