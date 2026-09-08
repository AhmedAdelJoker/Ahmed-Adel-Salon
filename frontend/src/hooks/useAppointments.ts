import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";

interface AppointmentParams {
  dateFilter?: string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}

interface WaitlistParams {
  target_date?: string;
  status_filter?: string;
  [key: string]: unknown;
}

interface AppointmentResponse {
  data: unknown;
  total?: number;
}

// ═══════════════════════════════════════════════════════════════
// QUERY KEYS — Single Source of Truth for React Query
// ═══════════════════════════════════════════════════════════════

export const QUERY_KEYS = {
  appointments: ["appointments"],
  appointmentDetail: (id) => ["appointments", id],
  appointmentsByDate: (dateFilter, startDate, endDate) => [
    "appointments",
    { dateFilter, startDate, endDate },
  ],
  customers: ["customers"],
  customersPaginated: (params) => ["customers", "paginated", params],
  customerDetail: (id) => ["customers", id],
  customerStats: ["customers", "stats"],
  customerActivityLogs: (id) => ["customers", "activity-logs", id],
  customerInvoices: (id) => ["customers", "invoices", id],
  employees: ["employees"],
  services: ["services"],
  serviceCategories: ["service-categories"],
  waitlist: ["waitlist"],
};

// ═══════════════════════════════════════════════════════════════
// APPOINTMENTS HOOKS
// ═══════════════════════════════════════════════════════════════

/**
 * Hook to fetch appointments with filters.
 * Uses React Query for automatic caching and refetching.
 */
export function useAppointments({
  dateFilter = "today",
  startDate,
  endDate,
  enabled = true,
}: AppointmentParams = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.appointmentsByDate(dateFilter, startDate, endDate),
    queryFn: async () => {
      const params: Record<string, unknown> = { date_filter: dateFilter, limit: 1000 };
      if (dateFilter === "custom" && startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      const res = await api.get("/appointments", { params });
      return adaptList(res);
    },
    enabled,
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch a single appointment by ID.
 */
export function useAppointment(appointmentId) {
  return useQuery({
    queryKey: QUERY_KEYS.appointmentDetail(appointmentId),
    queryFn: async () => {
      const res = await api.get(`/appointments/${appointmentId}`);
      return res.data;
    },
    enabled: !!appointmentId,
    staleTime: 30_000,
  });
}

/**
 * Hook to create a new appointment.
 */
export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, Record<string, unknown>>({
    mutationFn: async (data) => {
      const res = await api.post("/appointments", data);
      return res.data;
    },
    onSuccess: () => {
      // Invalidate all appointment queries to refetch
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments });
    },
  });
}

/**
 * Hook to update an appointment (full update).
 */
export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { id: number | string; data: Record<string, unknown> }>({
    mutationFn: async ({ id, data }) => {
      const res = await api.put(`/appointments/${id}`, data);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.appointmentDetail(id),
      });
    },
  });
}

/**
 * Hook to partially update an appointment (PATCH).
 */
export function usePatchAppointment() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { id: number | string; data: Record<string, unknown> }>({
    mutationFn: async ({ id, data }) => {
      const res = await api.patch(`/appointments/${id}`, data);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.appointmentDetail(id),
      });
    },
  });
}

/**
 * Hook to update appointment status.
 */
export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { id: number | string; status: string; cancellation_reason?: string }>({
    mutationFn: async ({ id, status, cancellation_reason }) => {
      const res = await api.patch(`/appointments/${id}/status`, {
        status,
        cancellation_reason,
      });
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.appointmentDetail(id),
      });
    },
  });
}

/**
 * Hook to assign a barber to an appointment.
 */
export function useAssignBarber() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { appointmentId: number | string; employeeId: number | string }>({
    mutationFn: async ({ appointmentId, employeeId }) => {
      const res = await api.patch(
        `/appointments/${appointmentId}/assign-barber`,
        {
          employee_id: employeeId,
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments });
    },
  });
}

/**
 * Hook to execute bulk actions on multiple appointments.
 */
