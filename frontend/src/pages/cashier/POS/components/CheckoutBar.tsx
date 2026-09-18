import React from "react";
import { usePOS } from "@/features/pos";
import { Card } from "@/components/ui/card";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import { triggerSuccessEffect } from "@/features/pos/utils";
import { BarberSelector } from "@/features/pos/components/BarberSelector";
import { CartItemsList } from "@/features/pos/components/CartItemsList";
import { ReceiptPreview } from "@/features/pos/components/ReceiptPreview";
import { CheckoutTotals } from "@/features/pos/components/CheckoutTotals";

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
    const handleKeyDown = (e: KeyboardEvent) => {
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
            item.type === "product" ? null : Number(item.barberId || selectedBarberId),
          unit_price: Number(item.price),
        })),
      };

      const response = await api.post("/invoices/manual", payload);
      const invoiceData = response.data?.item || response.data?.data || response.data;

      let checkoutCustomerName = "عميل";
      if (isNewCustomer) {
        checkoutCustomerName = newCustomerFirstName;
      } else if (selectedCustomerId === "walk_in") {
        checkoutCustomerName = "عميل مجهول";
      } else {
        checkoutCustomerName =
          customers.find((c) => String(c.id) === String(selectedCustomerId))?.name ||
          "عميل";
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

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
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
          isEditMode={isEditMode}
          isSubmitting={isSubmitting}
          onCheckout={handleCheckout}
        />
      </Card>
    </div>
  );
};

export default CheckoutBar;
