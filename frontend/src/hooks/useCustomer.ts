import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";

export function useCustomerDetail(customerId) {
  return useQuery({
    queryKey: ["customers", "detail", customerId],
    queryFn: async () => {
      const res = await api.get(`/customers/${customerId}`);
      return res.data;
    },
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

export function useCustomerAppointments(customerId) {
  return useQuery({
    queryKey: ["customers", customerId, "appointments"],
    queryFn: async () => {
      const res = await api.get("/appointments", {
        params: { customer_id: customerId, limit: 100 },
      });
      return adaptList(res);
    },
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

export function useCustomerInvoices(customerId) {
  return useQuery({
    queryKey: ["customers", customerId, "invoices"],
    queryFn: async () => {
      const res = await api.get("/invoices", {
        params: { customer_id: customerId, limit: 100 },
      });
      return adaptList(res);
    },
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

export function useCustomerActivityLogs(customerId) {
  return useQuery({
    queryKey: ["customers", customerId, "activity-logs"],
    queryFn: async () => {
      try {
        const res = await api.get("/activity-logs", {
          params: { entity_type: "customer", entity_id: customerId, limit: 50 },
        });
        return res.data?.items || [];
      } catch (error) {
        // Handle 403 Forbidden gracefully - user may not have permission to view activity logs
        const apiErr = error as { response?: { status?: number } };
        if (apiErr.response?.status === 403) {
          console.warn("User does not have permission to view activity logs");
          return [];
        }
        throw error;
      }
    },
    enabled: !!customerId,
    staleTime: 30_000,
  });
}
