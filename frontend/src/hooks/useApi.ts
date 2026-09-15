import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { api } from "@/services/api";
import {
  normalizeListResponse,
  normalizeItemResponse,
} from "@/services/apiAdapter";
import type { PaginatedParams, PaginatedResult } from "@/types/common";

const queryKeys = {
  employees: ["employees"],
  employeesArchive: ["employees", "archive"],
  employeePerformance: ["reports", "employee-performance"],
  products: ["products"],
  invoices: ["invoices"],
  services: ["services"],
  businessSettings: ["businessSettings"],
  customers: ["customers"],
  expenses: ["expenses"],
} as const;

 
type AnyRecord = Record<string, any>;

function fetchEmployees(params?: PaginatedParams): Promise<unknown> {
  return api.get("/employees", { params }).then((r) => r.data);
}

function fetchEmployeesArchive(params?: PaginatedParams): Promise<unknown> {
  return api.get("/employees/archive", { params }).then((r) => r.data);
}

function fetchProducts(params?: PaginatedParams): Promise<unknown> {
  return api.get("/products", { params }).then((r) => r.data);
}

function fetchInvoices(params?: PaginatedParams): Promise<PaginatedResult<AnyRecord>> {
  return api.get("/invoices", { params }).then((r) => normalizeListResponse(r));
}

function fetchServices(params?: PaginatedParams): Promise<unknown> {
  return api.get("/services", { params }).then((r) => r.data);
}

function fetchBusinessSettings(): Promise<unknown> {
  return api.get("/business-settings").then((r) => normalizeItemResponse(r));
}

function fetchCustomers(params?: PaginatedParams): Promise<PaginatedResult<AnyRecord>> {
  return api
    .get("/customers", { params })
    .then((r) => normalizeListResponse(r));
}

function fetchExpenses(params?: PaginatedParams): Promise<unknown> {
  return api.get("/expenses", { params }).then((r) => r.data);
}

function fetchEmployeePerformance(params: {
  from_date: string;
  to_date: string;
  page?: number;
  page_size?: number;
  search?: string;
}): Promise<any> {
  return api.get("/reports/employee-performance", { params }).then((r) => r.data);
}

type QueryOpts<T> = Omit<UseQueryOptions<T>, "queryKey" | "queryFn">;

export function useEmployees<T = unknown>(
  params: PaginatedParams = {},
  options: QueryOpts<T> = {},
) {
  return useQuery<T>({
    queryKey: [...queryKeys.employees, params],
    queryFn: () => fetchEmployees(params) as Promise<T>,
    staleTime: 60_000,
    ...options,
  });
}

export function useEmployeesArchive<T = unknown>(
  params: PaginatedParams = {},
  options: QueryOpts<T> = {},
) {
  return useQuery<T>({
    queryKey: [...queryKeys.employeesArchive, params],
    queryFn: () => fetchEmployeesArchive(params) as Promise<T>,
    staleTime: 60_000,
    ...options,
  });
}

export function useProducts<T = unknown>(
  params: PaginatedParams = {},
  options: QueryOpts<T> = {},
) {
  return useQuery<T>({
    queryKey: [...queryKeys.products, params],
    queryFn: () => fetchProducts(params) as Promise<T>,
    staleTime: 60_000,
    ...options,
  });
}

export function useInvoices(
  params: PaginatedParams = {},
  options: QueryOpts<PaginatedResult<AnyRecord>> = {},
) {
  return useQuery({
    queryKey: [...queryKeys.invoices, params],
    queryFn: () => fetchInvoices(params),
    staleTime: 30_000,
    ...options,
  });
}

export function useServices<T = unknown>(
  params: PaginatedParams = {},
  options: QueryOpts<T> = {},
) {
  return useQuery<T>({
    queryKey: [...queryKeys.services, params],
    queryFn: () => fetchServices(params) as Promise<T>,
    staleTime: 60_000,
    ...options,
  });
}

export function useBusinessSettings<T = unknown>(options: QueryOpts<T> = {}) {
  return useQuery<T>({
    queryKey: queryKeys.businessSettings,
    queryFn: fetchBusinessSettings as () => Promise<T>,
    staleTime: 120_000,
    ...options,
  });
}

export function useCustomers(
  params: PaginatedParams = { page: 1, page_size: 20 },
  options: QueryOpts<PaginatedResult<AnyRecord>> = {},
) {
  return useQuery({
    queryKey: [...queryKeys.customers, params],
    queryFn: () => fetchCustomers(params),
    staleTime: 30_000,
    ...options,
  });
}

export function useExpenses<T = unknown>(
  params: PaginatedParams = { page: 1, page_size: 20 },
  options: QueryOpts<T> = {},
) {
  return useQuery<T>({
    queryKey: [...queryKeys.expenses, params],
    queryFn: () => fetchExpenses(params) as Promise<T>,
    staleTime: 30_000,
    ...options,
  });
}

export function useEmployeePerformance(
  params: {
    from_date: string;
    to_date: string;
    page?: number;
    page_size?: number;
    search?: string;
  },
  options: QueryOpts<any> = {},
) {
  return useQuery({
    queryKey: [...queryKeys.employeePerformance, params],
    queryFn: () => fetchEmployeePerformance(params),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData, // keepPreviousData equivalent
    ...options,
  });
}

export function useInvalidateEmployees(): () => void {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.employees });
  };
}

export function useInvalidateProducts(): () => void {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.products });
  };
}

export function useInvalidateInvoices(): () => void {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.invoices });
  };
}

export function useInvalidateServices(): () => void {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.services });
  };
}

export function useInvalidateBusinessSettings(): () => void {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.businessSettings });
  };
}

export function useInvalidateCustomers(): () => void {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.customers });
  };
}

export function useInvalidateExpenses(): () => void {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.expenses });
  };
}

// Re-export for callers that import useMutation patterns from here
export { useMutation, useQueryClient };
export type { UseMutationOptions };
