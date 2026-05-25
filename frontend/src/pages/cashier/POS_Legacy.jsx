import { useSalon } from '@/context/SalonContext';
import { printThermalReceipt } from "@/utils/receiptPrinter";
import QRCode from 'qrcode';
import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Gift,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  ShoppingCart,
  Wallet,
  WalletCards,
  X,
  Zap,
  Clock,
  User,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api, { baseURL } from "../../services/api";
import { adaptList, normalizeItemResponse } from "../../services/apiAdapter";
import { posShiftService } from "../../services/posShiftService";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { formatCurrency, safePositive } from "../../lib/utils";
import { useSocket } from "../../context/SocketContext";

import ReadyBookingsForPosPanel from "../../components/pos/ReadyBookingsForPosPanel";

const WALK_IN_CUSTOMER = "walk_in";
const WALK_IN_LABEL = "عميل مجهول";

const employeeName = (employee) =>
  employee?.display_name ||
  employee?.displayName ||
  employee?.full_name ||
  employee?.fullName ||
  employee?.name ||
  "خبير بدون اسم";

const customerName = (customer) =>
  `${customer?.first_name || customer?.firstName || ""} ${customer?.last_name || customer?.lastName || ""}`.trim() ||
  customer?.name ||
  customer?.fullName ||
  "عميل مجهول";

const itemPrice = (item) =>
  Number(item?.price ?? item?.sell_price ?? item?.offer_price ?? 0);
const itemName = (item) =>
  item?.name_ar || item?.name || item?.display_name || "عنصر بدون اسم";
const itemId = (item) =>
  item?.id ||
  item?.service_id ||
  item?.serviceId ||
  item?.serviceID ||
  item?.serviceId ||
  item?.serviceId ||
  item?.product_id ||
  item?.offer_id;

const secondPhone = (customer) =>
  customer?.phone2 ||
  customer?.alternate_phone ||
  customer?.secondary_phone ||
  customer?.phone_2 ||
  "";

const serviceCategoryName = (service, categories = []) => {
  if (!service) return "";
  const direct =
    service.category_name || service.categoryName || service.category;
  if (direct && typeof direct === "string") return direct;
  const categoryId =
    service.category_id || service.categoryId || service.service_category_id;
  const category = categories.find(
    (item) => String(item.id) === String(categoryId),
  );
  return category?.name_ar || category?.name || category?.display_name || "";
};

const apiErrorMessage = (error, fallback = "حدث خطأ غير متوقع") => {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.msg) {
          const loc = Array.isArray(item.loc) ? item.loc.join(".") : item.loc;
          return loc ? `${loc}: ${item.msg}` : item.msg;
        }
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .join(" | ");
  }
  if (detail && typeof detail === "object") {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return detail || error?.response?.data?.message || error?.message || fallback;
};

const normalizePaymentMethodForApi = (method) => {
  const map = {
    CASH: "cash",
    CARD: "card",
    VISA: "card",
    MADA: "mada",
    WALLET: "wallet",
    INSTAPAY: "instapay",
  };
  return map[method] || String(method || "cash").toLowerCase();
};

