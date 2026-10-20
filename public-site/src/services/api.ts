import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
} from "axios";
import { getApiErrorMessage } from "../lib/utils";

/**
 * Default to a same-origin, relative API path.
 *
 * This used to be `${protocol}//${hostname}:8000/api/v1`, which is only ever
 * correct on a developer laptop. In production it pointed every request at
 * `https://<host>:8000`, a port nothing serves. The dev server already
 * proxies /api to localhost:8000, so the relative path is right in both
 * environments; a split-origin deployment sets VITE_API_URL at build time.
 */
export const DEFAULT_API_URL = "/api/v1";

/** Requests that hang are worse than requests that fail: cap the wait. */
const REQUEST_TIMEOUT_MS = 15_000;

export const baseURL: string = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

/** Origin that serves uploaded media (logos, service photos). */
export const staticURL: string = baseURL.replace(/\/api\/v1\/?$/, "");

export const api: AxiosInstance = axios.create({
  baseURL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    /**
     * Normalise the message once, centrally, so no caller ever renders a raw
     * Pydantic error object into the DOM (React throws on those).
     */
    const message = getApiErrorMessage(error);
    error.message = message;

    const responseData = error.response?.data as { detail?: unknown } | undefined;
    if (
      responseData &&
      (typeof responseData.detail === "object" || Array.isArray(responseData.detail))
    ) {
      responseData.detail = message;
    }

    return Promise.reject(error);
  },
);

export default api;
