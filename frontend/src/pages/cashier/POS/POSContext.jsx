import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../../services/api';
import { posShiftService } from '../../../services/posShiftService';
import { adaptList } from '../../../services/apiAdapter';
import { toast } from 'react-hot-toast';
import { useSocket } from '../../../context/SocketContext';

const POSContext = createContext(null);

export const POSProvider = ({ children }) => {
  const socketContext = useSocket?.();
  const socket = socketContext?.socket || null;

  // Data State
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [offers, setOffers] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [readyAppointments, setReadyAppointments] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [readyAppointmentsLoading, setReadyAppointmentsLoading] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [businessSettings, setBusinessSettings] = useState(null);
  
  // Search & Filtering State
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("الكل");
  
  // Cart/Checkout State
  const [cart, setCart] = useState([]);
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("walk_in");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [activeAppointmentId, setActiveAppointmentId] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Customer State
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerFirstName, setNewCustomerFirstName] = useState("");
  const [newCustomerLastName, setNewCustomerLastName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  // Split Payment State
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitCashAmount, setSplitCashAmount] = useState(0);
  const [splitCardAmount, setSplitCardAmount] = useState(0);

  // Derived Values
  const categoryTabs = useMemo(() => [
    "الكل",
    "العروض",
    "المنتجات",
    ...categories.map(c => c.name_ar || c.name).filter(Boolean)
  ], [categories]);

  const filteredItems = useMemo(() => {
    const query = itemSearchQuery.trim().toLowerCase();
    
    if (activeCategory === "العروض") {
      return offers.filter(o => (o.name || o.name_ar || "").toLowerCase().includes(query));
    }
    
    if (activeCategory === "المنتجات") {
      return products.filter(p => (p.name || "").toLowerCase().includes(query));
    }

    // Default to services
    return services.filter(s => {
      const nameMatch = (s.name || s.name_ar || s.nameAr || "").toLowerCase().includes(query);
      if (!nameMatch) return false;
      if (activeCategory === "الكل") return true;
      
      const cat = categories.find(c => c.name === activeCategory || c.name_ar === activeCategory || c.nameAr === activeCategory);
      return String(s.category_id || s.categoryId) === String(cat?.id);
    });
  }, [activeCategory, itemSearchQuery, services, products, offers, categories]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearchQuery.trim().toLowerCase();
    return customers.filter(c => 
      `${c.first_name || c.firstName || ""} ${c.last_name || c.lastName || ""} ${c.phone_primary || c.phonePrimary || ""} ${c.phone_secondary || c.phoneSecondary || ""}`
      .toLowerCase().includes(query)
    );
  }, [customers, customerSearchQuery]);

  // Actions
  const addToCart = useCallback((item, type) => {
    if ((type === "service" || type === "offer") && !selectedBarberId) {
      toast.error("يرجى تحديد الخبير المسؤول أولاً");
      return;
    }

    const id = item.id || item.service_id || item.productId || item.product_id || item.offer_id;
    if (cart.some(c => String(c.id) === String(id) && c.type === type)) {
      toast.error("هذا البند موجود بالفعل في السلة");
      return;
    }

    const barber = barbers.find(b => String(b.id) === String(selectedBarberId));
    
    setCart(prev => [...prev, {
      id,
      uid: `${type}-${id}-${Date.now()}`,
      name: item.name_ar || item.nameAr || item.name || item.display_name || item.displayName || "عنصر",
      price: Number(item.price || item.sell_price || item.sellPrice || item.offer_price || item.offerPrice || 0),
      type,
      barberId: barber?.id || null,
      barberName: barber?.display_name || barber?.displayName || barber?.full_name || barber?.fullName || "المتجر"
    }]);
    toast.success("تمت الإضافة للسلة");
  }, [selectedBarberId, barbers, cart]);

  const updateCartItemBarber = useCallback((uid, newBarberId) => {
    const barber = barbers.find(b => String(b.id) === String(newBarberId));
    setCart(prev => prev.map(item => 
      item.uid === uid 
        ? { ...item, barberId: newBarberId, barberName: barber?.display_name || barber?.displayName || barber?.full_name || barber?.fullName || "الخبير" }
        : item
    ));
  }, [barbers]);

  const removeFromCart = useCallback((uid) => {
    setCart(prev => prev.filter(item => item.uid !== uid));
  }, []);

  const resetPOS = useCallback(() => {
    setCart([]);
    setDiscount(0);
    setSelectedBarberId("");
    setSelectedCustomerId("walk_in");
    setPaymentMethod("CASH");
    setActiveAppointmentId(null);
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
      const [
        servicesRes,
        employeesRes,
        productsRes,
        customersRes,
        offersRes,
        categoriesRes,
        settingsRes
      ] = await Promise.all([
        api.get("/services", { params: { limit: 1000 } }),
        api.get("/employees", { params: { limit: 1000 } }),
        api.get("/products", { params: { limit: 1000 } }),
        api.get("/customers", { params: { limit: 1000 } }),
        api.get("/offers/active", { params: { limit: 1000 } }).catch(() => ({ data: [] })),
        api.get("/service-categories").catch(() => ({ data: [] })),
        api.get("/business-settings").catch(() => ({ data: null }))
      ]);

      setServices(adaptList(servicesRes));
      setBarbers(adaptList(employeesRes));
      setProducts(adaptList(productsRes).map(p => ({ ...p, price: p.sell_price ?? p.price ?? 0 })));
      setCustomers(adaptList(customersRes));
      setOffers(adaptList(offersRes));
      setCategories(adaptList(categoriesRes));
      setBusinessSettings(settingsRes?.data || settingsRes);
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
        if (msg.event === "appointment_ready_for_payment" || msg.event === "appointment_status_changed") {
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

  const [lastInvoice, setLastInvoice] = useState(null);
  const [completedCustomerName, setCompletedCustomerName] = useState("");
  const [completedBarberName, setCompletedBarberName] = useState("");

  // Derived
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.price || 0), 0), [cart]);
  const finalTotal = useMemo(() => Math.max(0, subtotal - Number(discount || 0)), [subtotal, discount]);

  const value = {
    // Data
    categories, services, products, offers, barbers, customers, readyAppointments,
    businessSettings, currentShift, setCurrentShift,
    // UI State
    loading, readyAppointmentsLoading, shiftLoading, isSubmitting, setIsSubmitting, setLastInvoice, lastInvoice,
    completedCustomerName, setCompletedCustomerName,
    completedBarberName, setCompletedBarberName,
    itemSearchQuery, setItemSearchQuery,
    customerSearchQuery, setCustomerSearchQuery,
    activeCategory, setActiveCategory,
    categoryTabs, filteredItems, filteredCustomers,
    // Cart State
    cart, setCart,
    selectedBarberId, setSelectedBarberId,
    selectedCustomerId, setSelectedCustomerId,
    discount, setDiscount,
    paymentMethod, setPaymentMethod,
    activeAppointmentId, setActiveAppointmentId,
    isReviewing, setIsReviewing,
    isNewCustomer, setIsNewCustomer,
    newCustomerFirstName, setNewCustomerFirstName,
    newCustomerLastName, setNewCustomerLastName,
    newCustomerPhone, setNewCustomerPhone,
    isSplitPayment, setIsSplitPayment,
    splitCashAmount, setSplitCashAmount,
    splitCardAmount, setSplitCardAmount,
    // Derived
    subtotal, finalTotal,
    // Actions
    fetchReadyAppointments, fetchShift, fetchData,
    addToCart, removeFromCart, resetPOS, updateCartItemBarber
  };

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (!context) throw new Error("usePOS must be used within a POSProvider");
  return context;
};
