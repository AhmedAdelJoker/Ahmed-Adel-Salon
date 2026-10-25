import React from "react";
import { usePOS } from "@/features/pos";
import { Card } from "@/components/ui/card";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import { triggerSuccessEffect, isOpenShiftStatus } from "@/features/pos/utils";
import {
  enqueueOfflineInvoice,
  isRecoverableNetworkError,
  loadOfflineQueue,
} from "@/lib/offline/invoiceQueue";
import { BarberSelector } from "@/features/pos";
import { CartItemsList } from "@/features/pos";
import { CustomerSelector } from "@/features/pos";
import { ReceiptPreview } from "@/features/pos";
import { CheckoutTotals } from "@/features/pos";

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
    selectedCustomer,
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
    setShowApprovalModal,
  } = usePOS();

  // Feedback tones are synthesized locally (WebAudio) — no external asset
  // dependency, so they work offline and can't fail if a CDN is blocked.
  const playSuccessSound = () => {
    let ctx: AudioContext;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AudioCtx();
    } catch {
      // Audio is a nicety — checkout must proceed even if it fails.
      return;
    }
    const notes = [523.25, 659.25, 783.99]; // C5-E5-G5 "done" arpeggio
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.09;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
    // Contexts aren't reused — close it once the arpeggio finishes.
    setTimeout(() => void ctx.close().catch(() => {}), 800);
  };

  const playErrorSound = () => {
    let ctx: AudioContext;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AudioCtx();
    } catch {
      // Audio is a nicety — checkout must proceed even if it fails.
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
    setTimeout(() => void ctx.close().catch(() => {}), 800);
  };

  // Keyboard Shortcuts
  // (Ctrl+Enter is handled by the global listener in index.tsx to avoid a
  // double-submit; this local listener is intentionally disabled.)
  // React.useEffect(() => { ... }, []);

  const hasOpenShift = isOpenShiftStatus(currentShift);

  const isReady = hasOpenShift && cart.length > 0;

  const handleCheckout = async () => {
    if (isSubmitting) return;
    if (!isReady) {
      playErrorSound();
      toast.error("يرجى استكمال متطلبات الفاتورة");
      return;
    }

    if (isSplitPayment) {
      const totalPaid = Number(splitCashAmount || 0) + Number(splitCardAmount || 0);
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
        item.type === "product" ? null : Number(item.barberId || selectedBarberId),
      unit_price: Number(item.price),
    })),
  };

  // One key per financial transaction: the offline queue replays THIS attempt
  // under this same key, so a lost response can never become a double charge.
  const idempotencyKey = crypto.randomUUID();
  try {
    setIsSubmitting(true);

    const response = await api.post("/invoices/manual", payload, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
      const invoiceData = response.data?.item || response.data?.data || response.data;

      let checkoutCustomerName = "عميل";
      if (isNewCustomer) {
        checkoutCustomerName = newCustomerFirstName;
      } else if (selectedCustomerId === "walk_in") {
        checkoutCustomerName = "عميل مجهول";
      } else {
        // The picked customer record is the source of truth — the roster it
        // used to be looked up in is no longer preloaded.
        const picked = selectedCustomer as Record<string, unknown> | null;
        const full = picked
          ? `${String(picked.first_name ?? picked.firstName ?? "").trim()} ${String(
              picked.last_name ?? picked.lastName ?? "",
            ).trim()}`.trim()
          : "";
        checkoutCustomerName = full || "عميل";
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

      // LAN/server unreachable: the sale stays money-safe by being queued
      // locally with the SAME idempotency key — a replay that races a lost
      // response collapses onto one invoice server-side. Clear the cart the
      // success path clears so cashier can't double-sell it, but skip the
      // success overlay (there is no invoice number to print yet).
      if (isRecoverableNetworkError(error)) {
        const captured = enqueueOfflineInvoice(payload, idempotencyKey);
        if (captured) {
          setIsNewCustomer(false);
          setNewCustomerFirstName("");
          setNewCustomerPhone("");
          setIsSplitPayment(false);
          setSplitCashAmount(0);
          setSplitCardAmount(0);
          setCart([]);
          setDiscount(0);
          const pending = loadOfflineQueue().length;
          toast(
            `لا اتصال بالخادم — الفاتورة محفوظة محلياً وستُرسل تلقائياً عند رجوع الاتصال (${pending} معلقة)`,
            {
              icon: "🛜",
              duration: 8000,
            },
          );
          return;
        }
        //Queue storage failed — fall through to the standard error path so
        // the cashier knows the sale was NOT recorded.
      }

      playErrorSound();
      const err = error as {
        response?: { status?: number; data?: { detail?: unknown } };
      };
      const detail = err?.response?.data?.detail;
      // Discount cap breach arrives as 403 from POST /invoices/manual — open
      // the approval dialog so the manager flow starts immediately.
      if (err?.response?.status === 403) {
        setShowApprovalModal(true);
      }
      toast.error(
        typeof detail === "string" && detail.trim()
          ? detail
          : "فشل إصدار الفاتورة",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeFromCart = (uid: string) => {
    setCart((prev) => prev.filter((item) => item.uid !== uid));
  };

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      <BarberSelector
        selectedBarberId={selectedBarberId}
        setSelectedBarberId={setSelectedBarberId}
        barbers={barbers}
        assignBarberToAll={assignBarberToAll}
        cartLength={cart.length}
      />

      <CustomerSelector />

      {/* bg-card (no backdrop-blur): this card stays mounted all day behind
          near-opaque backgrounds where the blur was a visual no-op but a
          constant compositor cost on weak iGPUs. */}
      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden bg-card border-border/50 shadow-sm">
        <CartItemsList
          cart={cart}
          barbers={barbers}
          removeFromCart={removeFromCart}
          updateCartItemBarber={updateCartItemBarber}
        />

        <ReceiptPreview cart={cart} />

        <CheckoutTotals
          subtotal={subtotal}
          discount={discount}
          setDiscount={setDiscount}
          loyaltyDiscount={loyaltyDiscount}
          finalTotal={finalTotal}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          isSplitPayment={isSplitPayment}
          setIsSplitPayment={setIsSplitPayment}
          splitCashAmount={splitCashAmount}
          splitCardAmount={splitCardAmount}
          setSplitCashAmount={setSplitCashAmount}
          setSplitCardAmount={setSplitCardAmount}
          isReady={isReady}
          isSubmitting={isSubmitting}
          onCheckout={handleCheckout}
        />
      </Card>
    </div>
  );
};

export default CheckoutBar;
