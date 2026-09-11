/**
 * Customers feature barrel.
 */
export {
  EMPTY_CUSTOMER_FORM,
  CUSTOMERS_PAGE_SIZE,
  CUSTOMER_FILTER_TABS,
} from "@/features/customers/constants";
export { customerId, getInitials, customerName, secondPhone } from "@/features/customers/utils/customer";
export { useCustomersList } from "@/features/customers/hooks/useCustomersList";
export { useCustomerDialogs } from "@/features/customers/hooks/useCustomerDialogs";
export { default as CustomerKpi } from "@/features/customers/components/CustomerKpi";
export { default as CustomerMiniStat } from "@/features/customers/components/CustomerMiniStat";
export { default as CustomerHeader } from "@/features/customers/components/CustomerHeader";
export { default as CustomerKpis } from "@/features/customers/components/CustomerKpis";
export { default as DuplicatesAlert } from "@/features/customers/components/DuplicatesAlert";
export { default as CustomerToolbar } from "@/features/customers/components/CustomerToolbar";
export { default as CustomerTable } from "@/features/customers/components/CustomerTable";
export { default as CustomerCards } from "@/features/customers/components/CustomerCards";
export { default as CustomerPagination } from "@/features/customers/components/CustomerPagination";
export { default as CustomerDetailsDialog } from "@/features/customers/components/CustomerDetailsDialog";
export { default as CustomerFormDialog } from "@/features/customers/components/CustomerFormDialog";
export { default as CustomerDeleteDialog } from "@/features/customers/components/CustomerDeleteDialog";
