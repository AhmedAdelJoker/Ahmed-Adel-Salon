import axios from "axios";

const DEFAULT_API_URL = `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
const baseURL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

function setAuthToken(token) {
  if (token) {
    localStorage.setItem("token", token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem("token");
    delete api.defaults.headers.common.Authorization;
  }
}

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Normalize error message for toast and UI consumption
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail;
      if (typeof detail === "string") {
        error.message = detail;
      } else if (Array.isArray(detail)) {
        const first = detail[0];
        error.message = first?.msg || JSON.stringify(first);
      } else if (typeof detail === "object") {
        error.message = detail.msg || JSON.stringify(detail);
      }
    } else if (error.response?.data?.message) {
      error.message = error.response.data.message;
    }

    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const refreshToken = localStorage.getItem("refresh_token");

    if (status === 401 && refreshToken && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((queueError) => Promise.reject(queueError));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${baseURL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

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
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
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

export { baseURL, setAuthToken };
export default api;
