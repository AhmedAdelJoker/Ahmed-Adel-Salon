import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import api from "@/services/api";
import { posShiftService } from "@/services/posShiftService";
import { adaptList } from "@/services/apiAdapter";
import { toast } from "react-hot-toast";
import { useSocket } from "@/context/SocketContext";
import { useSalon } from "@/context/SalonContext";
import { loadErrorMessage } from "@/lib/core/asyncError";
import { digitsOnly } from "@/features/hr/utils/digits";
import {
  appointmentToCartItems,
  cashierDiscountAllowance,
  isProductOnlyOffer,
  offerAvailableUnits,
  resolveCustomerTier,
} from "@/features/pos/utils";
import type { ID } from "@/types/common";
import type {
  POSRecord,
  CartItem,
  CustomerValidation,
  POSContextValue,
  SaleMode,
  SplitLine,
} from "@/features/pos/types";

/** Digits only: the phone matcher must not care about spaces or dashes, and
 * Arabic-Indic numerals typed on an Arabic keyboard are the same number. */
const digitsOf = (value: unknown): string => digitsOnly(String(value ?? ""));

const fullNameOf = (record: POSRecord | null): string => {
  if (!record) return "";
  return `${String(record.first_name ?? record.firstName ?? "").trim()} ${String(
    record.last_name ?? record.lastName ?? "",
  ).trim()}`.trim();
};

