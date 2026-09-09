import api from "./api";
import { adaptList } from "./apiAdapter";

export async function getReadyBookingsForPos() {
  const response = await api.get("/bookings/ready-for-pos");
  return adaptList(response);
}

export async function startBookingService(bookingId) {
  const response = await api.post(`/bookings/${bookingId}/start-service`);
  return response.data;
}

export async function completeBookingService(bookingId) {
  const response = await api.post(`/bookings/${bookingId}/complete-service`);
  return response.data;
}

export async function markBookingPaid(bookingId, invoiceId) {
  const response = await api.post(`/bookings/${bookingId}/mark-paid`, { invoice_id: invoiceId, invoiceId });
  return response.data;
}

export function bookingToPosDraft(booking) {
  return {
    booking_id: booking?.id,
    bookingId: booking?.id,
    customer_id: booking?.customer_id,
    customerId: booking?.customer_id,
    customer_name: booking?.customer_name || "عميل حجز",
    customerName: booking?.customer_name || "عميل حجز",
    employee_id: booking?.employee_id,
    employeeId: booking?.employee_id,
    employee_name: booking?.employee_name,
    employeeName: booking?.employee_name,
    service_id: booking?.service_id,
    serviceId: booking?.service_id,
    items: [
      {
        service_id: booking?.service_id,
        serviceId: booking?.service_id,
        name: booking?.service_name || "خدمة حجز",
        service_name: booking?.service_name || "خدمة حجز",
        quantity: 1,
        price: Number(booking?.amount || 0),
        unit_price: Number(booking?.amount || 0),
        total_price: Number(booking?.amount || 0),
        employee_id: booking?.employee_id,
        employeeId: booking?.employee_id,
      },
    ],
  };
}
