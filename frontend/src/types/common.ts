/**
 * Shared core types for the gradual JS → TS migration.
 * Keep these dependency-free so any module can import them.
 */

export type ID = number | string;

export interface PaginatedParams {
  page?: number;
  page_size?: number;
  search?: string;
  [key: string]: unknown;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  meta?: { page?: number; pageSize?: number; totalPages?: number };
}

export interface ApiListResponse<T> {
  items: T[];
  total: number;
  raw?: unknown;
}

// Minimal Axios-compatible shapes so services can be typed
// without pulling axios types into every file.
export interface ApiResponse<T = unknown> {
  data: T;
  status?: number;
   
  [key: string]: any;
}

export interface ApiClient {
  get<T = unknown>(url: string, config?: unknown): Promise<ApiResponse<T>>;
  post<T = unknown>(url: string, data?: unknown, config?: unknown): Promise<ApiResponse<T>>;
  put<T = unknown>(url: string, data?: unknown, config?: unknown): Promise<ApiResponse<T>>;
  patch<T = unknown>(url: string, data?: unknown, config?: unknown): Promise<ApiResponse<T>>;
  delete<T = unknown>(url: string, config?: unknown): Promise<ApiResponse<T>>;
}

// Auth / user
export interface User {
  id?: ID;
  username?: string;
  email?: string;
  full_name?: string;
  role?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  user?: User;
  [key: string]: unknown;
}
