/**
 * Shared core types for public-site.
 */

export type ID = number | string;

export interface AuthUser {
  id?: ID;
  user_id?: ID;
  employee_id?: ID;
  username?: string;
  email?: string;
  full_name?: string;
  fullName?: string;
  role?: string;
  is_active?: boolean;
  loyaltyPoints?: number;
  [key: string]: unknown;
}

export interface NotificationItem {
  id?: ID;
  message?: string;
  [key: string]: unknown;
}
