import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import type { ID } from "@/types/common";

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
  [key: string]: unknown;
}

export interface LogoutOptions {
  silent?: boolean;
  redirect?: boolean;
}

export interface AuthContextValue {
  user: AuthUser | null;
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string, totpCode?: string) => Promise<AuthUser>;
  logout: (options?: LogoutOptions) => void;
  refreshUser: () => Promise<AuthUser | null>;
  fetchUserProfile: () => Promise<AuthUser | null>;
}

interface AxiosLikeError {
  response?: {
    status?: number;
    headers?: Record<string, string | undefined>;
    data?: {
      detail?: unknown;
    };
  };
}

export class TotpRequiredError extends Error {
  code = "TOTP_REQUIRED" as const;
  constructor() {
    super("TOTP_REQUIRED");
    this.name = "TotpRequiredError";
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

const readStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch (err) {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [loading, setLoading] = useState<boolean>(() => {
    // Optimistic loading: if we have a stored user, don't block initial render
    const storedUser = readStoredUser();
    const token = localStorage.getItem("token");
    return Boolean(token && !storedUser);
  });

  const logout = useCallback(({ silent = false, redirect = true }: LogoutOptions = {}) => {
    // Phase 3: revoke server-side tokens (best-effort) so a stolen token
    // cannot be reused after logout. Local cleanup always runs.
    try {
      const token = localStorage.getItem("token");
      const refreshToken = localStorage.getItem("refresh_token");
      if (token) {
        void api
          .post(
            "/auth/logout",
            { refresh_token: refreshToken ?? undefined },
            { headers: { Authorization: `Bearer ${token}` } },
          )
          .catch(() => undefined);
      }
    } catch {
      /* storage/network unavailable — still clear local state below */
    }
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setUser(null);

    if (!silent) {
      toast.success("تم تسجيل الخروج بنجاح");
    }

    if (redirect && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }, []);

  const fetchUserProfile = useCallback(async (): Promise<AuthUser | null> => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      return null;
    }

    try {
      const response = await api.get("/auth/me");
      const profile = (response.data || null) as AuthUser | null;
      setUser(profile);

      if (profile) {
        localStorage.setItem("user", JSON.stringify(profile));
      }

      return profile;
    } catch (err) {
      console.error("Failed to fetch user profile", err);
      logout({ silent: true });
      return null;
    }
  }, [logout]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== "token") return;

      if (!event.newValue) {
        setUser(null);
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      } else {
        void fetchUserProfile();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [fetchUserProfile]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchUserProfile().finally(() => setLoading(false));
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [fetchUserProfile]);

  const login = useCallback(
    async (username: string, password: string, totpCode?: string): Promise<AuthUser> => {
      try {
        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);
        if (totpCode) {
          formData.append("totp_code", totpCode);
        }

        const response = await api.post("/auth/login", formData, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        const { access_token, refresh_token, user: userData } = response.data as {
          access_token: string;
          refresh_token?: string;
          user: AuthUser;
        };
        localStorage.setItem("token", access_token);

        if (refresh_token) {
          localStorage.setItem("refresh_token", refresh_token);
        }

        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);

        toast.success(
          `مرحباً بك مجدداً، ${
            userData?.full_name ||
            userData?.fullName ||
            userData?.username ||
            "مستخدم"
          }`,
        );

        return userData;
      } catch (err) {
        console.error("Login error details:", (err as AxiosLikeError).response?.data);
        // 2FA gate: surface a typed error (no generic toast) so the
        // login form can reveal the one-time-code field instead.
        const resp = (err as AxiosLikeError).response;
        if (resp?.status === 401 && resp?.headers?.["x-2fa-required"] === "totp") {
          throw new TotpRequiredError();
        }
        let errorMsg = "فشل تسجيل الدخول";
        const detail = (err as AxiosLikeError).response?.data?.detail;

        if (typeof detail === "string") {
          errorMsg = detail;
        } else if (Array.isArray(detail)) {
          const firstError = detail[0] as string | { msg?: string } | undefined;
          errorMsg =
            typeof firstError === "string"
              ? firstError
              : firstError?.msg || JSON.stringify(firstError);
        } else if (detail && typeof detail === "object") {
          errorMsg =
            (detail as { msg?: string }).msg || JSON.stringify(detail);
        }

        toast.error(errorMsg);
        throw err;
      }
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      currentUser: user,
      isAuthenticated: Boolean(user && localStorage.getItem("token")),
      loading,
      login,
      logout,
      refreshUser: fetchUserProfile,
      fetchUserProfile,
    }),
    [user, loading, login, logout, fetchUserProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
