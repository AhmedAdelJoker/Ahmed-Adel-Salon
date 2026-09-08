/**
 * Bookings domain types.
 */

 
export type BookingRecord = Record<string, any>;

export interface BookingFormData {
  customerId: string;
  customerName: string;
  customerPhone: string;
  employeeId: string;
  appointmentDate: string;
  appointmentTime: string;
  notes: string;
  services: unknown[];
  bookingSource: string;
}

export interface WalkInData {
  phone: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  serviceIds: unknown[];
  notes: string;
}