export function useBulkAction() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, Record<string, unknown>>({
    mutationFn: async (payload) => {
      const res = await api.post("/appointments/bulk-action", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// REFERENCE DATA HOOKS
// ═══════════════════════════════════════════════════════════════

/**
 * Hook to fetch customers list.
 */
export function useCustomers() {
  return useQuery({
    queryKey: QUERY_KEYS.customers,
    queryFn: async () => {
      const res = await api.get("/customers", { params: { limit: 1000 } });
      return adaptList(res);
    },
    staleTime: 5 * 60_000, // 5 minutes
  });
}

/**
 * Hook to fetch paginated customers with search.
 */
export function useCustomersPaginated({
  page = 1,
  pageSize = 10,
  q = "",
} = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.customersPaginated({ page, pageSize, q }),
    queryFn: async () => {
      const skip = (page - 1) * pageSize;
      const res = await api.get("/customers", {
        params: { skip, limit: pageSize, q: q || undefined },
      });
      const data = res.data;
      return {
        items: data.items || data.data || data || [],
        total: data.total ?? (Array.isArray(data) ? data.length : 0),
      };
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

/**
 * Hook to fetch customer stats.
 */
export function useCustomerStats() {
  return useQuery({
    queryKey: QUERY_KEYS.customerStats,
    queryFn: async () => {
      const res = await api.get("/customers/stats");
      return res.data;
    },
    staleTime: 60_000,
  });
}

/**
 * Hook to fetch activity logs for a specific customer.
 */
export function useCustomerActivityLogs(customerId, enabled = false) {
  return useQuery({
    queryKey: QUERY_KEYS.customerActivityLogs(customerId),
    queryFn: async () => {
      const res = await api.get("/activity-logs", {
        params: { entity_type: "customer", entity_id: customerId, limit: 30 },
      });
      return res.data?.items || [];
    },
    enabled: !!customerId && enabled,
    staleTime: 30_000,
  });
}

/**
 * Hook to create a new customer.
 */
export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/customers", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customerStats });
    },
  });
}

/**
 * Hook to update a customer.
 */
export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { id: number | string; data: Record<string, unknown> }>({
    mutationFn: async ({ id, data }) => {
      const res = await api.put(`/customers/${id}`, data);
      return res.data;
    },
    onSuccess: (data) => {
      const updated = data as { customer_id?: string | number; id?: string | number } | null;
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customerDetail(updated?.customer_id || updated?.id),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customerStats });
    },
  });
}

/**
 * Hook to delete a customer (soft delete).
 */
export function useDeleteCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (customerId) => {
      await api.delete(`/customers/${customerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customerStats });
    },
  });
}

/**
 * Hook to fetch employees list.
 */
export function useEmployees() {
  return useQuery({
    queryKey: QUERY_KEYS.employees,
    queryFn: async () => {
      const res = await api.get("/employees", { params: { limit: 1000 } });
      return adaptList(res);
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Hook to fetch services list.
 */
export function useServices() {
  return useQuery({
    queryKey: QUERY_KEYS.services,
    queryFn: async () => {
      const res = await api.get("/services", { params: { limit: 1000 } });
      return adaptList(res);
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Hook to fetch service categories.
 */
export function useServiceCategories() {
  return useQuery({
    queryKey: QUERY_KEYS.serviceCategories,
    queryFn: async () => {
      const res = await api.get("/service-categories");
      return adaptList(res);
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Hook to fetch waitlist entries.
 */
export function useWaitlist(targetDate?: string, statusFilter?: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.waitlist, { targetDate, statusFilter }],
    queryFn: async () => {
      const params: WaitlistParams = {};
      if (targetDate) params.target_date = targetDate;
      if (statusFilter) params.status_filter = statusFilter;
      const res = await api.get("/waitlist", { params });
      return res.data;
    },
    staleTime: 30_000,
  });
}

// ═══════════════════════════════════════════════════════════════
// CUSTOM HOOK: useBookingData
// ═══════════════════════════════════════════════════════════════

/**
 * Combined hook that fetches all data needed for booking pages.
 * Replaces the old BookingContext pattern.
 */
export function useBookingData({
  dateFilter = "today",
  startDate,
  endDate,
}: AppointmentParams = {}) {
  const appointments = useAppointments({ dateFilter, startDate, endDate });
  const customers = useCustomers();
  const employees = useEmployees();
  const services = useServices();
  const categories = useServiceCategories();

  return {
    // Data
    bookings: appointments.data || [],
    customers: customers.data || [],
    employees: employees.data || [],
    services: services.data || [],
    categories: categories.data || [],

    // Loading states
    loading:
      appointments.isLoading ||
      customers.isLoading ||
      employees.isLoading ||
      services.isLoading ||
      categories.isLoading,

    // Refetch functions
    refetchBookings: appointments.refetch,
    refetchAll: () => {
      appointments.refetch();
      customers.refetch();
      employees.refetch();
      services.refetch();
      categories.refetch();
    },
  };
}