export default function POS() {
  const { settings } = useSalon();

  const socketContext = useSocket?.();
  const socket = socketContext?.socket || null;

  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("الكل");
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [offers, setOffers] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] =
    useState(WALK_IN_CUSTOMER);
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [lastInvoice, setLastInvoice] = useState(null);
  const [completedCustomerName, setCompletedCustomerName] = useState("");
  const [currentShift, setCurrentShift] = useState(null);
  const [businessSettings, setBusinessSettings] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [closingCash, setClosingCash] = useState("0");
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [lastClosedShift, setLastClosedShift] = useState(null);
  const [openingCash, setOpeningCash] = useState("0");
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [readyAppointments, setReadyAppointments] = useState([]);
  const [readyAppointmentsLoading, setReadyAppointmentsLoading] =
    useState(false);
  const [activeAppointmentId, setActiveAppointmentId] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [adjustmentRequest, setAdjustmentRequest] = useState({
    type: "discount",
    reason: "",
    notes: "",
  });

  const [reviewServiceToAdd, setReviewServiceToAdd] = useState("");
  async function fetchReadyAppointments() {
    try {
      setReadyAppointmentsLoading(true);
      const response = await api.get("/appointments/ready-for-payment");
      setReadyAppointments(response.data || []);
    } catch (error) {
      console.error("Fetch ready appointments error:", error);
    } finally {
      setReadyAppointmentsLoading(false);
    }
  }

  async function fetchBusinessSettings() {
    try {
      const response = await api.get("/business-settings");
      setBusinessSettings(response.data || response);
    } catch (error) {
      console.error("Business settings load error:", error);
    }
  }

  async function fetchShift() {
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
  }

  async function fetchData() {
    try {
      setLoading(true);
      const [
        servicesRes,
        employeesRes,
        productsRes,
        customersRes,
        offersRes,
        categoriesRes,
      ] = await Promise.all([
        api.get("/services", { params: { limit: 1000 } }),
        api.get("/employees", { params: { limit: 1000 } }),
        api.get("/products", { params: { limit: 1000 } }),
        api.get("/customers", { params: { limit: 1000 } }),
        api
          .get("/offers/active", { params: { limit: 1000 } })
          .catch(() => ({ data: [] })),
        api.get("/service-categories").catch(() => ({ data: [] })),
      ]);

      setServices(adaptList(servicesRes));
      setBarbers(adaptList(employeesRes));
      setProducts(
        adaptList(productsRes).map((product) => ({
          ...product,
          price: product.sell_price ?? product.price ?? 0,
        })),
      );
      setCustomers(adaptList(customersRes));
      setOffers(adaptList(offersRes));
      setCategories(adaptList(categoriesRes));
    } catch (error) {
      console.error("POS data error:", error);
      toast.error("فشل مزامنة محطة العمل");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    fetchShift();
    fetchBusinessSettings();
    fetchReadyAppointments();
  }, []);

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
  }, [socket]);

  async function handleLoadAppointment(appointment) {
    if (cart.length > 0) {
      toast.error("يرجى إنهاء أو تفريغ السلة الحالية أولاً");
      return;
    }
    try {
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
      setSelectedCustomerId(
        String(
          appointment.customer_id || appointment.customerId || WALK_IN_CUSTOMER,
        ),
      );
      setSelectedBarberId(
        appointmentBarberId ? String(appointmentBarberId) : "",
      );
      const newCart = (appointment.services || []).map((svc) => {
        const serviceId = svc.service_id || svc.serviceId || svc.id;
        return {
          id: serviceId,
          serviceId,
          service_id: serviceId,
          uid: `appointment-${appointmentId}-service-${serviceId || "missing"}-${Math.random()}`,
          name: svc.service_name || svc.serviceName || svc.name || "خدمة",
          price: Number(svc.price ?? svc.unit_price ?? svc.unitPrice ?? 0),
          type: "service",
          barberId: appointmentBarberId ? Number(appointmentBarberId) : null,
          barberName:
            appointment.employee_name ||
            appointment.employeeName ||
            appointment.barber_name ||
            appointment.barberName ||
            (appointmentBarberId ? "الخبير" : "بدون خبير"),
        };
      });
      setCart(newCart);
      setActiveAppointmentId(appointmentId);
      setIsReviewing(true);
      toast.success("تم تحميل بيانات الجلسة للمراجعة");
    } catch (error) {
      console.error("Load appointment error:", error);
      toast.error("فشل تحميل بيانات الجلسة");
    }
  }

  async function handleRequestAdjustment() {
    if (!lastInvoice) return;
    try {
      const invoiceId =
        lastInvoice.invoice_id || lastInvoice.invoiceId || lastInvoice.id;
      await api.post(`/invoices/${invoiceId}/adjustment-requests`, {
        request_type: adjustmentRequest.type,
        reason: adjustmentRequest.reason,
        notes: adjustmentRequest.notes,
        old_values: {
          total_amount: lastInvoice.total_amount,
          payment_method: lastInvoice.payment_method,
          discount_amount: lastInvoice.discount_amount,
        },
      });
      toast.success("تم إرسال طلب التعديل للمدير");
      setShowAdjustmentDialog(false);
      setAdjustmentRequest({ type: "discount", reason: "", notes: "" });
    } catch (error) {
      toast.error(apiErrorMessage(error, "فشل إرسال طلب التعديل"));
    }
  }

  const hasOpenShift = Boolean(
    currentShift &&
    ["open", "opened", "OPEN", "OPENED"].includes(
      String(currentShift.status || "open"),
    ),
  );

  const serviceRows = Array.isArray(services) ? services : [];
  const productRows = Array.isArray(products) ? products : [];
  const offerRows = Array.isArray(offers) ? offers : [];
  const barberRows = Array.isArray(barbers) ? barbers : [];
  const customerRows = Array.isArray(customers) ? customers : [];
  const categoryRows = Array.isArray(categories) ? categories : [];

  const categoryTabs = useMemo(
    () => [
      "الكل",
      "العروض",
      "المنتجات",
      ...categoryRows
        .map((category) => category.name_ar || category.name)
        .filter(Boolean),
    ],
    [categoryRows],
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (activeCategory === "العروض") {
      return offerRows.filter((offer) =>
        itemName(offer).toLowerCase().includes(query),
      );
    }
    return serviceRows.filter((service) => {
      const matchesSearch = itemName(service).toLowerCase().includes(query);
      if (!matchesSearch) return false;
      if (activeCategory === "الكل") return true;
      const selectedCategory = categoryRows.find(
        (category) =>
          category.name === activeCategory ||
          category.name_ar === activeCategory,
      );
      const serviceCategory = serviceCategoryName(service, categoryRows);
      return (
        serviceCategory === activeCategory ||
        String(
          service.category_id ||
            service.categoryId ||
            service.service_category_id ||
            service.category,
        ) === String(selectedCategory?.id || activeCategory)
      );
    });
  }, [
    activeCategory,
    searchQuery,
    serviceRows,
    productRows,
    offerRows,
    categoryRows,
  ]);

  const filteredCustomers = customerRows.filter((customer) =>
    `${customerName(customer)} ${customer.phone || ""} ${secondPhone(customer)}`
      .toLowerCase()
      .includes(customerSearch.toLowerCase()),
  );

  const selectedCustomer = customerRows.find(
    (customer) =>
      String(customer.id || customer.customer_id) ===
      String(selectedCustomerId),
  );

  const paymentMethodLabel =
    {
      CASH: "نقدي",
      CARD: "شبكة",
      VISA: "فيزا",
      WALLET: "محفظة كاش",
      INSTAPAY: "انستا باي",
      MADA: "مدى",
    }[paymentMethod] || "غير محدد";

  const cartCount = cart.length;

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const tax = 0;
  const finalTotal = Math.max(0, subtotal + tax - Number(discount || 0));
  const invalidServiceItemsCount = cart.filter(
    (item) => item.type === "service" && !resolveCartServiceId(item),
  ).length;
  const canIssueInvoice =
    hasOpenShift &&
    Boolean(selectedBarberId) &&
    cart.length > 0 &&
    invalidServiceItemsCount === 0 &&
    isReviewing;
  const posReviewSteps = [
    {
      key: "appointment",
      label: "اختيار الجلسة",
      hint: activeAppointmentId
        ? `حجز #${activeAppointmentId}`
        : "اختر جلسة جاهزة للدفع",
      done: Boolean(activeAppointmentId),
      warning: false,
      icon: Clock,
    },
    {
      key: "barber",
      label: "اختيار الخبير",
      hint: selectedBarberId ? "تم اختيار الخبير" : "مطلوب قبل الإصدار",
      done: Boolean(selectedBarberId),
      warning: !selectedBarberId,
      icon: User,
    },
    {
      key: "items",
      label: "مراجعة البنود",
      hint: cart.length > 0 ? `${cart.length} بنود` : "لا توجد بنود",
      done: cart.length > 0,
      warning: cart.length === 0,
      icon: ShoppingCart,
    },
    {
      key: "services",
      label: "صلاحية الخدمات",
      hint:
        invalidServiceItemsCount === 0
          ? "كل الخدمات صالحة"
          : `${invalidServiceItemsCount} خدمة تحتاج إعادة إضافة`,
      done: cart.length > 0 && invalidServiceItemsCount === 0,
      warning: invalidServiceItemsCount > 0,
      icon: CheckCircle2,
    },
    {
      key: "shift",
      label: "حالة الوردية",
      hint: hasOpenShift ? "وردية مفتوحة" : "افتح وردية أولًا",
      done: hasOpenShift,
      warning: !hasOpenShift,
      icon: Wallet,
    },
    {
      key: "ready",
      label: "جاهز للإصدار",
      hint: canIssueInvoice ? "يمكن إصدار الفاتورة" : "أكمل البيانات المطلوبة",
      done: canIssueInvoice,
      warning: false,
      icon: CheckCircle2,
    },
  ];

  function applySelectedBarberToDraft(value) {
    setSelectedBarberId(value);
    const barber = barberRows.find((row) => String(row.id) === String(value));
    setCart((previous) =>
      previous.map((item) => ({
        ...item,
        barberId: value ? Number(value) : null,
        barberName: barber ? employeeName(barber) : "بدون خبير",
      })),
    );
  }

  function resetPOS() {
    setCart([]);
    setDiscount(0);
    setSelectedBarberId("");
    setSelectedCustomerId(WALK_IN_CUSTOMER);
    setPaymentMethod("CASH");
    setLastInvoice(null);
    toast.success("تم إعادة تعيين محطة الـ POS");
  }

  function addToCart(item, type) {
    if ((type === "service" || type === "offer") && !selectedBarberId) {
      toast.error("يرجى تحديد الخبير المسؤول");
      return;
    }

    const id = itemId(item);
    if (
      cart.some(
        (cartItem) =>
          String(cartItem.id) === String(id) && cartItem.type === type,
      )
    ) {
      toast.error("العنصر موجود بالفعل في السلة");
      return;
    }

    const barber = barberRows.find(
      (row) => String(row.id) === String(selectedBarberId),
    );
    setCart((previous) => [
      ...previous,
      {
        id,
        uid: `${type}-${id}-${Date.now()}-${Math.random()}`,
        name: itemName(item),
        price:
          type === "offer"
            ? Number(item.offer_price ?? item.price ?? 0)
            : itemPrice(item),
        type,
        barberId: barber?.id || null,
        barberName: barber ? employeeName(barber) : "المتجر",
      },
    ]);
    toast.success("تمت الإضافة");
  }

  function removeFromCart(uid) {
    setCart((previous) => previous.filter((item) => item.uid !== uid));
  }

  function resolveCartServiceId(item) {
    const directId =
      item?.serviceId || item?.service_id || item?.serviceID || item?.id;
    if (directId) return directId;
    const itemLabel = String(
      item?.name || item?.service_name || item?.serviceName || "",
    ).trim();
    const matched = serviceRows.find((service) => {
      const names = [
        itemName(service),
        service?.name,
        service?.name_ar,
        service?.display_name,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim());
      return names.includes(itemLabel);
    });
    return matched ? itemId(matched) : null;
  }
  function addReviewServiceToCart() {
    if (!reviewServiceToAdd) return;
    if (!selectedBarberId) {
      toast.error("اختر الخبير المسؤول قبل إضافة الخدمة");
      return;
    }
    const service = serviceRows.find(
      (row) => String(itemId(row)) === String(reviewServiceToAdd),
    );
    if (!service) {
      toast.error("الخدمة غير موجودة أو غير مسجلة");
      return;
    }
    const serviceId = itemId(service);
    if (!serviceId) {
      toast.error("هذه الخدمة لا تحتوي على رقم خدمة صالح");
      return;
    }
    if (
      cart.some(
        (item) =>
          item.type === "service" &&
          String(resolveCartServiceId(item)) === String(serviceId),
      )
    ) {
      toast.error("هذه الخدمة مضافة بالفعل");
      return;
    }
    const barber = barberRows.find(
      (row) => String(row.id) === String(selectedBarberId),
    );
    setCart((previous) => [
      ...previous,
      {
        id: serviceId,
        serviceId,
        service_id: serviceId,
        uid: `review-service-${serviceId}-${Date.now()}-${Math.random()}`,
        name: itemName(service),
        price: itemPrice(service),
        type: "service",
        barberId: selectedBarberId ? Number(selectedBarberId) : null,
        barberName: barber ? employeeName(barber) : "بدون خبير",
      },
    ]);
    setReviewServiceToAdd("");
    toast.success("تمت إضافة الخدمة للمراجعة");
  }

  async function handleOpenShift() {
    try {
      setIsOpeningShift(true);
      const shift = await posShiftService.open({ openingCash });
      setCurrentShift(shift);
      setShowOpenShift(false);
      toast.success("تم فتح الوردية بنجاح");
    } catch (error) {
      console.error("Open shift error:", error);
      toast.error(apiErrorMessage(error, "فشل فتح الوردية"));
    } finally {
      setIsOpeningShift(false);
    }
  }

  async function handleCloseShift() {
    try {
      setIsClosingShift(true);
      const shiftId =
        currentShift?.id || currentShift?.shift_id || currentShift?.shiftId;
      const closed = await posShiftService.close(shiftId, { closingCash });
      setLastClosedShift(
        closed || {
          ...currentShift,
          closing_cash: Number(closingCash),
          status: "closed",
        },
      );
      setCurrentShift(null);
      setShowCloseShift(false);
      setCart([]);
      setLastInvoice(null);
      toast.success("تم إنهاء جلسة الكاشير بنجاح");
    } catch (error) {
      console.error("Close shift error:", error);
      toast.error(apiErrorMessage(error, "فشل إنهاء الوردية"));
    } finally {
      setIsClosingShift(false);
    }
  }
  async function handleCheckout() {
    if (!hasOpenShift) {
      toast.error("يجب فتح وردية عمل أولًا");
      setShowOpenShift(true);
      return;
    }

    if (cart.length === 0) {
      toast.error("السلة فارغة");
      return;
    }

    if (!selectedBarberId) {
      toast.error("اختر الخبير المسؤول قبل إصدار الفاتورة");
      return;
    }

    const invalidServiceItems = cart.filter(
      (item) => item.type === "service" && !resolveCartServiceId(item),
    );

    if (invalidServiceItems.length > 0) {
      toast.error(
        "يوجد بند خدمة بدون رقم خدمة مسجل. احذف البند وأعد إضافته من الخدمات المسجلة.",
      );
      return;
    }

    const checkoutCustomerName = selectedCustomer
      ? customerName(selectedCustomer)
      : WALK_IN_LABEL;

    const checkoutCartSnapshot = cart.map((item) => ({ ...item }));

    const payloadItems = checkoutCartSnapshot.map((item) => ({
      item_type: item.type,
      service_id: item.type === "service" ? resolveCartServiceId(item) : null,
      product_id: item.type === "product" ? item.id : null,
      offer_id: item.type === "offer" ? item.id : null,
      quantity: Number(item.quantity || 1),
      employee_id:
        item.barberId || (selectedBarberId ? Number(selectedBarberId) : null),
      unit_price: Number(item.price || 0),
    }));

    const invalidPayloadItems = payloadItems.filter(
      (item) =>
        (item.item_type === "service" && !item.service_id) ||
        ((item.item_type === "service" || item.item_type === "offer") &&
          !item.employee_id) ||
        Number.isNaN(Number(item.unit_price)),
    );

    if (invalidPayloadItems.length > 0) {
      toast.error(
        "بيانات الفاتورة غير مكتملة. راجع الخدمات والخبير والسعر قبل الإصدار.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        customer_id:
          selectedCustomerId !== WALK_IN_CUSTOMER
            ? Number(selectedCustomerId)
            : null,
        payment_method: normalizePaymentMethodForApi(paymentMethod),
        discount_amount: Number(discount || 0),
        appointment_id: activeAppointmentId || null,
        items: payloadItems,
      };

      const response = await api.post("/invoices/manual", payload);
      const responseData = response.data;
      const invoice = responseData.item || responseData.data || responseData;

      setLastInvoice(invoice);
      setCompletedCustomerName(checkoutCustomerName);
      setCart([]);
      setSelectedCustomerId(WALK_IN_CUSTOMER);
      setDiscount(0);
      setPaymentMethod("CASH");

      fetchReadyAppointments();
      toast.success(`تم إصدار الفاتورة بنجاح للعميل: ${checkoutCustomerName}`);
    } catch (error) {
      console.error("Checkout error:", error?.response?.data || error);
      toast.error(apiErrorMessage(error, "فشل إتمام الدفع"));
    } finally {
      setIsSubmitting(false);
    }
  }
  async function openInvoicePdf(invoice, retried = false) {
    const id = invoice?.invoice_id || invoice?.invoiceId || invoice?.id;
    if (!id) {
      toast.error("لا يمكن تحديد رقم الفاتورة");
      return;
    }

    try {
      const response = await api.get(`/invoices/${id}/pdf`, {
        params: { inline: true },
        responseType: "blob",
      });

      const contentType =
        response?.headers?.["content-type"] || "application/pdf";
      const file = new Blob([response.data], { type: contentType });
      const fileUrl = URL.createObjectURL(file);
      const pdfWindow = window.open(fileUrl, "_blank", "noopener,noreferrer");

      if (!pdfWindow) {
        toast.error(
          "المتصفح منع فتح PDF. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى",
        );
      }

      setTimeout(() => {
        URL.revokeObjectURL(fileUrl);
      }, 60000);
    } catch (error) {
      if (error?.response?.status === 404 && !retried) {
        try {
          toast.loading("ملف PDF غير موجود، جاري إعادة التوليد...", {
            id: `pdf-${id}`,
          });
          await api.post(`/invoices/${id}/regenerate-pdf`);
          toast.success("تم إعادة توليد PDF بنجاح", { id: `pdf-${id}` });
          return openInvoicePdf(invoice, true);
        } catch (regenError) {
          console.error(
            "Regenerate invoice PDF error:",
            regenError?.response?.data || regenError,
          );
          toast.error(apiErrorMessage(regenError, "تعذر إعادة توليد PDF"), {
            id: `pdf-${id}`,
          });
          return;
        }
      }

      console.error("Open invoice PDF error:", error?.response?.data || error);
      toast.error(apiErrorMessage(error, "تعذر فتح ملف الفاتورة PDF"));
    }
  }

  function shopValue(...names) {
    for (const name of names) {
      const value = businessSettings?.[name];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
  }

  function staticAssetUrl(path) {
    if (!path) return "";
    if (String(path).startsWith("http")) return path;
    const root = baseURL.replace("/api/v1", "");
    return `${root}${path}`;
  }

  function escapeReceipt(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function printReceipt(invoice) {
    printThermalReceipt(invoice, settings);
  }

  if (!hasOpenShift && lastClosedShift) {
    const closedSales = Number(
      lastClosedShift.total_sales ??
        lastClosedShift.totalSales ??
        lastClosedShift.sales_total ??
        0,
    );
    const closedInvoices = Number(
      lastClosedShift.invoice_count ??
        lastClosedShift.invoiceCount ??
        lastClosedShift.invoices_count ??
        0,
    );
    const openingValue = Number(
      lastClosedShift.opening_cash ?? lastClosedShift.openingCash ?? 0,
    );
    const closingValue = Number(
      lastClosedShift.closing_cash ?? lastClosedShift.closingCash ?? 0,
    );
    const expectedCash = Number(
      lastClosedShift.expected_cash ??
        lastClosedShift.expectedCash ??
        openingValue + closedSales,
    );
    const difference = closingValue - expectedCash;
    const shiftValue = (...keys) => {
      for (const key of keys) {
        const value = lastClosedShift?.[key] ?? lastClosedShift?.summary?.[key];
        if (value !== undefined && value !== null && value !== "")
          return Number(value) || 0;
      }
      return 0;
    };
    const shiftText = (...keys) => {
      for (const key of keys) {
        const value = lastClosedShift?.[key] ?? lastClosedShift?.summary?.[key];
        if (value !== undefined && value !== null && value !== "")
          return String(value);
      }
      return "";
    };
    const shiftNo =
      shiftText("shift_no", "shiftNo", "id", "shift_id", "shiftId") || "-";
    const shiftOpenedAt =
      shiftText("opened_at", "openedAt", "start_time", "startTime") || "";
    const shiftClosedAt =
      shiftText("closed_at", "closedAt", "end_time", "endTime") || "";
    const cashSales = shiftValue(
      "cash_sales",
      "cashSales",
      "cash_total",
      "cashTotal",
      "sales_cash",
    );
    const cardSales = shiftValue(
      "card_sales",
      "cardSales",
      "card_total",
      "cardTotal",
      "sales_card",
    );
    const visaSales = shiftValue(
      "visa_sales",
      "visaSales",
      "visa_total",
      "visaTotal",
    );
    const madaSales = shiftValue(
      "mada_sales",
      "madaSales",
      "mada_total",
      "madaTotal",
    );
    const walletSales = shiftValue(
      "wallet_sales",
      "walletSales",
      "wallet_total",
      "walletTotal",
    );
    const instapaySales = shiftValue(
      "instapay_sales",
      "instapaySales",
      "instapay_total",
      "instapayTotal",
    );
    const totalDiscounts = shiftValue(
      "discount_total",
      "discountTotal",
      "total_discounts",
      "totalDiscounts",
      "discounts",
    );
    const totalTax = shiftValue(
      "tax_total",
      "taxTotal",
      "total_tax",
      "totalTax",
    );
    const adjustmentCount = shiftValue(
      "adjustment_count",
      "adjustmentCount",
      "adjustments_count",
      "adjustmentsCount",
    );
    const voidedInvoices = shiftValue(
      "voided_invoices",
      "voidedInvoices",
      "cancelled_invoices",
      "cancelledInvoices",
    );
    const netSales =
      shiftValue("net_sales", "netSales", "net_total", "netTotal") ||
      closedSales;
    const paymentBreakdown = [
      { label: "نقدي", value: cashSales },
      { label: "شبكة", value: cardSales },
      { label: "فيزا", value: visaSales },
      { label: "مدى", value: madaSales },
      { label: "محفظة", value: walletSales },
      { label: "انستا باي", value: instapaySales },
    ];
    function printDailyShiftReport() {
      const rowsHtml = paymentBreakdown
        .map(
          (row) =>
            `<tr><td>${row.label}</td><td>${formatCurrency(row.value)}</td></tr>`,
        )
        .join("");
      const reportHtml = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<title>تقرير وردية ${shiftNo}</title>
<style>@page{size:A4;margin:12mm}body{font-family:Tahoma,Arial,sans-serif;color:#111827;direction:rtl}.header{text-align:center;border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:16px}.title{font-size:22px;font-weight:900}.muted{font-size:12px;color:#4b5563;line-height:1.8}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.card{border:1px solid #e5e7eb;border-radius:14px;padding:12px;background:#f9fafb}.label{font-size:11px;color:#6b7280;font-weight:700}.value{font-size:18px;font-weight:900;margin-top:6px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #e5e7eb;padding:10px;text-align:right}th{background:#f3f4f6;font-weight:900}.footer{margin-top:24px;display:flex;justify-content:space-between;font-size:12px}</style>
</head><body><div class="header"><div class="title">تقرير الوردية اليومي</div><div class="muted">رقم الوردية: ${shiftNo}<br/>فتح: ${shiftOpenedAt || "-"} — إغلاق: ${shiftClosedAt || new Date().toLocaleString("ar-EG")}</div></div>
<div class="grid"><div class="card"><div class="label">إجمالي المبيعات</div><div class="value">${formatCurrency(closedSales)}</div></div><div class="card"><div class="label">عدد الفواتير</div><div class="value">${closedInvoices}</div></div><div class="card"><div class="label">الخصومات</div><div class="value">${formatCurrency(totalDiscounts)}</div></div><div class="card"><div class="label">فرق العهدة</div><div class="value">${formatCurrency(difference)}</div></div></div>
<table><thead><tr><th>طريقة الدفع</th><th>الإجمالي</th></tr></thead><tbody>${rowsHtml}</tbody></table>
<table><tbody><tr><th>الرصيد الافتتاحي</th><td>${formatCurrency(openingValue)}</td></tr><tr><th>المتوقع بالخزنة</th><td>${formatCurrency(expectedCash)}</td></tr><tr><th>رصيد الإغلاق</th><td>${formatCurrency(closingValue)}</td></tr><tr><th>طلبات التعديل</th><td>${adjustmentCount}</td></tr>
<tr><th>فواتير ملغاة</th><td>${voidedInvoices}</td></tr><tr><th>صافي المبيعات</th><td>${formatCurrency(netSales)}</td></tr></tbody></table>
<div class="footer"><span>توقيع الكاشير: ____________</span><span>توقيع المدير: ____________</span></div><script>window.onload=function (){window.focus();setTimeout(function (){window.print();},250);};<\/script></body></html>`;
      const printWindow = window.open(
        "",
        "shift-report-print",
        "width=900,height=700",
      );
      if (!printWindow) {
        toast.error("المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة");
        return;
      }
      printWindow.document.open();
      printWindow.document.write(reportHtml);
      printWindow.document.close();
    }

    return (
      <div className="erp-page-container space-y-8 pb-24" dir="rtl">
        <ReadyBookingsForPosPanel />

        <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-purple-50 p-10 dark:border-emerald-400/20 dark:from-emerald-500/10 dark:via-[#171717] dark:to-purple-500/10">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                <CheckCircle2 size={44} />
              </div>
              <div>
                <h1 className="text-4xl font-black text-gray-950 dark:text-gray-50">
                  تم إنهاء جلسة الكاشير
                </h1>
                <p className="mt-2 text-sm font-bold text-gray-500 dark:text-gray-400">
                  ملخص الوردية الأخيرة جاهز للمراجعة والطباعة
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={loading}
                onClick={printDailyShiftReport}
                className="h-12 px-6 font-black"
              >
                طباعة تقرير الوردية اليومي
              </Button>
              <Button
                disabled={loading}
                onClick={() => setShowOpenShift(true)}
                className="h-12 px-8 font-black"
              >
                فتح وردية جديدة
              </Button>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "إجمالي المبيعات", value: formatCurrency(closedSales), icon: Wallet, color: "emerald-600" },
            { label: "عدد الفواتير", value: closedInvoices, icon: CheckCircle2, color: "indigo-600" },
            { label: "الرصيد الافتتاحي", value: formatCurrency(openingValue), icon: DollarSign, color: "slate-900" },
            { label: "رصيد الإغلاق", value: formatCurrency(closingValue), icon: LogOut, color: "slate-900" },
          ].map((tile, i) => (
            <Card key={i} className="p-6 premium-card flex items-center justify-between group hover:shadow-xl transition-all border-none bg-white dark:bg-white/5 shadow-soft rounded-[2rem]">
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{tile.label}</p>
                <p className={`mt-2 text-3xl font-black text-${tile.color}`}>{tile.value}</p>
              </div>
              <div className={`h-14 w-14 rounded-2xl bg-${tile.color.split('-')[0]}/10 flex items-center justify-center text-${tile.color} group-hover:scale-110 transition-transform`}>
                <tile.icon size={28} />
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-8 rounded-[2.5rem] border-none shadow-soft">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-gray-950 dark:text-gray-50">
                تفصيل طرق الدفع
              </h2>
              <p className="mt-1 text-sm font-bold text-gray-500">
                ملخص يومي حسب وسيلة التحصيل في الوردية المغلقة
              </p>
            </div>
            <Badge className="rounded-full px-4 py-1 bg-indigo-50 text-indigo-600 border-none font-black uppercase tracking-widest text-[10px]">تقرير يومي</Badge>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-6">
            {paymentBreakdown.map((row) => (
              <div
                key={row.label}
                className="rounded-[1.75rem] border border-black/5 bg-gray-50/50 p-6 dark:border-white/10 dark:bg-white/5 group hover:border-primary/30 transition-all hover:shadow-lg"
              >
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  {row.label}
                </div>
                <div className="text-xl font-black text-gray-950 dark:text-gray-50 tabular-nums">
                  {formatCurrency(row.value)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-8 rounded-[2.5rem] border-none shadow-soft">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-[1.75rem] bg-gray-50 p-6 dark:bg-white/5 border border-transparent hover:border-indigo-100 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={16} className="text-indigo-600" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">المتوقع بالخزنة</span>
              </div>
              <div className="text-3xl font-black text-indigo-600">
                {formatCurrency(expectedCash)}
              </div>
            </div>
            
            <div className={cn(
              "rounded-[1.75rem] p-6 border-2 transition-all",
              difference === 0 
                ? "bg-emerald-50/30 border-emerald-100 text-emerald-600" 
                : "bg-red-50/30 border-red-100 text-red-600"
            )}>
              <div className="flex items-center gap-2 mb-2">
                {difference === 0 ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span className="text-[10px] font-black uppercase tracking-widest">فرق العهدة</span>
              </div>
              <div className="text-3xl font-black tabular-nums">
                {formatCurrency(difference)}
              </div>
            </div>

            <div className="rounded-[1.75rem] bg-gray-50 p-6 dark:bg-white/5 flex flex-col justify-center">
              <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">حالة الوردية</div>
              <div>
                <Badge className="rounded-full px-6 py-2 bg-emerald-500 text-white border-none font-black shadow-lg shadow-emerald-500/20">
                  مغلقة ومؤرشفة بنجاح
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        <Dialog open={showCloseShift} onOpenChange={setShowCloseShift}>
          <DialogContent className="max-w-md rounded-3xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-2xl">إنهاء جلسة الكاشير</DialogTitle>
              <DialogDescription>
                أدخل رصيد النقدية الفعلي في الدرج لإغلاق الوردية وعرض الملخص.
              </DialogDescription>
            </DialogHeader>
            <label className="space-y-3">
              <span className="text-sm font-black text-gray-700 dark:text-gray-200">
                رصيد الإغلاق الفعلي
              </span>
              <Input
                type="number"
                value={closingCash || ""}
                onChange={(event) => setClosingCash(event.target.value)}
                placeholder="0.00"
                className="h-12 text-base"
              />
            </label>
            <DialogFooter>
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => setShowCloseShift(false)}
                className="h-11"
              >
                إلغاء
              </Button>
              <Button
                variant="danger"
                loading={isClosingShift}
                disabled={loading}
                onClick={handleCloseShift}
                className="h-11"
              >
                إنهاء الوردية
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showOpenShift} onOpenChange={setShowOpenShift}>
          <DialogContent className="max-w-md rounded-3xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                فتح وردية عمل جديدة
              </DialogTitle>
              <DialogDescription>
                أدخل الرصيد الافتتاحي لبدء جلسة كاشير جديدة.
              </DialogDescription>
            </DialogHeader>
            <Input
              type="number"
              value={openingCash || ""}
              onChange={(event) => setOpeningCash(event.target.value)}
              placeholder="0.00"
            />
            <DialogFooter>
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => setShowOpenShift(false)}
              >
                إلغاء
              </Button>
              <Button
                loading={isOpeningShift}
                disabled={loading}
                onClick={handleOpenShift}
              >
                فتح الوردية
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-[#6D28D9] dark:text-[#22D3EE]">
          <Zap className="h-10 w-10 animate-pulse" />
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            تنشيط محطة الـ POS...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="erp-page-container flex flex-col gap-6 pb-24 lg:min-h-[calc(100vh-150px)] lg:flex-row"
      dir="rtl"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <Card className="bg-linear-to-r from-white via-purple-50/50 to-blue-50 p-7 shadow-md dark:from-[#171717] dark:via-purple-500/10 dark:to-blue-500/5 border border-purple-100 dark:border-white/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-950 dark:text-gray-50">
                كاشير احترافي ومراجعة الحجوزات
              </h1>
              <p className="text-sm font-bold text-gray-500">
                اختر جلسة جاهزة للدفع، راجع الخدمات والخبير، ثم أصدر الفاتورة
                الرسمية بثقة
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={fetchReadyAppointments}
                disabled={readyAppointmentsLoading || loading}
                className="h-12 rounded-2xl px-4 text-xs font-black"
                title="تحديث الجلسات الجاهزة"
              >
                <RefreshCw
                  size={16}
                  className={
                    readyAppointmentsLoading ? "ml-2 animate-spin" : "ml-2"
                  }
                />
                تحديث الجلسات
              </Button>
              {hasOpenShift ? (
                <>
                  <Badge
                    variant="success"
                    className="h-12 rounded-2xl px-4 font-black"
                  >
                    وردية مفتوحة
                  </Badge>
                  <Button
                    type="button"
                    disabled={loading}
                    onClick={() => setShowCloseShift(true)}
                    className="h-12 rounded-2xl bg-red-600 px-5 text-xs font-black text-white hover:bg-red-700"
                    title="إنهاء جلسة الكاشير"
                  >
                    إنهاء الوردية
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="warning"
                  disabled={loading}
                  onClick={() => setShowOpenShift(true)}
                  className="h-12 rounded-2xl px-5 text-xs font-black"
                  title="فتح وردية عمل"
                >
                  <Zap size={16} className="ml-2" />
                  فتح وردية
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* POS UX Phase 2: quick operation summary */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-3xl border border-purple-100 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-gray-500">
                  جلسات جاهزة
                </p>
                <p className="mt-1 text-2xl font-black text-[#6D28D9] dark:text-[#22D3EE]">
                  {readyAppointments.length}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-[#6D28D9] dark:bg-cyan-400/10 dark:text-[#22D3EE]">
                <Clock size={20} />
              </div>
            </div>
          </Card>
          <Card className="rounded-3xl border border-blue-100 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-gray-500">
                  بنود المسودة
                </p>
                <p className="mt-1 text-2xl font-black text-blue-600">
                  {cart.length}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10">
                <ShoppingCart size={20} />
              </div>
            </div>
          </Card>
          <Card className="rounded-3xl border border-emerald-100 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-gray-500">
                  حالة الخبير
                </p>
                <p
                  className={`mt-1 text-sm font-black ${selectedBarberId ? "text-emerald-600" : "text-red-600"}`}
                >
                  {selectedBarberId ? "تم الاختيار" : "مطلوب"}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                <User size={20} />
              </div>
            </div>
          </Card>
          <Card className="rounded-3xl border border-amber-100 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-gray-500">
                  الصافي الحالي
                </p>
                <p className="mt-1 text-xl font-black text-amber-600">
                  {formatCurrency(finalTotal)}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10">
                <Wallet size={20} />
              </div>
            </div>
          </Card>
        </div>

        {readyAppointments.length === 0 && !isReviewing && !lastInvoice && (
          <Card className="rounded-3xl border border-dashed border-gray-200 bg-white/70 p-10 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-50 text-gray-400 dark:bg-white/10">
              <ShoppingBag size={34} />
            </div>
            <h2 className="mt-4 text-xl font-black text-gray-800 dark:text-gray-100">
              لا توجد جلسات جاهزة للدفع الآن
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-7 text-gray-500">
              عند إنهاء الخدمة من شاشة الحجوزات ستظهر الجلسة هنا تلقائيًا. يمكنك
              الضغط على تحديث للتأكد من آخر حالة.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={fetchReadyAppointments}
              disabled={readyAppointmentsLoading || loading}
              className="mt-5 h-12 rounded-2xl px-6 font-black"
            >
              <RefreshCw
                size={18}
                className={
                  readyAppointmentsLoading ? "ml-2 animate-spin" : "ml-2"
                }
              />
              تحديث الجلسات
            </Button>
          </Card>
        )}

        {readyAppointments.length > 0 && (
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-gray-950 dark:text-gray-50">
              <Clock className="h-5 w-5 text-[#6D28D9] dark:text-[#22D3EE]" />
              جلسات جاهزة للدفع
              <Badge variant="secondary" className="mr-2">
                {readyAppointments.length}
              </Badge>
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
              {readyAppointments.map((appt) => {
                const appointmentId =
                  appt.appointment_id || appt.appointmentId || appt.id;
                const isActiveAppointment =
                  String(activeAppointmentId || "") ===
                  String(appointmentId || "");
                return (
                  <Card
                    key={appointmentId || appt.id}
                    className={`min-w-80 flex-shrink-0 rounded-3xl border-2 border-dashed p-5 shadow-sm transition hover:shadow-md ${
                      isActiveAppointment
                        ? "border-[#6D28D9] bg-purple-50/50"
                        : "border-purple-200 bg-white/50 hover:border-[#6D28D9]"
                    } dark:border-white/10 dark:bg-white/5`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-gray-950 dark:text-gray-50">
                          {appt.customer_name ||
                            appt.customerName ||
                            WALK_IN_LABEL}
                        </p>
                        <p className="text-xs font-bold text-gray-500">
                          {appt.appointment_time ||
                            appt.appointmentTime ||
                            "--:--"}{" "}
                          •{" "}
                          {appt.employee_name ||
                            appt.employeeName ||
                            appt.barber_name ||
                            appt.barberName ||
                            "بدون خبير"}
                        </p>
                      </div>
                      <Badge
                        variant={
                          isActiveAppointment ? "success" : "successSoft"
                        }
                        className="text-[10px]"
                      >
                        {isActiveAppointment ? "قيد المراجعة" : "جاهز"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(appt.services || []).map((service, index) => (
                        <span
                          key={`${appointmentId || appt.id}-service-${index}`}
                          className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600 dark:bg-white/10 dark:text-gray-400"
                        >
                          {service.service_name ||
                            service.serviceName ||
                            service.name ||
                            "خدمة"}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-lg font-black text-[#6D28D9] dark:text-[#22D3EE]">
                        {formatCurrency(
                          appt.total_amount || appt.totalAmount || 0,
                        )}
                      </span>
                      <Button
                        size="sm"
                        className="h-9 px-4 font-black"
                        onClick={() => handleLoadAppointment(appt)}
                        disabled={loading || isActiveAppointment}
                      >
                        {isActiveAppointment ? "محمل حالياً" : "تحصيل الآن"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {!isReviewing ? (
            <div className="flex h-full flex-col items-center justify-center py-20 text-center opacity-60">
              <ShoppingBag size={80} className="mb-6 text-gray-300" />
              <h3 className="text-2xl font-black text-gray-400">
                اختر جلسة جاهزة للدفع أولاً
              </h3>
              <p className="mt-2 max-w-sm text-gray-400">
                تحويل الحجوزات إلى الكاشير يتم تلقائياً عند إتمام الخدمة من صفحة
                الحجوزات.
              </p>
            </div>
          ) : (
            <div className="h-full space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-gray-950 dark:text-gray-50">
                  مراجعة الفاتورة قبل الإصدار
                </h2>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsReviewing(false);
                    setActiveAppointmentId(null);
                    setCart([]);
                  }}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  إلغاء المراجعة والعودة
                </Button>
              </div>

              {/* POS UX Phase 2: dynamic review progress */}
              <Card className="rounded-3xl border border-purple-100 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-gray-950 dark:text-gray-50">
                      متابعة جاهزية الفاتورة
                    </h3>
                    <p className="mt-1 text-[11px] font-bold text-gray-500">
                      الخطوات تتحدث تلقائيًا حسب حالة الجلسة والخبير والبنود
                      والوردية.
                    </p>
                  </div>
                  <Badge variant={canIssueInvoice ? "success" : "warning"}>
                    {canIssueInvoice ? "جاهز" : "قيد الاستكمال"}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {posReviewSteps.map((step) => {
                    const Icon = step.icon;
                    return (
                      <div
                        key={step.key}
                        className={`rounded-2xl border p-4 transition ${
                          step.done
                            ? "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : step.warning
                              ? "border-red-100 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                              : "border-gray-100 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon size={17} />
                          <span className="text-xs font-black">
                            {step.label}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] font-bold leading-5 opacity-80">
                          {step.hint}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card className="space-y-4 p-6">
                  <div className="flex items-center gap-3 border-b pb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <ShoppingBag size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500">العميل</p>
                      <p className="font-black text-gray-950">
                        {selectedCustomer
                          ? customerName(selectedCustomer)
                          : WALK_IN_LABEL}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                      <Activity size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500">
                        رقم الحجز
                      </p>
                      <p className="font-black">#{activeAppointmentId}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500">
                          الخبير المسؤول
                        </p>
                        <p className="text-[10px] font-black text-amber-600">
                          يجب تحديد الموظف الذي قام بالخدمة
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {barberRows.map((barber) => {
                        const isSelected =
                          String(barber.id) === String(selectedBarberId);
                        return (
                          <button
                            key={barber.id}
                            type="button"
                            onClick={() =>
                              applySelectedBarberToDraft(String(barber.id))
                            }
                            className={`flex items-center gap-2 rounded-2xl border-2 p-2 text-right transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5 ring-2 ring-primary/10"
                                : "border-gray-100 bg-white hover:border-primary/30 dark:border-white/5 dark:bg-white/5"
                            }`}
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                                isSelected
                                  ? "bg-primary text-white"
                                  : "bg-gray-100 text-gray-500 dark:bg-white/10"
                              }`}
                            >
                              {employeeName(barber).charAt(0)}
                            </div>
                            <span
                              className={`truncate text-[11px] font-black ${
                                isSelected
                                  ? "text-primary"
                                  : "text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {employeeName(barber)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {!selectedBarberId && (
                      <div className="flex animate-pulse items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-red-600 dark:border-red-500/20 dark:bg-red-500/10">
                        <AlertTriangle size={14} />
                        <span className="text-[10px] font-black">
                          يرجى اختيار الخبير لمتابعة الدفع
                        </span>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="space-y-4 p-6">
                  <h3 className="border-b pb-2 font-black text-gray-950">
                    طريقة الدفع والخصم
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "CASH", label: "نقدي", icon: Wallet },
                      { id: "CARD", label: "شبكة", icon: WalletCards },
                      { id: "INSTAPAY", label: "انستا باي", icon: Zap },
                      { id: "VISA", label: "فيزا", icon: CreditCard },
                    ].map((method) => {
                      const Icon = method.icon;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id)}
                          disabled={loading}
                          className={`flex items-center gap-2 rounded-xl border-2 p-3 text-xs font-black transition ${
                            paymentMethod === method.id
                              ? "border-[#6D28D9] bg-purple-50 text-[#6D28D9]"
                              : "border-gray-100 bg-white"
                          }`}
                        >
                          <Icon size={16} /> {method.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="pt-2">
                    <label className="mb-2 block text-xs font-black text-gray-500">
                      الخصم (ج.م)
                    </label>
                    <Input
                      type="number"
                      value={discount || ""}
                      onChange={(event) =>
                        setDiscount(safePositive(event.target.value))
                      }
                      className="h-11"
                    />
                  </div>
                </Card>
              </div>

              <Card className="space-y-4 rounded-3xl border-2 border-dashed border-purple-100 bg-purple-50/30 p-6 shadow-sm dark:border-purple-500/20 dark:bg-purple-500/5">
                <div className="flex items-center justify-between gap-3 border-b pb-3">
                  <div>
                    <h3 className="font-black text-gray-950 dark:text-gray-50">
                      تعديل خدمات الحجز قبل إصدار الفاتورة
                    </h3>
                    <p className="mt-1 text-xs font-bold text-gray-500">
                      يمكن إضافة خدمة مسجلة فقط أو حذف خدمة من بنود الفاتورة قبل
                      الإصدار.
                    </p>
                  </div>
                  <Badge variant="accent">قبل الإصدار</Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                  <Select
                    value={reviewServiceToAdd || ""}
                    onValueChange={setReviewServiceToAdd}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="اختر خدمة لإضافتها" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceRows.map((service) => (
                        <SelectItem
                          key={itemId(service)}
                          value={String(itemId(service)) || ""}
                        >
                          {service.category_name ||
                          service.categoryName ||
                          service.category
                            ? `${service.category_name || service.categoryName || service.category} - ${itemName(service)}`
                            : itemName(service)}{" "}
                          - {formatCurrency(itemPrice(service))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    disabled={loading}
                    onClick={addReviewServiceToCart}
                    className="h-12 px-6"
                  >
                    <Plus size={18} /> إضافة
                  </Button>
                </div>
                <p className="rounded-2xl bg-amber-50 p-3 text-[11px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  بعد إصدار الفاتورة لن يمكن تعديل الخدمات إلا بطلب اعتماد من
                  الإدارة.
                </p>
              </Card>

              <Card className="overflow-hidden rounded-3xl border border-black/5 shadow-sm dark:border-white/10">
                <div className="flex items-center justify-between border-b bg-gray-50 p-5 dark:bg-white/5">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="text-primary" size={20} />
                    <h3 className="font-black text-gray-900 dark:text-white">
                      بنود الفاتورة
                    </h3>
                  </div>
                  <Badge variant="accent" className="rounded-full px-3">
                    {cart.length} بنود
                  </Badge>
                </div>
                <div className="custom-scrollbar max-h-80 space-y-3 overflow-y-auto bg-white p-4 dark:bg-[#171717]">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                      <Package className="mx-auto mb-2 opacity-20" size={40} />
                      <p className="text-xs font-bold">السلة فارغة حالياً</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.uid}
                        className="group flex items-center justify-between rounded-[1.5rem] border border-transparent bg-gray-50 p-4 transition-all hover:border-primary/20 dark:bg-white/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-primary shadow-sm dark:bg-white/10">
                            {item.type === "service" ? (
                              <Zap size={18} />
                            ) : (
                              <Package size={18} />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900 dark:text-white">
                              {item.name}
                            </p>
                            <span className="text-[10px] font-bold uppercase text-gray-500">
                              {item.barberName}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-black text-primary">
                            {formatCurrency(item.price)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromCart(item.uid)}
                            disabled={loading}
                            className="h-9 w-9 rounded-xl text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <X size={18} />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
        {/* LEFT_COLUMN_CLOSE_FIXED */}
      </div>
      <aside className="flex w-full flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-lg dark:border-white/10 dark:bg-[#171717] lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:w-120">
        {lastInvoice ? (
          <div className="flex flex-1 flex-col items-center justify-center space-y-7 p-8 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 size={52} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-950 dark:text-gray-50">
                تم الإصدار بنجاح
              </h2>
              <p className="mt-2 text-xs font-black uppercase tracking-widest text-gray-500">
                كود الفاتورة:{" "}
                {lastInvoice.invoice_no ||
                  lastInvoice.invoiceNo ||
                  lastInvoice.id}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 text-right md:grid-cols-2 w-full">
              <div className="flex flex-col justify-between rounded-3xl border border-black/5 bg-linear-to-br from-purple-50 to-purple-50 p-7 text-right shadow-sm transition hover:shadow-md dark:border-white/10 dark:from-purple-500/10 dark:to-purple-500/5">
                <div className="flex items-center justify-between">
                  <Wallet
                    size={24}
                    className="text-[#6D28D9] dark:text-[#22D3EE]"
                  />
                  <p className="text-xs uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                    الصافي
                  </p>
                </div>
                <p className="mt-4 text-3xl font-black text-[#6D28D9] dark:text-[#22D3EE]">
                  {formatCurrency(
                    lastInvoice.total_amount || lastInvoice.totalAmount || 0,
                  )}
                </p>
              </div>
              <div className="flex flex-col justify-between rounded-3xl border border-black/5 bg-linear-to-br from-green-50 to-green-50 p-7 text-right shadow-sm transition hover:shadow-md dark:border-white/10 dark:from-green-500/10 dark:to-green-500/5">
                <div className="flex items-center justify-between">
                  <CreditCard
                    size={24}
                    className="text-green-600 dark:text-green-300"
                  />
                  <p className="text-xs uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                    الدفع
                  </p>
                </div>
                <p className="mt-4 text-xl font-black leading-tight text-gray-950 dark:text-gray-50">
                  {lastInvoice.payment_method === "cash" ||
                  lastInvoice.payment_method === "CASH"
                    ? "نقدي"
                    : lastInvoice.payment_method === "card" ||
                        lastInvoice.payment_method === "CARD"
                      ? "شبكة"
                      : lastInvoice.payment_method || "غير محدد"}
                </p>
              </div>
            </div>
            <div className="w-full space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 font-black text-base"
                disabled={loading}
                onClick={() => printReceipt(lastInvoice)}
              >
                <RefreshCw size={20} className="ml-2" /> طباعة إيصال
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 font-black text-base"
                disabled={loading}
                onClick={() => openInvoicePdf(lastInvoice)}
              >
                <ShoppingBag size={20} className="ml-2" /> فتح PDF
              </Button>
              <Button
                variant="secondary"
                className="w-full h-12 font-black text-base border-2 border-dashed border-red-200 text-red-600"
                disabled={loading}
                onClick={() => setShowAdjustmentDialog(true)}
              >
                📝 طلب تعديل الفاتورة
              </Button>
              <Button
                className="h-14 w-full font-black text-base"
                onClick={() => {
                  setLastInvoice(null);
                  setIsReviewing(false);
                  setActiveAppointmentId(null);
                  setCart([]);
                  fetchReadyAppointments();
                }}
              >
                ✨ إنهاء والعودة
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-6 border-b border-black/5 bg-gray-50 p-7 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-950 dark:text-gray-50">
                  تفاصيل الإصدار
                </h2>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-purple-50 to-purple-100 text-[#6D28D9] shadow-sm dark:from-cyan-400/20 dark:to-cyan-400/10 dark:text-[#22D3EE]">
                  <ShoppingCart size={28} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-500">إجمالي البنود</span>
                  <span className="font-black">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-red-500">
                  <span className="font-bold">قيمة الخصم</span>
                  <span className="font-black">
                    -{formatCurrency(discount)}
                  </span>
                </div>
                <div className="pt-4 border-t border-dashed">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-black text-gray-950 dark:text-gray-50">
                      الصافي المطلوب
                    </span>
                    <span className="text-4xl font-black text-[#6D28D9] dark:text-[#22D3EE]">
                      {formatCurrency(finalTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-7 space-y-6">
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-2">
                <p className="text-xs font-black text-blue-600 flex items-center gap-2">
                  <AlertTriangle size={14} /> تنبيه المراجعة
                </p>
                <p className="text-[11px] font-bold text-blue-800 leading-relaxed">
                  يرجى التأكد من البنود والأسعار وطريقة الدفع قبل الضغط على
                  إصدار. بعد الإصدار لا يمكن التعديل إلا بطلب اعتماد من الإدارة.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  className="h-16 w-full text-lg font-black"
                  onClick={handleCheckout}
                  loading={isSubmitting}
                  disabled={
                    loading ||
                    cart.length === 0 ||
                    !hasOpenShift ||
                    !isReviewing ||
                    !selectedBarberId
                  }
                >
                  ✓ إصدار الفاتورة الرسمية
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-gray-500 font-bold"
                  onClick={resetPOS}
                  disabled={loading || !isReviewing}
                >
                  إلغاء المسودة الحالية
                </Button>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* Adjustment Request Dialog */}
      <Dialog
        open={showAdjustmentDialog}
        onOpenChange={setShowAdjustmentDialog}
      >
        <DialogContent className="max-w-md rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">
              طلب تعديل فاتورة
            </DialogTitle>
            <DialogDescription>
              سيتم إرسال هذا الطلب للمدير أو المالك لاعتماده. يرجى توضيح سبب
              التعديل بدقة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-black">نوع التعديل</label>
              <Select
                value={adjustmentRequest.type || ""}
                onValueChange={(val) =>
                  setAdjustmentRequest((prev) => ({ ...prev, type: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع التعديل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount">تعديل خصم</SelectItem>
                  <SelectItem value="payment_method">
                    تعديل طريقة دفع
                  </SelectItem>
                  <SelectItem value="item">تعديل/حذف بند</SelectItem>
                  <SelectItem value="price">تعديل سعر</SelectItem>
                  <SelectItem value="void">إلغاء الفاتورة بالكامل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black">السبب</label>
              <Input
                placeholder="مثلاً: خطأ في إدخال الخصم"
                value={adjustmentRequest.reason || ""}
                onChange={(e) =>
                  setAdjustmentRequest((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black">ملاحظات إضافية</label>
              <textarea
                className="w-full min-h-24 rounded-2xl border bg-gray-50 p-4 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                placeholder="اشرح التفاصيل المطلوبة هنا..."
                value={adjustmentRequest.notes || ""}
                onChange={(e) =>
                  setAdjustmentRequest((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setShowAdjustmentDialog(false)}
            >
              إلغاء
            </Button>
            <Button disabled={loading} onClick={handleRequestAdjustment}>
              إرسال طلب الاعتماد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCloseShift} onOpenChange={setShowCloseShift}>
        <DialogContent className="max-w-md rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl">إنهاء جلسة الكاشير</DialogTitle>
            <DialogDescription>
              أدخل رصيد النقدية الفعلي في الدرج لإغلاق الوردية وعرض ملخص الجلسة.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-3">
            <span className="text-sm font-black text-gray-700 dark:text-gray-200">
              رصيد الإغلاق الفعلي
            </span>
            <Input
              type="number"
              value={closingCash || ""}
              onChange={(event) => setClosingCash(event.target.value)}
              placeholder="0.00"
              className="h-12 text-base"
            />
          </label>
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setShowCloseShift(false)}
              className="h-11"
            >
              إلغاء
            </Button>
            <Button
              loading={isClosingShift}
              disabled={loading}
              onClick={handleCloseShift}
              className="h-11 bg-red-600 text-white hover:bg-red-700"
            >
              إنهاء الوردية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOpenShift} onOpenChange={setShowOpenShift}>
        <DialogContent className="max-w-md rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl">فتح وردية عمل جديدة</DialogTitle>
            <DialogDescription className="text-base">
              يرجى إدخال الرصيد الافتتاحي لبدء استقبال العمليات المالية.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-3">
            <span className="text-sm font-black text-gray-700 dark:text-gray-200">
              💰 الرصيد الافتتاحي (ج.م)
            </span>
            <Input
              type="number"
              value={openingCash || ""}
              onChange={(event) => setOpeningCash(event.target.value)}
              placeholder="0.00"
              className="h-12 text-base"
            />
          </label>
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setShowOpenShift(false)}
              className="h-11"
            >
              إلغاء
            </Button>
            <Button
              loading={isOpeningShift}
              disabled={loading}
              onClick={handleOpenShift}
              className="h-11"
            >
              ✨ بدء الوردية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
