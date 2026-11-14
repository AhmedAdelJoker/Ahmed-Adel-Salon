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
import { needsTwoFactorEnrollment } from "@/lib/auth/twoFactorEnrollment";
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
  /** Per-user page-access overrides from GET /auth/me; absent = role defaults. */
  permissions?: Record<string, boolean> | null;
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
    // Always start loading when a token exists — the stored user may be stale,
    // and we must complete the server round-trip before rendering protected UI.
    // This prevents a flash of stale data followed by a re-render.
    return Boolean(localStorage.getItem("token"));
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
      // An enrolment-only session is refused by /auth/me exactly like an expired
      // token is -- both answer 403 -- but they are opposites: this session is
      // valid, it just may not read the profile yet. Logging out here cleared
      // the very flag RequireAuth redirects on, so the user was bounced to
      // /login with no route to the panel that would unblock them, and every
      // reload repeated it. Trust the stored user and let the guard route; the
      // enrolment tab is the only page reachable in this state.
      if (needsTwoFactorEnrollment()) {
        const stored = readStoredUser();
        if (stored) {
          setUser(stored);
          return stored;
        }
      }
      console.error("Failed to fetch user profile", err);
      logout({ silent: true });
      return null;
    }
  }, [logout, needsTwoFactorEnrollment]);

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
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    // The restricted session cannot read /auth/me, so the refresh at mount is
    // a guaranteed 403 that used to trigger logout and bounce the user to
    // /login. The stored user is authoritative enough to render the enrolment
    // tab, and the real refresh happens after they enroll.
    if (needsTwoFactorEnrollment()) {
      const stored = readStoredUser();
      if (stored) {
        setUser(stored);
        setLoading(false);
        return;
      }
    }
    fetchUserProfile().finally(() => setLoading(false));
  }, [fetchUserProfile, needsTwoFactorEnrollment]);

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

        const {
          access_token,
          refresh_token,
          user: userData,
          "2fa_enrollment_required": enrollmentRequired,
          "2fa_enrollment_due": enrollmentDue,
        } = response.data as {
          access_token: string;
          refresh_token?: string;
          user: AuthUser;
          "2fa_enrollment_required"?: boolean;
          "2fa_enrollment_due"?: string | null;
        };
        localStorage.setItem("token", access_token);

        if (refresh_token) {
          localStorage.setItem("refresh_token", refresh_token);
        }

        // Mandatory 2FA.
        //
        // A restricted session is still stored, deliberately: the two enrolment
        // endpoints are the only ones it can reach, so throwing the token away
        // would leave the user unable to complete the setup that unlocks it.
        // Every other route answers 403 for this token, which
        // `ProtectedRoute` turns back into a redirect here.
        //
        // The softer case is a normal session with a deadline. It is recorded so
        // the UI can prompt, and deliberately not surfaced as an error: a working
        // login should not look like a failed one.
        if (enrollmentRequired) {
          localStorage.setItem("2fa_enrollment_required", "true");
        } else {
          localStorage.removeItem("2fa_enrollment_required");
        }

        if (enrollmentDue) {
          localStorage.setItem("2fa_enrollment_due", enrollmentDue);
        } else {
          localStorage.removeItem("2fa_enrollment_due");
        }

        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);

        if (enrollmentRequired) {
          // `toast()` rather than `toast.warning`: react-hot-toast has no
          // `warning` method, and calling one that does not exist is a TypeError
          // on the login path -- exactly the moment this must not fail.
          toast("يجب تفعيل التحقق بخطوتين قبل متابعة استخدام النظام");
          return userData;
        }

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
