import { useState, useEffect, useCallback, useMemo } from "react";
import api from "@/services/api";
import { posShiftService } from "@/services/posShiftService";
import { adaptList } from "@/services/apiAdapter";
import { toast } from "react-hot-toast";
import { useSocket } from "@/context/SocketContext";
import { useSalon } from "@/context/SalonContext";
import { loadErrorMessage } from "@/lib/core/asyncError";
import { resolveCustomerTier } from "@/features/pos/utils";
import type { ID } from "@/types/common";
import type { POSRecord, CartItem, POSContextValue } from "@/features/pos/types";

export function usePOSLogic(): POSContextValue {
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
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("الكل");

  // Customer lookup is a server-side typeahead, not a client-side filter over
  // a preloaded roster. The POS used to pull /customers?limit=1000 on every
  // page open — the whole customer table, with every column, into the till's
  // memory — and then filtered it locally, for a list no UI ever displayed.
  // The till now asks the server for exactly what it shows.
  const [customerSearchResults, setCustomerSearchResults] = useState<
    POSRecord[]
  >([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(
    null,
  );
  // The one customer this sale is for. Holding the picked record (instead of
  // a whole roster) is what lets the till drop the 1000-row preload while
  // still knowing the customer's loyalty tier and name at checkout time.
  const [selectedCustomer, setSelectedCustomer] = useState<POSRecord | null>(
    null,
  );

  // Cart/Checkout State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("walk_in");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [activeAppointmentId, setActiveAppointmentId] =
    useState<ID | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Customer State
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerFirstName, setNewCustomerFirstName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  // Split Payment State
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitCashAmount, setSplitCashAmount] = useState(0);
  const [splitCardAmount, setSplitCardAmount] = useState(0);

  // Derived Values
  const categoryTabs = useMemo(
    () => [
      "الكل",
      "العروض",
      "المنتجات",
      ...categories.map((c) => c.name_ar || c.name).filter(Boolean),
    ],
    [categories],
  );

  const filteredItems = useMemo(() => {
    const query = itemSearchQuery.trim().toLowerCase();

    if (activeCategory === "العروض") {
      return offers.filter((o) =>
        (o.name || o.name_ar || "").toLowerCase().includes(query),
      );
    }

    if (activeCategory === "المنتجات") {
      return products.filter((p) =>
        (p.name || "").toLowerCase().includes(query),
      );
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
      if (activeCategory === "الكل") return true;

      const cat = categories.find(
        (c) =>
          c.name === activeCategory ||
          c.name_ar === activeCategory ||
          c.nameAr === activeCategory,
      );
      return String(s.category_id || s.categoryId) === String(cat?.id);
    });
  }, [
    activeCategory,
    itemSearchQuery,
    services,
    products,
    offers,
    categories,
    selectedBarberId,
    barbers,
  ]);

  // Server-side customer typeahead. Debounced so a fast typist does not fire
  // one request per keystroke, and sequence-guarded so a slow response for an
  // older query cannot overwrite the results of a newer one (the classic
  // out-of-order race that leaves the list showing the wrong customer).
  useEffect(() => {
    const query = customerSearchQuery.trim();

    if (query.length < 2) {
      setCustomerSearchResults([]);
      setCustomerSearchError(null);
      setCustomerSearchLoading(false);
      return;
    }

    let cancelled = false;
    setCustomerSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const response = await api.get("/customers", {
          params: { q: query, limit: 20 },
        });
        if (cancelled) return;
        setCustomerSearchResults(adaptList(response));
        setCustomerSearchError(null);
      } catch (error) {
        if (cancelled) return;
        console.error("POS customer search failed:", error);
        setCustomerSearchResults([]);
        setCustomerSearchError(
          loadErrorMessage(error, "البحث عن العميل"),
        );
      } finally {
        if (!cancelled) setCustomerSearchLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerSearchQuery]);

  // Actions
  const addToCart = useCallback(
    (item: POSRecord, type: string) => {
      if ((type === "service" || type === "offer") && !selectedBarberId) {
        toast.error("يرجى تحديد الخبير المسؤول أولاً");
        return;
      }

      // Shelf guard: a stocked-out product can still be picked from the grid,
      // so refuse it here before it hides inside the cart and only surfaces as
      // a 400 when the customer is already standing at the till.
      if (type === "product" && Number(item.quantity ?? 0) <= 0) {
        toast.error("المنتج غير متوفر في المخزون");
        return;
      }

      const id =
        item.id ||
        item.service_id ||
        item.productId ||
        item.product_id ||
        item.offer_id;
      if (cart.some((c) => String(c.id) === String(id) && c.type === type)) {
        toast.error("هذا البند موجود بالفعل في السلة");
        return;
      }

      const barber = barbers.find(
        (b) => String(b.id) === String(selectedBarberId),
      );

      setCart((prev) => [
        ...prev,
        {
          id,
          uid: `${type}-${id}-${Date.now()}`,
          name:
            item.name_ar ||
            item.nameAr ||
            item.name ||
            item.display_name ||
            item.displayName ||
            "عنصر",
          price: Number(
            item.price ||
              item.sell_price ||
              item.sellPrice ||
              item.offer_price ||
              item.offerPrice ||
              0,
          ),
          type,
          barberId: barber?.id || null,
          barberName:
            barber?.display_name ||
            barber?.displayName ||
            barber?.full_name ||
            barber?.fullName ||
            "المتجر",
        },
      ]);
      toast.success("تمت الإضافة للسلة");
    },
    [selectedBarberId, barbers, cart],
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
                  "الخبير",
              }
            : item,
        ),
      );
    },
    [barbers],
  );

  const assignBarberToAll = useCallback(
    (barberId: ID) => {
      if (!barberId) return;
      const barber = barbers.find((b) => String(b.id) === String(barberId));
      if (!barber) return;

      setCart((prev) =>
        prev.map((item) => ({
          ...item,
          barberId: barberId,
          barberName:
            barber.display_name ||
            barber.displayName ||
            barber.full_name ||
            barber.fullName ||
            "الخبير",
        })),
      );
      toast.success(`تم تعيين ${barber.display_name || "الخبير"} لجميع البنود`);
    },
    [barbers],
  );

  const removeFromCart = useCallback((uid: string) => {
    setCart((prev) => prev.filter((item) => item.uid !== uid));
  }, []);

  const resetPOS = useCallback(() => {
    setCart([]);
    setDiscount(0);
    setSelectedBarberId("");
    setSelectedCustomerId("walk_in");
    setSelectedCustomer(null);
    setCustomerSearchQuery("");
    setPaymentMethod("CASH");
    setActiveAppointmentId(null);
    toast.success("تمت إعادة تعيين محطة الـ POS");
  }, []);

  /**
   * Attach a customer to this sale. The id and the record are set together:
   * the id is what the invoice carries, the record is what the till needs for
   * the loyalty tier and the printed name. Setting one without the other was
   * the bug that made a walked-in customer silently lose their loyalty
   * discount.
   */
  const selectCustomer = useCallback((customer: POSRecord | null) => {
    if (!customer) {
      setSelectedCustomer(null);
      setSelectedCustomerId("walk_in");
      return;
    }
    setSelectedCustomer(customer);
    setSelectedCustomerId(String(customer.customer_id ?? customer.id ?? ""));
    setCustomerSearchQuery("");
  }, []);

  const fetchReadyAppointments = useCallback(async () => {
    try {
      setReadyAppointmentsLoading(true);
      const response = await api.get("/appointments/ready-for-payment");
      setReadyAppointments(response.data || []);
    } catch (error) {
      // Was console-only, so a failed fetch left the queue simply empty and the
      // cashier could not tell "nobody waiting" from "the request failed".
      console.error("Fetch ready appointments error:", error);
      setReadyAppointmentsError(loadErrorMessage(error, "قائمة الانتظار"));
    } finally {
      setReadyAppointmentsLoading(false);
    }
  }, []);

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
        `${loadErrorMessage(error, "حالة الوردية")} لم يتم تأكيد أن الوردية مفتوحة.`,
      );
    } finally {
      setShiftLoading(false);
    }
  }, []);

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
      // Customers are deliberately NOT preloaded: the till searches them
      // server-side on demand (see the typeahead effect above), so opening
      // the POS no longer pulls the entire customer table into memory.
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
        toast.error("تعذر تحميل قائمة المنتجات — أعد التحديث لاحقاً");
      }

      if (offersOut.status === "fulfilled") {
        setOffers(adaptList(offersOut.value));
      } else {
        console.error("POS offers fetch failed:", offersOut.reason);
        toast.error("تعذر تحميل قائمة العروض — أعد التحديث لاحقاً");
      }
    } catch (error) {
      console.error("POS data error:", error);
      setCatalogError(loadErrorMessage(error, "بيانات نقطة البيع"));
      toast.error("فشل مزامنة محطة العمل");
    } finally {
      setLoading(false);
    }
  }, []);

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
            toast.success("جلسة جديدة جاهزة للدفع");
          }
        }
      } catch (err) {
        console.error("WS Parse Error in POS", err);
      }
    };

    socket?.addEventListener("message", handleMessage);
    return () => socket?.removeEventListener("message", handleMessage);
  }, [socket, fetchReadyAppointments]);

  const [lastInvoice, setLastInvoice] = useState<POSRecord | null>(null);
  const [completedCustomerName, setCompletedCustomerName] = useState("");
  const [completedBarberName, setCompletedBarberName] = useState("");

  // Derived
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [cart],
  );

  const loyaltyDiscount = useMemo(() => {
    if (!businessSettings?.loyalty_settings?.enabled) return 0;
    if (selectedCustomerId === "walk_in" || isNewCustomer) return 0;

    // The tier comes from the visit count, so the badge and the price always
    // agree — and a customer whose stored tier name is stale still gets the
    // discount they actually qualify for.
    const tier = resolveCustomerTier(
      selectedCustomer,
      businessSettings.loyalty_settings,
    );
    if (!tier?.discount_percent) return 0;

    return (subtotal * Number(tier.discount_percent)) / 100;
  }, [
    businessSettings,
    selectedCustomer,
    selectedCustomerId,
    isNewCustomer,
    subtotal,
  ]);

  const finalTotal = useMemo(
    () => Math.max(0, subtotal - Number(discount || 0) - loyaltyDiscount),
    [subtotal, discount, loyaltyDiscount],
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
    customerSearchQuery,
    setCustomerSearchQuery,
    customerSearchResults,
    customerSearchLoading,
    customerSearchError,
    selectedCustomer,
    selectCustomer,
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
    discount,
    setDiscount,
    loyaltyDiscount,
    paymentMethod,
    setPaymentMethod,
    activeAppointmentId,
    setActiveAppointmentId,
    isNewCustomer,
    setIsNewCustomer,
    newCustomerFirstName,
    setNewCustomerFirstName,
    newCustomerPhone,
    setNewCustomerPhone,
    isSplitPayment,
    setIsSplitPayment,
    splitCashAmount,
    setSplitCashAmount,
    splitCardAmount,
    setSplitCardAmount,
    // Derived
    subtotal,
    finalTotal,
    // Actions
    fetchReadyAppointments,
    fetchShift,
    fetchData,
    addToCart,
    removeFromCart,
    resetPOS,
    updateCartItemBarber,
    assignBarberToAll,
  };

  return value;
}

// Alias for task alternative naming
export const usePOSData = usePOSLogic;
