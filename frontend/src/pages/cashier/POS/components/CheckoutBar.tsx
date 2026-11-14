import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePOS } from "@/features/pos";
import { Card } from "@/components/ui/card";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import {
  triggerSuccessEffect,
  isOpenShiftStatus,
  cartLineNeedsExpert,
} from "@/features/pos/utils";
import { digitsOnly } from "@/features/hr/utils/digits";
import {
  enqueueOfflineInvoice,
  isRecoverableNetworkError,
  loadOfflineQueue,
} from "@/lib/offline/invoiceQueue";
import {
  BarberSelector,
  CartItemsList,
  CheckoutTotals,
  CustomerCard,
} from "@/features/pos";

/**
 * The left column of the till: who is buying, what is in the cart, and how it
 * is paid.
 *
 * The customer block is deliberately not a picker any more. A sale carries a
 * mandatory full name and an optional mobile; the mobile resolves an existing
 * customer (and their loyalty discount), while an unmatched number becomes a
 * new customer record on the server. Reception sessions arrive with the
 * appointment's customer already locked into the fields.
 */
const CheckoutBar = () => {
  const { t } = useTranslation("pos");
  const {
    cart,
    saleMode,
    discount,
    setDiscount,
    paymentMethod,
    setPaymentMethod,
    selectedBarberId,
    setSelectedBarberId,
    selectedCustomerId,
    customerName,
    customerPhone,
    activeAppointmentId,
    isSubmitting,
    setIsSubmitting,
    currentShift,
    fetchReadyAppointments,
    setLastInvoice,
    setCompletedCustomerName,
    setCompletedBarberName,
    barbers,
    subtotal,
    finalTotal,
    discountAllowance,
    loyaltyDiscount,
    isSplitPayment,
    setIsSplitPayment,
    splitLines,
    setSplitLines,
    updateCartItemBarber,
    updateCartItemQuantity,
    assignBarberToAll,
    setShowApprovalModal,
    taxRate,
    taxAmount,
    validateCustomer,
    resetPOS,
    removeFromCart,
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

  const hasOpenShift = isOpenShiftStatus(currentShift);

  const isReady = hasOpenShift && cart.length > 0;

  // Undo for cart deletion: keep the last removed item for ~5 seconds so it can
  // be restored if the deletion was accidental.
  const [pendingUndo, setPendingUndo] = useState<{
    item: (typeof cart)[number];
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const clearUndo = () => {
    if (pendingUndo) {
      clearTimeout(pendingUndo.timer);
      setPendingUndo(null);
    }
  };

  const removeFromCartWithUndo = (uid: string) => {
    clearUndo();
    const item = cart.find((i) => i.uid === uid);
    if (!item) return;
    removeFromCart(uid);
    const timer = setTimeout(() => setPendingUndo(null), 5000);
    setPendingUndo({ item, timer });
    toast.error(t("cart.removed", { name: item.name }), {
      icon: "🗑️",
      duration: 5000,
    });
  };

  /** Snapshot the buyer/barber labels before the sale state is wiped. */
  const saleCustomerName =
    customerName.trim() || t("checkout.generic_customer");
  const saleBarberName =
    cart.find((item) => cartLineNeedsExpert(item))?.barberName ||
    t("success.no_expert");

  const handleCheckout = async () => {
    if (isSubmitting) return;

    if (!hasOpenShift) {
      playErrorSound();
      toast.error(t("checkout.shift_closed"));
      return;
    }

    if (cart.length === 0) {
      playErrorSound();
      toast.error(t("checkout.not_ready"));
      return;
    }

    // The buyer comes first: an invoice without a valid name (or with a
    // malformed optional phone) is rejected before any money moves.
    const customerError = validateCustomer();
    if (customerError) {
      playErrorSound();
      toast.error(customerError);
      return;
    }

    if (isSplitPayment) {
      const totalPaid = splitLines.reduce(
        (sum, line) => sum + Number(line.amount || 0),
        0,
      );
      if (Math.abs(totalPaid - finalTotal) > 0.01) {
        playErrorSound();
        toast.error(
          t("checkout.split_mismatch", {
            paid: totalPaid.toFixed(2),
            total: finalTotal.toFixed(2),
          }),
        );
        return;
      }
    }

    // Products and product-only offers never carry a barber. Services and
    // service offers must, because the commission and the service log are
    // attributed to that employee.
    const missingBarber = cart.find(
      (item) => cartLineNeedsExpert(item) && !item.barberId,
    );
    if (missingBarber) {
      playErrorSound();
      toast.error(t("checkout.missing_barber", { name: missingBarber.name }));
      return;
    }

    const hasCustomerRecord =
      selectedCustomerId !== "walk_in" && Boolean(selectedCustomerId);

    const payload = {
      customer_id: hasCustomerRecord ? Number(selectedCustomerId) : null,
      // Sent for every sale: the server snapshots it on the invoice so a
      // later rename/merge of the customer row cannot rewrite history.
      customer_name: customerName.trim() || null,
      customer_phone: customerPhone.trim() ? digitsOnly(customerPhone) : null,
      payment_method: isSplitPayment ? "split" : paymentMethod.toLowerCase(),
      split_payments: isSplitPayment
        ? splitLines
            .map((line) => ({
              payment_method: line.method,
              amount: Number(line.amount || 0),
            }))
            .filter((line) => line.amount > 0)
        : null,
      discount_amount: Number(discount || 0),
      appointment_id: activeAppointmentId || null,
      items: cart.map((item) => ({
        item_type: item.type,
        service_id: item.type === "service" ? item.id : null,
        product_id: item.type === "product" ? item.id : null,
        offer_id: item.type === "offer" ? item.id : null,
        quantity: Number(item.quantity || 1),
        // Retail lines (products and product-only offers) have no performer
        // and therefore no employee and no commission.
        employee_id: cartLineNeedsExpert(item)
          ? Number(item.barberId || selectedBarberId) || null
          : null,
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
      const invoiceData =
        response.data?.item || response.data?.data || response.data;

      setLastInvoice(invoiceData);
      setCompletedCustomerName(saleCustomerName);
      setCompletedBarberName(saleBarberName);
      playSuccessSound();
      triggerSuccessEffect();
      toast.success(t("checkout.success"));

      // The sale is committed. Return the till to the session queue so the
      // next customer starts from a clean slate (mode, cart, customer, split).
      resetPOS({ silent: true });
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
          setCompletedCustomerName(saleCustomerName);
          setCompletedBarberName(saleBarberName);
          resetPOS({ silent: true });
          const pending = loadOfflineQueue().length;
          toast(t("checkout.offline_queued", { count: pending }), {
            icon: "🛜",
            duration: 8000,
          });
          return;
        }
        // Queue storage failed — fall through to the standard error path so
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
          : t("checkout.failed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {/* Care products carry no service attribution, so the barber picker is
          not merely optional there — it must not appear at all. */}
      {saleMode !== "products" && (
        <BarberSelector
          selectedBarberId={selectedBarberId}
          setSelectedBarberId={setSelectedBarberId}
          barbers={barbers}
          assignBarberToAll={assignBarberToAll}
          cartLength={cart.length}
        />
      )}

      <CustomerCard />

      {/* bg-card (no backdrop-blur): this card stays mounted all day behind
          near-opaque backgrounds where the blur was a visual no-op but a
          constant compositor cost on weak iGPUs. */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/50 bg-card shadow-sm">
        <CartItemsList
          cart={cart}
          barbers={barbers}
          removeFromCart={removeFromCartWithUndo}
          updateCartItemBarber={updateCartItemBarber}
          updateCartItemQuantity={updateCartItemQuantity}
        />

        <CheckoutTotals
          subtotal={subtotal}
          discount={discount}
          setDiscount={setDiscount}
          discountAllowance={discountAllowance}
          loyaltyDiscount={loyaltyDiscount}
          taxRate={taxRate}
          taxAmount={taxAmount}
          finalTotal={finalTotal}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          isSplitPayment={isSplitPayment}
          setIsSplitPayment={setIsSplitPayment}
          splitLines={splitLines}
          setSplitLines={setSplitLines}
          isReady={isReady}
          isSubmitting={isSubmitting}
          onCheckout={handleCheckout}
        />
      </Card>
    </div>
  );
};

export default CheckoutBar;
