import { useState, useEffect, useCallback, useMemo } from "react";
import api from "@/services/api";
import { posShiftService } from "@/services/posShiftService";
import { adaptList } from "@/services/apiAdapter";
import { toast } from "react-hot-toast";
import { useSocket } from "@/context/SocketContext";
import { useSalon } from "@/context/SalonContext";
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
  const [customers, setCustomers] = useState<POSRecord[]>([]);
  const [readyAppointments, setReadyAppointments] = useState<POSRecord[]>([]);

  // UI State
  const [loading, setLoading] = useState(true);
  const [readyAppointmentsLoading, setReadyAppointmentsLoading] =
    useState(false);
  const [currentShift, setCurrentShift] = useState<POSRecord | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [businessSettings, setBusinessSettings] =
    useState<POSRecord | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Search & Filtering State
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("الكل");

  // Cart/Checkout State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("walk_in");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [activeAppointmentId, setActiveAppointmentId] =
    useState<ID | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<ID | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
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

  const filteredCustomers = useMemo(() => {
    const query = customerSearchQuery.trim().toLowerCase();
    return customers.filter((c) =>
      `${c.first_name || c.firstName || ""} ${c.phone_primary || c.phonePrimary || ""} ${c.phone || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [customers, customerSearchQuery]);

  // Actions
  const addToCart = useCallback(
    (item: POSRecord, type: string) => {
      if ((type === "service" || type === "offer") && !selectedBarberId) {
        toast.error("يرجى تحديد الخبير المسؤول أولاً");
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

  const isInvoiceEditable = useCallback(
    (invoice: POSRecord | null | undefined): boolean => {
    if (!invoice) return false;
    const createdAt = invoice.created_at || invoice.createdAt;
    if (!createdAt) return true; // Fallback for old data if any

    const createdTime = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const oneHourInMs = 60 * 60 * 1000;

    return now - createdTime <= oneHourInMs;
  }, []);

  const editInvoice = useCallback(
    (invoice: POSRecord | null | undefined) => {
      if (!invoice) return;

      if (!isInvoiceEditable(invoice)) {
        toast.error(
          "عفواً، انتهت الفترة المسموح بها لتعديل الفاتورة (ساعة واحدة)",
        );
        return;
      }

      const items =
        invoice.items || invoice.invoice_items || invoice.invoiceItems || [];
      const newCart = items.map((item) => {
        const type =
          item.item_type || (item.service_id ? "service" : "product");
        const barber = barbers.find(
          (b) => String(b.id) === String(item.employee_id || item.barber_id),
        );

        return {
          id: item.service_id || item.product_id || item.offer_id || item.id,
          uid: `${type}-${item.id}-${Date.now()}-${Math.random()}`,
          name:
            item.service_name ||
            item.product_name ||
            item.offer_name ||
            item.name ||
            "بند",
          price: Number(item.unit_price || item.price || 0),
          type: type,
          barberId: barber?.id || null,
          barberName:
            barber?.display_name ||
            barber?.displayName ||
            barber?.full_name ||
            barber?.fullName ||
            "الخبير",
        };
      });

      setCart(newCart);
      setDiscount(Number(invoice.discount_amount || 0));
      setPaymentMethod((invoice.payment_method || "CASH").toUpperCase());
      setSelectedCustomerId(
        invoice.customer_id ? String(invoice.customer_id) : "walk_in",
      );
      setActiveAppointmentId(invoice.appointment_id || null);
      setActiveInvoiceId(invoice.id || invoice.invoice_id);
      setIsReviewing(false);

      toast.success("تم استعادة بيانات الفاتورة للتعديل");
    },
    [barbers, isInvoiceEditable],
  );

  const removeFromCart = useCallback((uid: string) => {
    setCart((prev) => prev.filter((item) => item.uid !== uid));
  }, []);

  const requestInvoiceAdjustment = useCallback(
    async (
      invoiceId: ID,
      pin: string | null = null,
      reason = "تعديل فاتورة",
    ): Promise<unknown> => {
      try {
        const payload = {
          request_type: "edit_reissue",
          reason: reason,
          manager_pin: pin,
        };
        const res = await api.post(
          `/invoices/${invoiceId}/adjustment-requests`,
          payload,
        );
        return res.data;
      } catch (err) {
        throw err;
      }
    },
    [],
  );

  const resetPOS = useCallback(() => {
    setCart([]);
    setDiscount(0);
    setSelectedBarberId("");
    setSelectedCustomerId("walk_in");
    setPaymentMethod("CASH");
    setActiveAppointmentId(null);
    setActiveInvoiceId(null);
    setIsReviewing(false);
    toast.success("تمت إعادة تعيين محطة الـ POS");
  }, []);

  const fetchReadyAppointments = useCallback(async () => {
    try {
      setReadyAppointmentsLoading(true);
      const response = await api.get("/appointments/ready-for-payment");
      setReadyAppointments(response.data || []);
    } catch (error) {
      console.error("Fetch ready appointments error:", error);
    } finally {
      setReadyAppointmentsLoading(false);
    }
  }, []);

  const fetchShift = useCallback(async () => {
    try {
      setShiftLoading(true);
      const shift = await posShiftService.current();
      setCurrentShift(shift);
    } catch (error) {
      console.error("Shift check failed:", error);
      setCurrentShift(null);
    } finally {
      setShiftLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Phase 1: Load critical data needed for basic UI structure
      const [servicesRes, employeesRes, categoriesRes, settingsRes] =
        await Promise.all([
          api.get("/services", { params: { limit: 1000 } }),
          api.get("/employees", { params: { limit: 1000 } }),
          api.get("/service-categories").catch(() => ({ data: [] })),
          api.get("/business-settings").catch(() => ({ data: null })),
        ]);

      setServices(adaptList(servicesRes));
      setBarbers(adaptList(employeesRes));
      setCategories(adaptList(categoriesRes));
      setBusinessSettings(settingsRes?.data || settingsRes);

      // Set loading to false early to show the UI shell
      setLoading(false);

      // Phase 2: Load secondary data in the background
      const [productsRes, customersRes, offersRes] = await Promise.all([
        api.get("/products", { params: { limit: 1000 } }),
        api.get("/customers", { params: { limit: 1000 } }),
        api
          .get("/offers/active", { params: { limit: 1000 } })
          .catch(() => ({ data: [] })),
      ]);

      setProducts(
        adaptList(productsRes).map((p) => ({
          ...p,
          price: p.sell_price ?? p.price ?? 0,
        })),
      );
      setCustomers(adaptList(customersRes));
      setOffers(adaptList(offersRes));
    } catch (error) {
      console.error("POS data error:", error);
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

    const customer = customers.find(
      (c) => String(c.id || c.customer_id) === String(selectedCustomerId),
    );
    if (!customer) return 0;

    const tiers = businessSettings.loyalty_settings.tiers || [];
    const tier = tiers.find((t) => t.name === customer.current_tier);

    if (tier?.discount_percent) {
      return (subtotal * Number(tier.discount_percent)) / 100;
    }
    return 0;
  }, [
    businessSettings,
    selectedCustomerId,
    customers,
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
    customers,
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
    activeCategory,
    setActiveCategory,
    categoryTabs,
    filteredItems,
    filteredCustomers,
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
    activeInvoiceId,
    setActiveInvoiceId,
    isReviewing,
    setIsReviewing,
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
    isInvoiceEditable,
    editInvoice,
    requestInvoiceAdjustment,
  };

  return value;
}

// Alias for task alternative naming
export const usePOSData = usePOSLogic;
