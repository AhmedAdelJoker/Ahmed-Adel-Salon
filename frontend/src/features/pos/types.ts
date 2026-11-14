import type { Dispatch, SetStateAction } from "react";
import type { ID } from "@/types/common";
import type { DiscountAllowance } from "@/features/pos/utils";

export type POSRecord = Record<string, any>;

/** The four instruments the invoice endpoint accepts inside a split. */
export type SplitMethod = "cash" | "card" | "wallet" | "bank_transfer";

/**
 * What the till is currently selling.
 *
 * - `idle`     nothing started: the session queue is the main surface.
 * - `products` retail care products and product-only offers; no services and
 *              no barber assignment.
 * - `session`  a reception session loaded into the cart.
 *
 * Walk-in service sales deliberately have no mode: services are sold through
 * a reception session, so every manual sale is a product sale.
 */
export type SaleMode = "idle" | "products" | "session";

/** One row of a split payment. Amount stays a string while the cashier
 * types, so the input never fights the cursor with reformatted numbers. */
export interface SplitLine {
  method: SplitMethod;
  amount: string;
}

export interface CartItem extends POSRecord {
  id: ID;
  uid: string;
  name: string;
  price: number;
  quantity: number;
  type: string;
  barberId: ID | null;
  barberName: string;
  /** A product-only offer: stock-tracked and never attributed to an expert. */
  isProductOffer?: boolean;
  // Display-only (server is source of truth for money):
  stock?: number;
  durationMinutes?: number;
  sku?: string;
  originalPrice?: number;
  includedItems?: string[];
  categoryName?: string;
}

/**
 * Whether the customer block is ready for checkout, and why not when it is
 * not. `isRegistered` means a real customer record is attached (a loaded
 * session or a phone that matched an existing customer), so the record is the
 * authority and the typed name only has to be non-empty.
 */
export interface CustomerValidation {
  valid: boolean;
  message: string | null;
  isRegistered: boolean;
  nameParts: number;
}

export interface POSContextValue {
  categories: POSRecord[];
  services: POSRecord[];
  products: POSRecord[];
  offers: POSRecord[];
  /** Active offers made only of products: sold like retail stock, no expert. */
  productOffers: POSRecord[];
  barbers: POSRecord[];
  readyAppointments: POSRecord[];
  businessSettings: POSRecord | null;
  currentShift: POSRecord | null;
  setCurrentShift: Dispatch<SetStateAction<POSRecord | null>>;
  isShopOpen: boolean;
  refreshBalance: () => Promise<void>;
  loading: boolean;
  readyAppointmentsLoading: boolean;
  shiftLoading: boolean;
  /** Set when the shift check itself failed, as opposed to no shift being open. */
  shiftError: string | null;
  /** Set when the ready-to-pay queue could not be fetched. */
  readyAppointmentsError: string | null;
  /** Set when the sellable catalogue could not be loaded. */
  catalogError: string | null;
  showApprovalModal: boolean;
  setShowApprovalModal: Dispatch<SetStateAction<boolean>>;
  isSubmitting: boolean;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  setLastInvoice: Dispatch<SetStateAction<POSRecord | null>>;
  lastInvoice: POSRecord | null;
  completedCustomerName: string;
  setCompletedCustomerName: Dispatch<SetStateAction<string>>;
  completedBarberName: string;
  setCompletedBarberName: Dispatch<SetStateAction<string>>;
  itemSearchQuery: string;
  setItemSearchQuery: Dispatch<SetStateAction<string>>;
  /** Which kind of sale the till is preparing. */
  saleMode: SaleMode;
  /** Reset the sale and start the product-only manual sale. */
  startSaleMode: (mode: "products") => void;
  /** Start a walk-in (no appointment) service sale. */
  startQuickSale: () => void;
  /** Reset cart/customer state and load a reception session. */
  loadSession: (
    appointment: POSRecord,
    options?: { notify?: boolean },
  ) => void;
  /** The customer's full name as typed at the till. */
  customerName: string;
  setCustomerName: Dispatch<SetStateAction<string>>;
  /** Optional mobile number used to resolve/attach an existing customer. */
  customerPhone: string;
  setCustomerPhone: Dispatch<SetStateAction<string>>;
  customerLookupLoading: boolean;
  customerLookupError: string | null;
  /** Existing customer resolved from the typed phone, if any. */
  customerMatch: POSRecord | null;
  /** Session sales carry the reception customer; their fields are read-only. */
  isCustomerLocked: boolean;
  /** Live validation of the customer block (name + optional phone). */
  customerValidation: CustomerValidation;
  /** Human-readable reason checkout cannot proceed, or null when it can. */
  validateCustomer: () => string | null;
  activeCategory: string;
  setActiveCategory: Dispatch<SetStateAction<string>>;
  categoryTabs: string[];
  filteredItems: POSRecord[];
  cart: CartItem[];
  setCart: Dispatch<SetStateAction<CartItem[]>>;
  selectedBarberId: string;
  setSelectedBarberId: Dispatch<SetStateAction<string>>;
  selectedCustomerId: string;
  setSelectedCustomerId: Dispatch<SetStateAction<string>>;
  /** An attached customer record (session buyer or phone match). */
  selectedCustomer: POSRecord | null;
  discount: number;
  setDiscount: Dispatch<SetStateAction<number>>;
  /** The discount a cashier may apply without a manager's approval. */
  discountAllowance: DiscountAllowance;
  loyaltyDiscount: number;
  paymentMethod: string;
  setPaymentMethod: Dispatch<SetStateAction<string>>;
  activeAppointmentId: ID | null;
  setActiveAppointmentId: Dispatch<SetStateAction<ID | null>>;
  isSplitPayment: boolean;
  setIsSplitPayment: Dispatch<SetStateAction<boolean>>;
  /** Dynamic split rows — the till can spread one total across any
   * combination of cash / card / wallet / bank transfer. */
  splitLines: SplitLine[];
  setSplitLines: Dispatch<SetStateAction<SplitLine[]>>;
  subtotal: number;
  finalTotal: number;
  taxRate: number;
  taxAmount: number;
  fetchReadyAppointments: () => Promise<void>;
  fetchShift: () => Promise<void>;
  fetchData: () => Promise<void>;
  addToCart: (item: POSRecord, type: string) => void;
  removeFromCart: (uid: string) => void;
  resetPOS: (options?: { silent?: boolean }) => void;
  updateCartItemBarber: (uid: string, newBarberId: ID) => void;
  updateCartItemQuantity: (uid: string, delta: number) => void;
  assignBarberToAll: (barberId: ID) => void;
}
