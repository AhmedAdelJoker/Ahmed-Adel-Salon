import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { getApiErrorMessage } from "@/lib/core/utils";

declare global {
  interface Window {
    electronAPI?: unknown;
  }
}

const isElectron: boolean = !!(
  window.electronAPI ||
  window.location.protocol === "file:" ||
  navigator.userAgent.includes("Electron") ||
  (window.process as unknown as { versions?: { electron?: string } } | undefined)
    ?.versions?.electron
);
// ملاحظة: على file:// يكون hostname فارغاً، لذلك أي بروتوكول file يعني Electron
// ونثبّت عنوان الباك إند المحلي بدل بناء URL معطوب مثل file://:8000/...
const DEFAULT_API_URL: string = isElectron
  ? "http://127.0.0.1:8000/api/v1"
  : `${window.location.protocol}//${window.location.hostname || "127.0.0.1"}:8000/api/v1`;
export const baseURL: string = import.meta.env.VITE_API_URL || DEFAULT_API_URL;
export const staticURL: string = baseURL.replace("/api/v1", "");

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing = false;

interface QueuedRequest {
  resolve: (_token: string | null) => void;
  reject: (_error: unknown) => void;
}

let failedQueue: QueuedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null): void => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export function setAuthToken(token: string | null | undefined): void {
  if (token) {
    localStorage.setItem("token", token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem("token");
    delete api.defaults.headers.common.Authorization;
  }
}

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers ?? ({} as InternalAxiosRequestConfig["headers"]);
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    // Robustly handle error messages to prevent React rendering objects
    const message = getApiErrorMessage(error);
    error.message = message;

    // Sanitize the response data detail if it exists, so legacy toast.error(error.response.data.detail) calls don't crash React
    const responseData = error.response?.data as
      | { detail?: unknown }
      | undefined;
    if (responseData) {
      if (
        typeof responseData.detail === "object" ||
        Array.isArray(responseData.detail)
      ) {
        responseData.detail = message;
      }
    }

    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const refreshToken = localStorage.getItem("refresh_token");

    if (status === 401 && refreshToken && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = originalRequest.headers ?? ({} as RetryableRequestConfig["headers"]);
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((queueError: unknown) => Promise.reject(queueError));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post<{ access_token?: string; refresh_token?: string }>(
          `${baseURL}/auth/refresh`,
          {
            refresh_token: refreshToken,
          },
        );

        const newToken = response.data?.access_token;
        const newRefreshToken = response.data?.refresh_token;

        if (!newToken) {
          throw new Error("Refresh response does not contain access_token");
        }

        setAuthToken(newToken);
        if (newRefreshToken) {
          localStorage.setItem("refresh_token", newRefreshToken);
        }

        processQueue(null, newToken);
        originalRequest.headers = originalRequest.headers ?? ({} as RetryableRequestConfig["headers"]);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError: unknown) {
        processQueue(refreshError, null);
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");

        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
