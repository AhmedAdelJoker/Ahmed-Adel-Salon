import React from "react";
import { usePOS } from "../POSContext";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import {
  ShoppingCart,
  Trash2,
  CreditCard,
  Wallet,
  Zap,
  CheckCircle2,
  AlertCircle,
  User,
  ShoppingBag,
  DollarSign,
  Activity,
  Search,
  RefreshCw,
} from "lucide-react";
import { cn, formatCurrency } from "../../../../lib/utils";
import api from "../../../../services/api";
import { toast } from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";

import confetti from 'canvas-confetti';

const triggerSuccessEffect = () => {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#6366f1', '#38bdf8', '#10b981']
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
    setSelectedCustomerId,
    activeAppointmentId,
    isSubmitting,
    setIsSubmitting,
    currentShift,
    readyAppointments,
    fetchReadyAppointments,
    setLastInvoice,
    setCompletedCustomerName,
    setCompletedBarberName,
    customers,
    filteredCustomers,
    customerSearchQuery,
    setCustomerSearchQuery,
    barbers,
    subtotal,
    finalTotal,
    isNewCustomer,
    setIsNewCustomer,
    newCustomerFirstName,
    setNewCustomerFirstName,
    newCustomerLastName,
    setNewCustomerLastName,
    newCustomerPhone,
    setNewCustomerPhone,
    isSplitPayment,
    setIsSplitPayment,
    splitCashAmount,
    setSplitCashAmount,
    splitCardAmount,
    setSplitCardAmount,
    updateCartItemBarber,
  } = usePOS();

  const hasOpenShift = Boolean(
    currentShift &&
    ["open", "opened", "OPEN", "OPENED"].includes(
      String(currentShift.status || "open"),
    ),
  );

  const isReady = hasOpenShift && cart.length > 0;

  const handleCheckout = async () => {
    if (!isReady) {
      toast.error("يرجى استكمال متطلبات الفاتورة");
      return;
    }

    if (isSplitPayment) {
      const totalPaid =
        Number(splitCashAmount || 0) + Number(splitCardAmount || 0);
      if (Math.abs(totalPaid - finalTotal) > 0.01) {
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
        customer_last_name: isNewCustomer ? newCustomerLastName : null,
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
        checkoutCustomerName = `${newCustomerFirstName} ${newCustomerLastName}`;
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
      toast.success("تم إصدار الفاتورة بنجاح");

      // Reset local new customer state
      setIsNewCustomer(false);
      setNewCustomerFirstName("");
      setNewCustomerLastName("");
      setNewCustomerPhone("");
      setIsSplitPayment(false);
      setSplitCashAmount(0);
      setSplitCardAmount(0);

      setCart([]);
      setDiscount(0);
      fetchReadyAppointments();
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("فشل إصدار الفاتورة");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeFromCart = (uid) => {
    setCart((prev) => prev.filter((item) => item.uid !== uid));
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Global Default Barber Selection */}
      <Card className="p-4 space-y-4 bg-card border-border shadow-soft">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-muted flex items-center gap-1">
            <Zap size={12} /> الخبير الافتراضي
          </label>
          <Select value={selectedBarberId} onValueChange={setSelectedBarberId}>
            <SelectTrigger className="h-10 rounded-xl bg-soft/50 border-none font-bold text-xs">
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
        </div>
      </Card>

      {/* Cart Items */}
      <Card className="flex-1 flex flex-col overflow-hidden bg-card/50 backdrop-blur-sm border-border">
        <div className="p-4 border-b border-border flex items-center justify-between bg-soft/30">
          <h3 className="text-sm font-black flex items-center gap-2">
            <ShoppingCart size={16} className="text-primary" />
            السلة
          </h3>
          <Badge variant="outline" className="h-5 px-2 font-black">
            {cart.length}
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-black/5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30 py-10 text-center">
              <div className="p-6 rounded-full bg-soft mb-4 animate-pulse">
                <ShoppingBag size={48} className="text-primary" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-main">السلة فارغة</p>
              <p className="text-[10px] font-bold mt-2 text-muted max-w-[180px]">
                ابدأ بإضافة الخدمات أو المنتجات لإصدار فاتورة جديدة
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.uid}
                className="flex flex-col gap-3 p-4 rounded-3xl bg-white dark:bg-white/5 border border-border group transition-all hover:border-primary/30 hover:shadow-md relative overflow-hidden"
              >
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-1 h-full bg-primary/10 group-hover:bg-primary transition-colors" />
                
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-main leading-tight truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-black text-primary px-2 py-0.5 bg-primary/10 rounded-lg">
                        {formatCurrency(item.price)}
                      </span>
                      {item.type === "product" && (
                        <Badge variant="outline" className="text-[9px] font-bold h-4 px-1 border-slate-200">منتج</Badge>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.uid)}
                    className="h-9 w-9 flex items-center justify-center rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 hover:scale-110 transition-all active:scale-95"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {item.type !== "product" && (
                  <div className="flex items-center gap-2 mt-1 p-2 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User size={12} className="text-primary" />
                    </div>
                    <select
                      className="text-[11px] bg-transparent border-none p-0 pr-1 font-black outline-none flex-1 text-main cursor-pointer appearance-none"
                      value={item.barberId || ""}
                      onChange={(e) =>
                        updateCartItemBarber(item.uid, e.target.value)
                      }
                    >
                      <option value="" disabled>تحديد الخبير</option>
                      {barbers.map((b) => (
                        <option key={b.id} value={String(b.id)}>
                          {b.display_name || b.displayName || b.full_name || b.fullName}
                        </option>
                      ))}
                    </select>
                    <RefreshCw size={10} className="text-muted" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Totals & Checkout */}
        <div className="p-8 border-t border-border bg-white dark:bg-white/5 space-y-8 relative">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 pointer-events-none" />
          
          <div className="space-y-4 relative z-10">
            <div className="flex justify-between items-center text-xs font-bold text-muted uppercase tracking-[0.15em]">
              <span>المجموع الفرعي</span>
              <span className="font-black text-main text-sm">
                {formatCurrency(subtotal)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-red-500 uppercase tracking-widest">الخصم المطبق</span>
              <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/10 p-1.5 pr-4 rounded-[1.25rem] border border-red-100 dark:border-red-900/20 group focus-within:ring-2 ring-red-500/20 transition-all">
                <span className="text-xs font-black text-red-600">-</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-20 bg-transparent text-left focus:outline-none font-black text-red-600 text-sm"
                />
                <div className="h-6 w-6 rounded-lg bg-red-500 flex items-center justify-center text-white">
                  <DollarSign size={12} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1 pt-6 border-t border-border">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] font-black text-muted uppercase tracking-[0.3em] mr-1">الإجمالي المستحق</span>
                <span className="text-4xl font-black text-primary tracking-tighter tabular-nums drop-shadow-sm">
                  {formatCurrency(finalTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 relative z-10">
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "CASH", label: "نقدي", icon: DollarSign, color: "emerald" },
                { id: "CARD", label: "شبكة", icon: CreditCard, color: "blue" },
                { id: "SPLIT", label: "مقسم", icon: Activity, color: "amber" }
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => {
                    if (method.id === "SPLIT") {
                      setIsSplitPayment(!isSplitPayment);
                    } else {
                      setIsSplitPayment(false);
                      setPaymentMethod(method.id);
                    }
                  }}
                  className={cn(
                    "h-14 flex flex-col items-center justify-center gap-1 rounded-[1.5rem] border-2 transition-all group",
                    (method.id === "SPLIT" ? isSplitPayment : (!isSplitPayment && paymentMethod === method.id))
                      ? `bg-${method.color}-500 border-${method.color}-500 text-white shadow-lg shadow-${method.color}-500/20`
                      : "bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 text-muted hover:border-primary/30 hover:text-primary"
                  )}
                >
                  <method.icon size={18} className={cn("group-hover:scale-110 transition-transform")} />
                  <span className="text-[10px] font-black uppercase tracking-wider">{method.label}</span>
                </button>
              ))}
            </div>

            {isSplitPayment && (
              <div className="grid grid-cols-2 gap-4 p-5 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-slate-200/60 dark:border-white/10 animate-in fade-in zoom-in-95 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2">نقدي</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full bg-white dark:bg-slate-900 rounded-2xl h-12 px-4 text-sm font-black outline-none border-2 border-transparent focus:border-emerald-500/50 transition-all"
                      value={splitCashAmount}
                      onChange={(e) => setSplitCashAmount(e.target.value)}
                    />
                    <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2">شبكة</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full bg-white dark:bg-slate-900 rounded-2xl h-12 px-4 text-sm font-black outline-none border-2 border-transparent focus:border-blue-500/50 transition-all"
                      value={splitCardAmount}
                      onChange={(e) => setSplitCardAmount(e.target.value)}
                    />
                    <CreditCard size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button
            size="lg"
            className={cn(
              "w-full h-20 rounded-[2.25rem] font-black text-xl transition-all duration-500 shadow-2xl relative overflow-hidden group",
              isReady
                ? "bg-primary text-white hover:scale-[1.02] active:scale-95 shadow-primary/30"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed",
            )}
            disabled={!isReady || isSubmitting}
            onClick={handleCheckout}
          >
            {/* Shimmer effect */}
            {isReady && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] skew-x-12" />}
            
            <div className="flex items-center justify-center gap-4 relative z-10">
              {isSubmitting ? (
                <RefreshCw className="animate-spin" size={28} />
              ) : (
                <>
                  <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <Zap size={24} fill="currentColor" />
                  </div>
                  <span className="tracking-tight">تأكيد العملية والطباعة</span>
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