export function usePOSLogic(): POSContextValue {
  const { t } = useTranslation("pos");
  const socketContext = useSocket?.();
  const socket = socketContext?.socket || null;
  const { refreshBalance } = useSalon();

  // Data State
  const [categories, setCategories] = useState<POSRecord[]>([]);
  const [services, setServices] = useState<POSRecord[]>([]);
  const [products, setProducts] = useState<POSRecord[]>([]);
  const [offers, setOffers] = useState<POSRecord[]>([]);
  const [barbers, setBarbers] = useState<POSRecord[]>([]);
  const [readyAppointments, setReadyAppointments] = useState<POSRecord[]>([]);

  // UI State
  const [loading, setLoading] = useState(true);
  const [readyAppointmentsLoading, setReadyAppointmentsLoading] =
    useState(false);
  const [currentShift, setCurrentShift] = useState<POSRecord | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);

  // Load failures. The POS used to swallow these, so a dead API looked exactly
  // like an empty catalogue and a closed till.
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [readyAppointmentsError, setReadyAppointmentsError] = useState<
    string | null
  >(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [businessSettings, setBusinessSettings] =
    useState<POSRecord | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Search & Filtering State
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  // Canonical ids, not display strings: "all"/"offers"/"products" are the
  // three fixed tabs, anything else is a category id from the catalogue.
  // Rendering translates the fixed ones; comparisons below match ids, so the
  // filter survives a language switch (it used to break mid-session when the
  // Arabic literals changed under it).
  const [activeCategory, setActiveCategory] = useState("all");

  // Sale mode decides what the till can sell. Starting or loading a sale
  // always resets the catalogue filter, so the cashier never lands on a tab
  // that does not exist in the new mode (e.g. a product category while a
  // session's services are being sold).
  const [saleMode, setSaleMode] = useState<SaleMode>("idle");

  // Customer block: a mandatory name plus an optional mobile. There is no
  // customer typeahead any more — the phone number is the identity key, and
  // the server resolves it the same way the till previews it here.
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerMatch, setCustomerMatch] = useState<POSRecord | null>(null);
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);
  const [customerLookupError, setCustomerLookupError] = useState<string | null>(
    null,
  );
  const [selectedCustomer, setSelectedCustomer] = useState<POSRecord | null>(
    null,
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState("walk_in");

  // Guards the async session-customer fetch: switching sessions quickly must
  // not leave the older response in `selectedCustomer`.
  const sessionCustomerRequest = useRef(0);

  // Cart/Checkout State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [activeAppointmentId, setActiveAppointmentId] =
    useState<ID | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Split Payment State — rows across any combination of the four accepted
  // instruments (cash / card / wallet / bank_transfer), not just cash+card.
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitLines, setSplitLines] = useState<SplitLine[]>([]);

  const isCustomerLocked = saleMode === "session";

  const nameParts = useMemo(
    () => customerName.trim().split(/\s+/).filter(Boolean).length,
    [customerName],
  );

  const isRegisteredBuyer = isCustomerLocked || Boolean(customerMatch);

  const customerValidation = useMemo<CustomerValidation>(() => {
    const name = customerName.trim();
    const phone = customerPhone.trim();

    if (!name) {
      return {
        valid: false,
        message: t("customer.errors.name_required"),
        isRegistered: isRegisteredBuyer,
        nameParts,
      };
    }

    if (phone && digitsOf(phone).length < 7) {
      return {
        valid: false,
        message: t("customer.errors.phone_invalid"),
        isRegistered: isRegisteredBuyer,
        nameParts,
      };
    }

    // A guest/new buyer is identified by name alone, so the name has to carry
    // first / father / family. A loaded session or a matched phone already has
    // an authoritative customer row; the typed name only has to be non-empty.
    if (!isRegisteredBuyer && nameParts < 3) {
      return {
        valid: false,
        message: t("customer.errors.name_three_parts"),
        isRegistered: false,
        nameParts,
      };
    }

    return {
      valid: true,
      message: null,
      isRegistered: isRegisteredBuyer,
      nameParts,
    };
  }, [customerName, customerPhone, isRegisteredBuyer, nameParts, t]);

  const validateCustomer = useCallback(
    () => customerValidation.message,
    [customerValidation.message],
  );

  // Derived Values
  const categoryTabs = useMemo(() => {
    // The manual sale is one catalogue: retail products and product-only
    // offers. Service categories have no meaning here and must not be offered.
    if (saleMode === "products") return ["all", "products", "offers"];
    return [
      "all",
      "offers",
      "products",
      ...categories.map((c) => c.name_ar || c.name).filter(Boolean),
    ];
  }, [categories, saleMode]);

  // Product-only offers are retail stock in everything but name: they bundle
  // products, carry no service and no expert, and the invoice still records
  // them as an offer line with the offer price.
  const productOffers = useMemo(
    () =>
      offers
        .filter((offer) => isProductOnlyOffer(offer))
        .map((offer) => ({
          ...offer,
          isProductOffer: true,
          stock: offerAvailableUnits(offer, products),
        })),
    [offers, products],
  );

  const filteredItems = useMemo(() => {
    const query = itemSearchQuery.trim().toLowerCase();
    const matches = (item: POSRecord) =>
      String(item.name_ar || item.nameAr || item.name || "")
        .toLowerCase()
        .includes(query);

    // Manual sale: products and product-only offers, never a service.
    if (saleMode === "products") {
      const collection =
        activeCategory === "offers"
          ? productOffers
          : activeCategory === "products"
            ? products
            : [...products, ...productOffers];
      return collection.filter(matches);
    }

    if (activeCategory === "offers") {
      // Session sales may still add an offer. Product-only offers keep their
      // derived shelf count so the cashier cannot oversell the components.
      return offers
        .map((offer) =>
          isProductOnlyOffer(offer)
            ? {
                ...offer,
                isProductOffer: true,
                stock: offerAvailableUnits(offer, products),
              }
            : offer,
        )
        .filter(matches);
    }

    if (activeCategory === "products") {
      return products.filter(matches);
    }

    // Default to services
    let baseServices = services;

    // Filter by barber if selected
    if (selectedBarberId) {
      const barber = barbers.find(
        (b) => String(b.id) === String(selectedBarberId),
      );
      if (barber && barber.service_ids && barber.service_ids.length > 0) {
        baseServices = services.filter((s) =>
          barber.service_ids.includes(s.id),
        );
      }
    }

    return baseServices.filter((s) => {
      const nameMatch = (s.name || s.name_ar || s.nameAr || "")
        .toLowerCase()
        .includes(query);
      if (!nameMatch) return false;
      if (activeCategory === "all") return true;

      const cat = categories.find(
        (c) =>
          c.name === activeCategory ||
          c.name_ar === activeCategory ||
          c.nameAr === activeCategory,
      );
      return String(s.category_id || s.categoryId) === String(cat?.id);
    });
  }, [
    saleMode,
    activeCategory,
    itemSearchQuery,
    services,
    products,
    offers,
    productOffers,
    categories,
    selectedBarberId,
    barbers,
  ]);

  /**
   * Resolve the phone number against the customer table.
   *
   * A matched number attaches the existing row (and its loyalty tier) to the
   * sale; an unmatched number simply stays in the form and the invoice
   * endpoint creates the customer. Session sales are excluded: the appointment
   * already owns the customer, and the field is read-only there.
   */
  useEffect(() => {
    if (isCustomerLocked) {
      setCustomerLookupLoading(false);
      setCustomerLookupError(null);
      setCustomerMatch(null);
      return;
    }

    const digits = digitsOf(customerPhone);
    if (digits.length < 7) {
      setCustomerMatch(null);
      setCustomerLookupLoading(false);
      setCustomerLookupError(null);
      setSelectedCustomer(null);
      setSelectedCustomerId("walk_in");
      return;
    }

    let cancelled = false;
    // The typed number changed, so any previously matched customer is stale
    // until this lookup answers. Clearing here keeps the loyalty line and the
    // total from briefly reflecting the wrong buyer.
    setCustomerMatch(null);
    setSelectedCustomer(null);
    setSelectedCustomerId("walk_in");
    setCustomerLookupLoading(true);

    const timer = setTimeout(async () => {
      try {
        const response = await api.get("/customers/search", {
          params: { phone: digits },
        });
        if (cancelled) return;
        const rows = adaptList(response);
        const match =
          rows.find((row: POSRecord) =>
            digitsOf(row.phone) === digits ||
            digitsOf(row.second_phone ?? row.secondPhone) === digits,
          ) ?? null;
        setCustomerMatch(match);
        setCustomerLookupError(null);
        if (match) {
          setSelectedCustomer(match);
          setSelectedCustomerId(
            String(match.customer_id ?? match.id ?? "walk_in"),
          );
          // Keep a name the cashier already typed; only fill a blank one.
          setCustomerName((prev) => prev.trim() || fullNameOf(match));
        }
      } catch (error) {
        if (cancelled) return;
        console.error("POS phone lookup failed:", error);
        setCustomerMatch(null);
        setCustomerLookupError(
          loadErrorMessage(error, t("customer.lookup_error")),
        );
      } finally {
        if (!cancelled) setCustomerLookupLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerPhone, isCustomerLocked, t]);

  /** Load the loyalty/contact record for a session's customer. */
  const hydrateSessionCustomer = useCallback(
    async (customerId: ID, requestId: number) => {
      try {
        const response = await api.get(`/customers/${customerId}`);
        if (requestId !== sessionCustomerRequest.current) return;
        const record = (response.data?.data ?? response.data) as POSRecord;
        if (!record || typeof record !== "object") return;
        setSelectedCustomer(record);
        setSelectedCustomerId(
          String(record.customer_id ?? record.id ?? customerId),
        );
        setCustomerName((prev) => prev.trim() || fullNameOf(record));
        setCustomerPhone((prev) => prev.trim() || String(record.phone ?? ""));
        setCustomerLookupError(null);
      } catch (error) {
        if (requestId !== sessionCustomerRequest.current) return;
        console.error("POS session customer load failed:", error);
        // Non-fatal: the session's snapshot name on the appointment is still
        // usable. Surface it so the cashier knows loyalty may not be shown.
        setCustomerLookupError(
          loadErrorMessage(error, t("customer.lookup_error")),
        );
      }
    },
    [t],
  );

  // Actions
  const addToCart = useCallback(
    (item: POSRecord, type: string, quantity: number = 1) => {
      // The manual sale sells retail: products and product-only offers. A
      // product offer is still an `offer` line on the invoice, but it behaves
      // like stock — quantity, shelf limit, no expert.
      const isProductOffer = type === "offer" && isProductOnlyOffer(item);
      const itemType =
        saleMode === "products"
          ? isProductOffer
            ? "offer"
            : "product"
          : type;
      const isStocked = itemType === "product" || isProductOffer;

      if ((itemType === "service" || itemType === "offer") && !isProductOffer) {
        if (!selectedBarberId) {
          toast.error(t("logic.pick_expert_first"));
          return;
        }
      }

      const id =
        item.id ||
        item.service_id ||
        item.productId ||
        item.product_id ||
        item.offer_id;

      const stock = isProductOffer
        ? offerAvailableUnits(item, products)
        : Number(item.quantity ?? item.stock ?? 0);
      const reqQty = Math.max(1, Math.floor(Number(quantity) || 1));

      // Shelf guard: a stocked-out product can still be picked from the grid,
      // so refuse it here before it hides inside the cart. A product offer
      // needs every component in stock for each bundle it sells.
      if (isStocked) {
        if (stock <= 0) {
          toast.error(t("logic.out_of_stock"));
          return;
        }
        if (reqQty > stock) {
          toast.error(t("logic.max_stock", { count: Math.floor(stock) }));
          return;
        }
      }

      const barber = barbers.find(
        (b) => String(b.id) === String(selectedBarberId),
      );

      const unitPrice = Number(
        item.price ||
          item.sell_price ||
          item.sellPrice ||
          item.offer_price ||
          item.offerPrice ||
          0,
      );

      const name =
        item.name_ar ||
        item.nameAr ||
        item.name ||
        item.display_name ||
        item.displayName ||
        t("logic.item_fallback");

      // Dedup policy (Option A):
      // - products and product offers: collapse into one line, increment qty.
      // - services: duplicate only if barber differs; same service+barber blocked.
      // - service offers: collapse (block duplicate).
      if (isStocked) {
        const existing = cart.find(
          (c) => String(c.id) === String(id) && c.type === itemType,
        );
        if (existing) {
          const newQty = (existing.quantity || 1) + reqQty;
          if (newQty > stock) {
            toast.error(t("logic.max_stock", { count: Math.floor(stock) }));
            return;
          }
          setCart((prev) =>
            prev.map((c) =>
              c.uid === existing.uid ? { ...c, quantity: newQty } : c,
            ),
          );
          toast.success(t("logic.qty_updated"));
          return;
        }
      } else if (itemType === "service") {
        const dup = cart.find(
          (c) =>
            String(c.id) === String(id) &&
            c.type === itemType &&
            String(c.barberId) === String(barber?.id ?? ""),
        );
        if (dup) {
          toast.error(t("logic.already_in_cart"));
          return;
        }
      } else {
        if (cart.some((c) => String(c.id) === String(id) && c.type === itemType)) {
          toast.error(t("logic.already_in_cart"));
          return;
        }
      }

      setCart((prev) => [
        ...prev,
        {
          id,
          uid: `${itemType}-${id}-${Date.now()}`,
          name,
          price: unitPrice,
          quantity: reqQty,
          type: itemType,
          isProductOffer: isProductOffer || undefined,
          barberId: isStocked ? null : barber?.id || null,
          barberName: isStocked
            ? t("cart.store")
            : barber?.display_name ||
              barber?.displayName ||
              barber?.full_name ||
              barber?.fullName ||
              t("cart.store"),
          stock: isStocked ? stock : undefined,
          durationMinutes:
            item.duration_minutes || item.durationMinutes || item.duration || undefined,
          sku: item.sku || undefined,
          originalPrice:
            item.original_price || item.originalPrice || item.offer_price_original || undefined,
          includedItems: item.included_items || item.includedItems || undefined,
          categoryName: item.category || item.category_name || item.categoryName || undefined,
        },
      ]);
      toast.success(t("logic.added"));
    },
    [saleMode, selectedBarberId, barbers, cart, products, t],
  );

  const updateCartItemBarber = useCallback(
    (uid: string, newBarberId: ID) => {
      const barber = barbers.find((b) => String(b.id) === String(newBarberId));
      setCart((prev) =>
        prev.map((item) =>
          item.uid === uid
            ? {
                ...item,
                barberId: newBarberId,
                barberName:
                  barber?.display_name ||
                  barber?.displayName ||
                  barber?.full_name ||
                  barber?.fullName ||
                  t("cart.expert_fallback"),
              }
            : item,
        ),
      );
    },
    [barbers, t],
  );

  const updateCartItemQuantity = useCallback((uid: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.uid !== uid) return item;
        const stock = Number(item.stock ?? 0);
        const current = Number(item.quantity || 1);
        let next = current + delta;
        if (next < 1) next = 1;
        const isStocked = item.type === "product" || item.isProductOffer;
        if (isStocked && stock > 0 && next > stock) {
          toast.error(t("logic.max_stock", { count: Math.floor(stock) }));
          next = stock;
        }
        return { ...item, quantity: next };
      }),
    );
  }, [t]);

  const assignBarberToAll = useCallback(
    (barberId: ID) => {
      if (!barberId) return;
      const barber = barbers.find((b) => String(b.id) === String(barberId));
      if (!barber) return;

      setCart((prev) =>
        prev.map((item) => ({
          ...item,
          // Products and product-only offers never carry an expert;
          // assigning one must not make a retail line look like a service.
          barberId:
            item.type === "product" || item.isProductOffer ? null : barberId,
          barberName:
            item.type === "product" || item.isProductOffer
              ? t("cart.store")
              : barber.display_name ||
                barber.displayName ||
                barber.full_name ||
                barber.fullName ||
                t("cart.expert_fallback"),
        })),
      );
      toast.success(
        t("logic.assigned_all", {
          name: barber.display_name || t("cart.expert_fallback"),
        }),
      );
    },
    [barbers, t],
  );

  const removeFromCart = useCallback((uid: string) => {
    setCart((prev) => prev.filter((item) => item.uid !== uid));
  }, []);

  /** Wipe every sale-scoped field. Mode returns to the session queue. */
  const resetPOS = useCallback(
    (options?: { silent?: boolean }) => {
      setCart([]);
      setDiscount(0);
      setSelectedBarberId("");
      setSelectedCustomerId("walk_in");
      setSelectedCustomer(null);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerMatch(null);
      setCustomerLookupError(null);
      setPaymentMethod("CASH");
      setIsSplitPayment(false);
      setSplitLines([]);
      setActiveAppointmentId(null);
      setItemSearchQuery("");
      setActiveCategory("all");
      setSaleMode("idle");
      sessionCustomerRequest.current += 1;
      if (!options?.silent) toast.success(t("logic.pos_reset"));
    },
    [t],
  );

  const startSaleMode = useCallback(
    (mode: "products") => {
      setCart([]);
      setDiscount(0);
      setSelectedBarberId("");
      setSelectedCustomerId("walk_in");
      setSelectedCustomer(null);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerMatch(null);
      setCustomerLookupError(null);
      setPaymentMethod("CASH");
      setIsSplitPayment(false);
      setSplitLines([]);
      setActiveAppointmentId(null);
      setItemSearchQuery("");
      setActiveCategory("all");
      setSaleMode(mode);
      sessionCustomerRequest.current += 1;
      toast.success(t("products_sale.started"));
    },
    [t],
  );

  /**
   * Start a walk-in (no appointment) service sale.
   *
   * Opens the service catalogue with a walk-in customer so the cashier can
   * ring up services for a customer who has no pre-booked appointment.
   */
  const startQuickSale = useCallback(() => {
    setCart([]);
    setDiscount(0);
    setSelectedBarberId("");
    setSelectedCustomerId("walk_in");
    setSelectedCustomer(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerMatch(null);
    setCustomerLookupError(null);
    setPaymentMethod("CASH");
    setIsSplitPayment(false);
    setSplitLines([]);
    setActiveAppointmentId(null);
    setItemSearchQuery("");
    setActiveCategory("all");
    setSaleMode("session");
    sessionCustomerRequest.current += 1;
    toast.success(t("logic.quick_sale_started"));
  }, [t]);

  /**
   * Load a reception session into the till.
   *
   * The appointment owns the buyer: the name and phone are prefilled from it
   * and shown read-only. The loyalty record is fetched separately because the
   * appointment payload only carries the id and the snapshot name.
   */
  const loadSession = useCallback(
    (appointment: POSRecord, options?: { notify?: boolean }) => {
      if (!appointment) return;
      const appointmentId =
        appointment.appointment_id ||
        appointment.appointmentId ||
        appointment.id;
      const appointmentBarberId =
        appointment.employee_id ||
        appointment.employeeId ||
        appointment.barber_id ||
        appointment.barberId ||
        "";
      const customerId =
        appointment.customer_id ?? appointment.customerId ?? null;
      const snapshotName = String(
        appointment.customer_name ?? appointment.customerName ?? "",
      ).trim();
      const unknownName = t("sessions.unknown_customer");
      const phone = String(
        appointment.customer_phone ?? appointment.customerPhone ?? "",
      ).trim();

      sessionCustomerRequest.current += 1;
      const requestId = sessionCustomerRequest.current;

      setCart(appointmentToCartItems(appointment, barbers, appointmentBarberId));
      setActiveAppointmentId(appointmentId);
      setSelectedBarberId(appointmentBarberId ? String(appointmentBarberId) : "");
      setSelectedCustomerId(customerId ? String(customerId) : "walk_in");
      setSelectedCustomer(null);
      setCustomerMatch(null);
      setCustomerName(
        snapshotName && snapshotName !== unknownName ? snapshotName : "",
      );
      setCustomerPhone(phone);
      setCustomerLookupError(null);
      setDiscount(0);
      setPaymentMethod("CASH");
      setIsSplitPayment(false);
      setSplitLines([]);
      setItemSearchQuery("");
      setActiveCategory("all");
      setSaleMode("session");

      if (customerId) {
        void hydrateSessionCustomer(customerId, requestId);
      }
      if (options?.notify !== false) {
        toast.success(t("sessions.loaded"));
      }
    },
    [barbers, hydrateSessionCustomer, t],
  );

  const fetchReadyAppointments = useCallback(async () => {
    try {
      setReadyAppointmentsLoading(true);
      const response = await api.get("/appointments/ready-for-payment");
      setReadyAppointments(response.data || []);
    } catch (error) {
      // Was console-only, so a failed fetch left the queue simply empty and the
      // cashier could not tell "nobody waiting" from "the request failed".
      console.error("Fetch ready appointments error:", error);
      setReadyAppointmentsError(loadErrorMessage(error, t("logic.queue_error")));
    } finally {
      setReadyAppointmentsLoading(false);
    }
  }, [t]);

  const fetchShift = useCallback(async () => {
    try {
      setShiftLoading(true);
      const shift = await posShiftService.current();
      setCurrentShift(shift);
      setShiftError(null);
    } catch (error) {
      // Previously this set currentShift to null, which is indistinguishable
      // from "no shift is open". A failed check must not read as a closed till.
      console.error("Shift check failed:", error);
      setCurrentShift(null);
      setShiftError(
        `${loadErrorMessage(error, t("logic.shift_error"))} ${t("logic.shift_not_confirmed")}`,
      );
    } finally {
      setShiftLoading(false);
    }
  }, [t]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setCatalogError(null);

      // Phase 1: Load critical data needed for basic UI structure.
      // Categories and shop settings degrade to empty on failure, which is
      // fine visually. A dead services or employees call is fatal: the till
      // would render with nothing to sell and nothing to sell it to, and an
      // empty catalogue is indistinguishable from a stocked-but-quiet day.
      // /employees/pos (not /employees): the full roster carries payroll data
      // and is manage-employees-only, so cashiers got 403 here. The POS copy
      // returns identity + service links for active, show_in_pos staff.
      const [servicesRes, employeesRes, categoriesRes, settingsRes] =
        await Promise.all([
          api.get("/services", { params: { limit: 1000 } }),
          api.get("/employees/pos", { params: { limit: 1000 } }),
          api.get("/service-categories").catch(() => ({ data: [] })),
          api.get("/business-settings").catch(() => ({ data: null })),
        ]);

      setServices(adaptList(servicesRes));
      setBarbers(adaptList(employeesRes));
      setCategories(adaptList(categoriesRes));
      setBusinessSettings(settingsRes?.data || settingsRes);

      // Set loading to false early to show the UI shell
      setLoading(false);

      // Phase 2: Load secondary data in the background. A failure here must
      // degrade, not brick the till: services (phase 1) are already on
      // screen, so blocking the whole POS because the customer list timed out
      // turned a slow network into a dead register. Each fetch settles on its
      // own; the cashier keeps selling whatever did load.
      //
      // Customers are deliberately NOT preloaded: the till resolves them from
      // the optional phone number on demand (see the lookup effect above), so
      // opening the POS no longer pulls the entire customer table into memory.
      const [productsOut, offersOut] = await Promise.allSettled([
        api.get("/products", { params: { limit: 1000 } }),
        api.get("/offers/active", { params: { limit: 1000 } }),
      ]);

      if (productsOut.status === "fulfilled") {
        setProducts(
          adaptList(productsOut.value).map((p) => ({
            ...p,
            price: p.sell_price ?? p.price ?? 0,
          })),
        );
      } else {
        console.error("POS products fetch failed:", productsOut.reason);
        toast.error(t("logic.products_error"));
      }

      if (offersOut.status === "fulfilled") {
        setOffers(adaptList(offersOut.value));
      } else {
        console.error("POS offers fetch failed:", offersOut.reason);
        toast.error(t("logic.offers_error"));
      }
    } catch (error) {
      console.error("POS data error:", error);
      setCatalogError(loadErrorMessage(error, t("logic.pos_data")));
      toast.error(t("logic.sync_failed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
    fetchShift();
    fetchReadyAppointments();
  }, [fetchData, fetchShift, fetchReadyAppointments]);

  // WebSocket Integration
  useEffect(() => {
    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (
          msg.event === "appointment_ready_for_payment" ||
          msg.event === "appointment_status_changed"
        ) {
          fetchReadyAppointments();
          if (msg.event === "appointment_ready_for_payment") {
            toast.success(t("logic.new_session"));
          }
        }
      } catch (err) {
        console.error("WS Parse Error in POS", err);
      }
    };

    socket?.addEventListener("message", handleMessage);
    return () => socket?.removeEventListener("message", handleMessage);
  }, [socket, fetchReadyAppointments, t]);

  const [lastInvoice, setLastInvoice] = useState<POSRecord | null>(null);
  const [completedCustomerName, setCompletedCustomerName] = useState("");
  const [completedBarberName, setCompletedBarberName] = useState("");

  // Derived
  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
        0,
      ),
    [cart],
  );

  const taxRate = useMemo(() => {
    const raw = Number(
      businessSettings?.tax_rate ??
        businessSettings?.taxRate ??
        businessSettings?.vat_rate ??
        businessSettings?.vatRate ??
        0,
    );
    return Number.isFinite(raw) ? raw : 0;
  }, [businessSettings]);

  const loyaltyDiscount = useMemo(() => {
    if (!businessSettings?.loyalty_settings?.enabled) return 0;
    // A guest sale has no customer record, so there is no tier to apply. The
    // server computes the same discount from the resolved customer id.
    if (!selectedCustomer) return 0;

    // The tier comes from the visit count, so the badge and the price always
    // agree — and a customer whose stored tier name is stale still gets the
    // discount they actually qualify for.
    const tier = resolveCustomerTier(
      selectedCustomer,
      businessSettings.loyalty_settings,
    );
    if (!tier?.discount_percent) return 0;

    return (subtotal * Number(tier.discount_percent)) / 100;
  }, [businessSettings, selectedCustomer, subtotal]);

  const taxAmount = useMemo(() => {
    const base = Math.max(0, subtotal - Number(discount || 0) - loyaltyDiscount);
    const rate = taxRate > 1 ? taxRate / 100 : taxRate;
    return base * rate;
  }, [subtotal, discount, loyaltyDiscount, taxRate]);

  const finalTotal = useMemo(
    () =>
      Math.max(0, subtotal - Number(discount || 0) - loyaltyDiscount + taxAmount),
    [subtotal, discount, loyaltyDiscount, taxAmount],
  );

  // The discount a cashier may apply without a manager's approval, read from
  // the owner's setting rather than a constant baked into the till.
  const discountAllowance = useMemo(
    () => cashierDiscountAllowance(businessSettings, subtotal),
    [businessSettings, subtotal],
  );

  const isShopOpen = useMemo(() => {
    if (!businessSettings?.working_hours) return true;

    const now = new Date();
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = days[now.getDay()];
    const dayConfig = businessSettings.working_hours[dayName];

    if (!dayConfig || !dayConfig.is_open) return false;

    const openStr = dayConfig.open_time;
    const closeStr = dayConfig.close_time;
    if (!openStr || !closeStr) return true;

    try {
      const [oH, oM] = openStr.split(":").map(Number);
      const [cH, cM] = closeStr.split(":").map(Number);

      const openTime = new Date();
      openTime.setHours(oH, oM, 0, 0);

      const closeTime = new Date();
      closeTime.setHours(cH, cM, 0, 0);

      // Handle overnight
      if (openTime > closeTime) {
        if (now < closeTime) {
          // After midnight but before close
          return true;
        }
        return now >= openTime;
      }

      return now >= openTime && now <= closeTime;
    } catch (_e) {
      return true;
    }
  }, [businessSettings]);

  const value: POSContextValue = {
    // Data
    categories,
    services,
    products,
    offers,
    productOffers,
    barbers,
    readyAppointments,
    businessSettings,
    currentShift,
    setCurrentShift,
    isShopOpen,
    refreshBalance,
    // UI State
    loading,
    readyAppointmentsLoading,
    shiftLoading,
    shiftError,
    readyAppointmentsError,
    catalogError,
    showApprovalModal,
    setShowApprovalModal,
    isSubmitting,
    setIsSubmitting,
    setLastInvoice,
    lastInvoice,
    completedCustomerName,
    setCompletedCustomerName,
    completedBarberName,
    setCompletedBarberName,
    itemSearchQuery,
    setItemSearchQuery,
    saleMode,
    startSaleMode,
    startQuickSale,
    loadSession,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    customerLookupLoading,
    customerLookupError,
    customerMatch,
    isCustomerLocked,
    customerValidation,
    validateCustomer,
    activeCategory,
    setActiveCategory,
    categoryTabs,
    filteredItems,
    // Cart State
    cart,
    setCart,
    selectedBarberId,
    setSelectedBarberId,
    selectedCustomerId,
    setSelectedCustomerId,
    selectedCustomer,
    discount,
    setDiscount,
    loyaltyDiscount,
    paymentMethod,
    setPaymentMethod,
    activeAppointmentId,
    setActiveAppointmentId,
    isSplitPayment,
    setIsSplitPayment,
    splitLines,
    setSplitLines,
    // Derived
    subtotal,
    finalTotal,
    taxRate,
    taxAmount,
    discountAllowance,
    // Actions
    fetchReadyAppointments,
    fetchShift,
    fetchData,
    addToCart,
    removeFromCart,
    resetPOS,
    updateCartItemBarber,
    updateCartItemQuantity,
    assignBarberToAll,
  };

  return value;
}

// Alias for task alternative naming
export const usePOSData = usePOSLogic;
