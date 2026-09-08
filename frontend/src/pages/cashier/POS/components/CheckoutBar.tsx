import React from "react";
import { usePOS } from "@/pages/cashier/POS/POSContext";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Trash2,
  CreditCard,
  Zap,
  User,
  ShoppingBag,
  DollarSign,
  Activity,
  RefreshCw,
  Star,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/core/utils";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import confetti from "canvas-confetti";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const triggerSuccessEffect = () => {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#6366f1", "#38bdf8", "#10b981"],
  });
};

const CheckoutBar = () => {
  const {
    cart,
    setCart,
    discount,
    setDiscount,
    paymentMethod,
    setPaymentMethod,
    selectedBarberId,
    setSelectedBarberId,
    selectedCustomerId,
    activeAppointmentId,
    isSubmitting,
    setIsSubmitting,
    currentShift,
    fetchReadyAppointments,
    setLastInvoice,
    setCompletedCustomerName,
    setCompletedBarberName,
    customers,
    barbers,
    subtotal,
    finalTotal,
    loyaltyDiscount,
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
    updateCartItemBarber,
    assignBarberToAll,
    activeInvoiceId,
  } = usePOS();

  const playSuccessSound = () => {
    const audio = new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
    );
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  const playErrorSound = () => {
    const audio = new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    );
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  // Keyboard Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        handleCheckout();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
     
  }, [
    cart,
    finalTotal,
    isSplitPayment,
    splitCashAmount,
    splitCardAmount,
    paymentMethod,
  ]);

  const isEditMode = Boolean(activeInvoiceId);

  const hasOpenShift = Boolean(
    currentShift &&
    ["open", "opened", "OPEN", "OPENED"].includes(
      String(currentShift.status || "open"),
    ),
  );

  const isReady = hasOpenShift && cart.length > 0;

  const handleCheckout = async () => {
    if (!isReady) {
      playErrorSound();
      toast.error("يرجى استكمال متطلبات الفاتورة");
      return;
    }

    if (isSplitPayment) {
      const totalPaid =
        Number(splitCashAmount || 0) + Number(splitCardAmount || 0);
      if (Math.abs(totalPaid - finalTotal) > 0.01) {
        playErrorSound();
        toast.error(
          `المجموع المقسم (${totalPaid}) لا يساوي إجمالي الفاتورة (${finalTotal})`,
        );
        return;
      }
    }

    // Ensure all items have a barber assigned
    const missingBarber = cart.find(
      (item) => item.type !== "product" && !item.barberId,
    );
    if (missingBarber) {
      playErrorSound();
      toast.error(`يرجى تحديد خبير للبند: ${missingBarber.name}`);
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        customer_id: isNewCustomer
          ? null
          : selectedCustomerId === "walk_in"
            ? null
            : Number(selectedCustomerId),
        customer_first_name: isNewCustomer ? newCustomerFirstName : null,
        customer_phone: isNewCustomer ? newCustomerPhone : null,
        payment_method: isSplitPayment ? "split" : paymentMethod.toLowerCase(),
        split_payments: isSplitPayment
          ? [
              { payment_method: "cash", amount: Number(splitCashAmount) },
              { payment_method: "card", amount: Number(splitCardAmount) },
            ]
          : null,
        discount_amount: Number(discount || 0),
        appointment_id: activeAppointmentId || null,
        items: cart.map((item) => ({
          item_type: item.type,
          service_id: item.type === "service" ? item.id : null,
          product_id: item.type === "product" ? item.id : null,
          offer_id: item.type === "offer" ? item.id : null,
          quantity: 1,
          employee_id:
            item.type === "product"
              ? null
              : Number(item.barberId || selectedBarberId),
          unit_price: Number(item.price),
        })),
      };

      const response = await api.post("/invoices/manual", payload);
      const invoiceData =
        response.data?.item || response.data?.data || response.data;

      let checkoutCustomerName = "عميل";
      if (isNewCustomer) {
        checkoutCustomerName = newCustomerFirstName;
      } else if (selectedCustomerId === "walk_in") {
        checkoutCustomerName = "عميل مجهول";
      } else {
        checkoutCustomerName =
          customers.find((c) => String(c.id) === String(selectedCustomerId))
            ?.name || "عميل";
      }

      // Barber name for display in SuccessOverlay (use the first item's barber or default)
      const checkoutBarberName = cart[0]?.barberName || "الخبير";

      setLastInvoice(invoiceData);
      setCompletedCustomerName(checkoutCustomerName);
      setCompletedBarberName(checkoutBarberName);
      playSuccessSound();
      triggerSuccessEffect();
      toast.success("تم إصدار الفاتورة بنجاح");

      // Reset local new customer state
      setIsNewCustomer(false);
      setNewCustomerFirstName("");
      setNewCustomerPhone("");
      setIsSplitPayment(false);
      setSplitCashAmount(0);
      setSplitCardAmount(0);

      setCart([]);
      setDiscount(0);
      fetchReadyAppointments();
    } catch (error) {
      console.error("Checkout error:", error);
      playErrorSound();
      toast.error("فشل إصدار الفاتورة");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeFromCart = (uid) => {
    setCart((prev) => prev.filter((item) => item.uid !== uid));
  };

  // Smart Split Logic
  const handleCashChange = (val: any) => {
    const cash = Number(val || 0);
     
    setSplitCashAmount(val as any);
    const remaining = Math.max(0, finalTotal - cash);
     
    setSplitCardAmount(remaining.toFixed(2) as any);
  };

  const handleCardChange = (val: any) => {
    const card = Number(val || 0);
     
    setSplitCardAmount(val as any);
    const remaining = Math.max(0, finalTotal - card);
     
    setSplitCashAmount(remaining.toFixed(2) as any);
  };

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      {/* Global Default Barber Selection */}
      <Card className="p-3 space-y-2 bg-card border-border/50 shadow-sm shrink-0">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-black uppercase text-muted flex items-center gap-1">
            <Zap size={12} /> الخبير الافتراضي
          </label>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 px-3 text-[10px] font-black uppercase hover:bg-primary/10 hover:text-primary transition-all touch-target"
            onClick={() => assignBarberToAll(selectedBarberId)}
            disabled={!selectedBarberId || cart.length === 0}
          >
            تعيين للكل
          </Button>
        </div>
        <Select value={selectedBarberId} onValueChange={setSelectedBarberId}>
          <SelectTrigger
            className="h-12 rounded-xl bg-soft/50 border-none font-bold text-xs touch-target"
            aria-label="اختر خبير للخدمات الجديدة"
          >
            <SelectValue placeholder="اختر خبير للخدمات الجديدة" />
          </SelectTrigger>
          <SelectContent>
            {barbers.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.display_name || b.displayName || b.full_name || b.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Cart Items */}
      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
        <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between bg-soft/30">
          <h3 className="text-xs font-black flex items-center gap-2">
            <ShoppingCart size={14} className="text-primary" />
            السلة
          </h3>
          <Badge
            variant="outline"
            className="h-5 px-1.5 font-black text-[10px]"
          >
            {cart.length}
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-slate-50/30 dark:bg-black/5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-40 py-6 text-center">
              <ShoppingBag size={32} className="text-primary mb-2 opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-main">
                السلة فارغة
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.uid}
                className="flex flex-col gap-1.5 p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-white/5 border border-border/50 group transition-all hover:border-primary/30 hover:shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-0.5 h-full bg-primary/10 group-hover:bg-primary transition-colors" />

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] sm:text-[12px] font-black text-main leading-tight truncate">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                      <span className="text-[9px] sm:text-[10px] font-black text-primary px-1 sm:px-1.5 py-0.5 bg-primary/10 rounded-lg whitespace-nowrap">
                        {formatCurrency(item.price)}
                      </span>
                      {item.type === "product" && (
                        <Badge
                          variant="outline"
                          className="text-[7px] sm:text-[8px] font-bold h-3 sm:h-3.5 px-1 border-slate-200"
                        >
                          منتج
                        </Badge>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.uid)}
                    className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all shrink-0 touch-target"
                  >
                    <Trash2 size={16} className="sm:size-5" />
                  </button>
                </div>

                {item.type !== "product" && (
                  <div className="flex items-center gap-1.5 mt-0.5 p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                    <User size={10} className="text-primary shrink-0" />
                    <Select
                       
                      value={(item.barberId as any) || ""}
                      onValueChange={(v) => updateCartItemBarber(item.uid, v)}
                    >
                      <SelectTrigger className="h-10 flex-1 bg-transparent border-none font-black text-[9px] sm:text-[10px] text-main">
                        <SelectValue placeholder="تحديد الخبير" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>
                          تحديد الخبير
                        </SelectItem>
                        {barbers.map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.display_name ||
                              b.displayName ||
                              b.full_name ||
                              b.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Live Receipt Mini-Preview */}
        {cart.length > 0 && (
          <div className="px-4 py-2 border-t border-border/30 bg-indigo-50/30 dark:bg-indigo-900/10">
            <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-indigo-500" /> معاينة
              الفاتورة
            </p>
            <div className="space-y-0.5 max-h-16 overflow-y-auto no-scrollbar">
              {cart.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-[9px] font-bold text-slate-500"
                >
                  <span className="truncate">
                    #{idx + 1} {item.name}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(item.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals & Checkout */}
        <div className="p-4 sm:p-5 border-t border-border/50 bg-white dark:bg-white/5 space-y-4 shrink-0">
          <div className="space-y-2 relative z-10">
            <div className="flex justify-between items-center text-[10px] font-bold text-muted uppercase tracking-wider">
              <span>المجموع</span>
              <span className="font-black text-main">
                {formatCurrency(subtotal)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-red-500 uppercase">
                الخصم
              </span>
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-lg border border-red-100 dark:border-red-900/20">
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-14 h-10 bg-transparent text-left focus:outline-none font-black text-red-600 text-xs touch-target"
                  aria-label="مبلغ الخصم"
                />
                <DollarSign size={10} className="text-red-500" />
              </div>
            </div>

            {Number(loyaltyDiscount) > 0 && (
              <div className="flex justify-between items-center text-success">
                <span className="text-[9px] font-black uppercase flex items-center gap-1">
                  <Star size={10} className="fill-success" /> خصم الولاء
                </span>
                <span className="text-xs font-black">
                  -{formatCurrency(loyaltyDiscount)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-2 border-t border-border/30">
              <span className="text-[10px] font-black text-muted uppercase tracking-widest">
                الإجمالي
              </span>
              <span className="text-2xl font-black text-primary tracking-tighter tabular-nums">
                {formatCurrency(finalTotal)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 relative z-10">
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  id: "CASH",
                  label: "نقدي",
                  icon: DollarSign,
                  activeClass:
                    "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20",
                },
                {
                  id: "CARD",
                  label: "شبكة",
                  icon: CreditCard,
                  activeClass:
                    "bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-500/20",
                },
                {
                  id: "SPLIT",
                  label: "مقسم",
                  icon: Activity,
                  activeClass:
                    "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20",
                },
              ].map((method) => {
                const isActive =
                  method.id === "SPLIT"
                    ? isSplitPayment
                    : !isSplitPayment && paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    onClick={() => {
                      if (method.id === "SPLIT") {
                        setIsSplitPayment(!isSplitPayment);
                        if (!isSplitPayment) {
                           
                          setSplitCashAmount(finalTotal.toFixed(2) as any);
                           
                          setSplitCardAmount("0.00" as any);
                        }
                      } else {
                        setIsSplitPayment(false);
                        setPaymentMethod(method.id);
                      }
                    }}
                    className={cn(
                      "h-12 flex flex-col items-center justify-center rounded-xl border-2 transition-all group touch-target",
                      isActive
                        ? method.activeClass
                        : "bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 text-muted hover:border-primary/30 hover:text-primary",
                    )}
                  >
                    <method.icon
                      size={16}
                      className="group-hover:scale-110 transition-transform"
                    />
                    <span className="text-[9px] font-black uppercase tracking-tight">
                      {method.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {isSplitPayment && (
              <div className="p-3 bg-slate-50 dark:bg-white/5 border border-border/50 rounded-2xl animate-in fade-in zoom-in-95 duration-300 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="split-cash"
                      className="text-[9px] font-black text-muted uppercase mr-1"
                    >
                      نقدي
                    </label>
                    <div className="relative">
                      <input
                        id="split-cash"
                        type="number"
                        className="w-full bg-white dark:bg-slate-950 border border-border/50 rounded-lg h-10 px-2 pl-6 text-xs font-black outline-none focus:border-emerald-500/40 touch-target"
                        value={splitCashAmount}
                        onChange={(e) => handleCashChange(e.target.value)}
                        step="0.01"
                      />
                      <DollarSign
                        size={10}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="split-card"
                      className="text-[9px] font-black text-muted uppercase mr-1"
                    >
                      شبكة
                    </label>
                    <div className="relative">
                      <input
                        id="split-card"
                        type="number"
                        className="w-full bg-white dark:bg-slate-950 border border-border/50 rounded-lg h-10 px-2 pl-6 text-xs font-black outline-none focus:border-blue-500/40 touch-target"
                        value={splitCardAmount}
                        onChange={(e) => handleCardChange(e.target.value)}
                        step="0.01"
                      />
                      <CreditCard
                        size={10}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-border/20">
                  <div className="text-[9px] font-bold text-muted">
                    المجموع:{" "}
                    <span
                      className={cn(
                        "font-black",
                        Math.abs(
                          Number(splitCashAmount) +
                            Number(splitCardAmount) -
                            finalTotal,
                        ) < 0.01
                          ? "text-emerald-500"
                          : "text-rose-500",
                      )}
                    >
                      {formatCurrency(
                        Number(splitCashAmount) + Number(splitCardAmount),
                      )}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 px-3 text-[10px] font-black text-primary bg-primary/5 hover:bg-primary/10 touch-target"
                    onClick={() => {
                       
                      setSplitCardAmount(
                        (finalTotal - Number(splitCashAmount)).toFixed(2) as any,
                      );
                    }}
                  >
                    تغطية المتبقي بالشبكة
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button
            size="lg"
            data-pos-checkout="true"
            className={cn(
              "w-full h-14 rounded-2xl font-black text-base transition-all duration-300 shadow-xl group",
              isReady
                ? isEditMode
                  ? "bg-amber-500 text-white shadow-amber-500/20"
                  : "bg-primary text-white shadow-primary/20"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed",
            )}
            disabled={!isReady || isSubmitting}
            onClick={handleCheckout}
          >
            <div className="flex items-center justify-center gap-3">
              {isSubmitting ? (
                <RefreshCw className="animate-spin" size={20} />
              ) : (
                <>
                  {isEditMode ? (
                    <RefreshCw size={18} />
                  ) : (
                    <Zap size={18} fill="currentColor" />
                  )}
                  <span>
                    {isEditMode ? "حفظ التعديلات" : "تأكيد وإصدار (Ctrl+Enter)"}
                  </span>
                </>
              )}
            </div>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default CheckoutBar;
