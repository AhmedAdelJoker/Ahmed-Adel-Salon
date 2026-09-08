/**
 * Services catalog domain types (moved from pages/owner/ServicesManagement.tsx).
 */
export interface ProductRecord {
  id?: number | string;
  name?: string;
  name_ar?: string;
  name_en?: string;
  quantity?: number | string;
  unit_cost?: number | string;
  unitCost?: number | string;
  cost_per_gram?: number | string;
  costPerGram?: number | string;
  [key: string]: unknown;
}

export interface ServiceIngredient {
  product_id?: number | string;
  productId?: number | string;
  amount_used?: number | string;
  amountUsed?: number | string;
  [key: string]: unknown;
}

export interface ServiceRecord {
  id?: number | string;
  name?: string;
  name_ar?: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
  duration_minutes?: number;
  price?: number | string;
  category?: string;
  category_id?: string;
  image_url?: string;
  isActive?: boolean;
  ingredients?: unknown[];
  [key: string]: unknown;
}

export interface CategoryRecord {
  id?: number | string;
  name?: string;
  name_ar?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface OfferRecord {
  id?: number | string;
  name?: string;
  name_ar?: string;
  name_en?: string;
  description?: string;
  description_ar?: string;
  description_en?: string;
  image_url?: string;
  original_price?: number | string;
  offer_price?: number | string;
  discount_percentage?: number | string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  services?: { id: number | string; name?: string }[];
  [key: string]: unknown;
}

export interface ServiceFormData {
  name: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  duration_minutes: number;
  price: string;
  category: string;
  category_id: string;
  image_url: string;
  isActive: boolean;
  ingredients: unknown[];
}

export interface CategoryFormData {
  name: string;
  name_ar: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export interface OfferFormData {
  name: string;
  name_ar: string;
  name_en: string;
  description: string;
  description_ar: string;
  description_en: string;
  image_url: string;
  original_price: string;
  offer_price: string;
  discount_percentage: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  service_ids: (number | string)[];
  is_public?: boolean;
}

export interface ConfirmAction {
  type: "delete" | "toggle-category" | "toggle-offer";
  id: number | string;
  targetType?: string;
}
