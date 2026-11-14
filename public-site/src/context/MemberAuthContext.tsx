import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import api from "../services/api";
import type { AuthUser } from "../types/common";

/**
 * MemberAuthContext — Manages member authentication for the public site.
 * - Stores JWT token in localStorage
 * - Fetches /me on mount to validate token
 * - Provides login/logout/register methods
 * - Tracks loyalty points (synced from backend)
 *
 * This is a lightweight version that complements (not replaces)
 * the main app's AuthContext in /frontend.
 */
const TOKEN_KEY = "salon-member-token";
const USER_KEY = "salon-member-user";

export interface MemberBooking {
  id: number;
  /** `YYYY-MM-DD`, split out of the API's `scheduledAt` datetime. */
  appointment_date: string;
  /** `HH:mm`, split out of `scheduledAt`. */
  appointment_time: string;
  status: string;
  service_name: string;
  barber_name: string;
}

export interface MemberAuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loyaltyPoints: number;
  bookings: MemberBooking[];
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  register: (formData: Record<string, unknown>) => Promise<AuthUser>;
  refreshUser: () => Promise<void>;
  fetchBookings: () => Promise<void>;
  cancelBooking: (appointmentId: number) => Promise<void>;
  rescheduleBooking: (
    appointmentId: number,
    appointmentDate: string,
    appointmentTime: string,
  ) => Promise<void>;
}

const MemberAuthContext = createContext<MemberAuthContextValue | null>(null);

export function MemberAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? (JSON.parse(stored) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [bookings, setBookings] = useState<MemberBooking[]>([]);

  const setAuth = useCallback((token: string | null, userData: AuthUser | null) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);

      if (userData) localStorage.setItem(USER_KEY, JSON.stringify(userData));
      else localStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
    setUser(userData);
    if (userData?.loyaltyPoints != null) {
      setLoyaltyPoints(Number(userData.loyaltyPoints));
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      // Use existing api instance with auth header
      const res = await api.get("/public/member/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userData = res.data || res;
      setAuth(token, userData);
    } catch (err) {
      // Token invalid or expired
      console.warn("Member auth refresh failed:", (err as Error).message);
      setAuth(null, null);
    } finally {
      setIsLoading(false);
    }
  }, [setAuth]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const res = await api.post("/public/member/login", { email, password });
      const { token, user: userData } = (res.data || res) as {
        token: string;
        user: AuthUser;
      };
      setAuth(token, userData);
      return userData;
    },
    [setAuth],
  );

  const register = useCallback(
    async (formData: Record<string, unknown>): Promise<AuthUser> => {
      const res = await api.post("/public/member/register", formData);
      const { token, user: userData } = (res.data || res) as {
        token: string;
        user: AuthUser;
      };
      setAuth(token, userData);
      return userData;
    },
    [setAuth],
  );

  const logout = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    setAuth(null, null);
    if (token) {
      void api.post(
        "/public/member/logout",
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      ).catch(() => undefined);
    }
  }, [setAuth]);

  /**
   * Booking history.
   *
   * `GET /public/member/bookings` has existed on the backend for the whole time
   * the portal existed, returning the member's last 100 appointments with their
   * status, time, service and barber — and nothing in this app called it. A
   * logged-in member had an account and a loyalty balance but no record of a
   * single visit, which is the one thing an account is for.
   */
  const fetchBookings = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setBookings([]);
      return;
    }
    try {
      const res = await api.get("/public/member/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (res.data ?? res) as unknown;
      const list = Array.isArray(payload) ? payload : [];
      setBookings(
        (list as Record<string, unknown>[]).map((item) => {
          /*
           * The API returns camelCase (`scheduledAt`, `serviceName`,
           * `barberName`) — MemberBookingRead in backend/app/schemas/member.py.
           * Reading snake_case here produced a history where every field was
           * blank: the list rendered, but with "—" for the date and an empty
           * service name on every row.
           *
           * `scheduledAt` arrives as an ISO datetime; it is split here rather
           * than passing an ISO string to `formatDate`, which expects `YYYY-MM-DD`
           * and parses it as local wall-clock time.
           */
          const scheduled = String(item.scheduledAt ?? "");
          const [datePart, timePart = ""] = scheduled.split("T");
          return {
            id: Number(item.id),
            appointment_date: datePart,
            appointment_time: timePart.slice(0, 5),
            status: String(item.status ?? ""),
            service_name: String(item.serviceName ?? ""),
            barber_name: String(item.barberName ?? ""),
          };
        }),
      );
    } catch {
      // A member with a valid token but no readable history is not an error
      // worth surfacing — the portal degrades to an empty list.
      setBookings([]);
    }
  }, []);

  /**
   * History is fetched alongside the profile: a member who signs in should see
   * their appointments without a second round trip, and `bookingsCount` on the
   * profile is derived from the same records.
   */
  useEffect(() => {
    if (user) void fetchBookings();
    else setBookings([]);
  }, [user, fetchBookings]);

  /**
   * Self-service cancel and reschedule.
   *
   * These exist because the confirmation screen handed over a reference and a
   * calendar file but no way to act on them — every change of plan was a phone
   * call. The backend validates ownership and slot availability; the member
   * token is sent because both endpoints are member-scoped.
   *
   * `fetchBookings()` runs afterwards so the list reflects the change instead of
   * showing an appointment the member has just cancelled.
   */
  const cancelBooking = useCallback(
    async (appointmentId: number) => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) throw new Error("not authenticated");
      await api.post(
        `/public/member/bookings/${appointmentId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await fetchBookings();
    },
    [fetchBookings],
  );

  const rescheduleBooking = useCallback(
    async (appointmentId: number, appointmentDate: string, appointmentTime: string) => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) throw new Error("not authenticated");
      await api.post(
        `/public/member/bookings/${appointmentId}/reschedule`,
        { appointment_date: appointmentDate, appointment_time: appointmentTime },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await fetchBookings();
    },
    [fetchBookings],
  );

  const value = useMemo<MemberAuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      loyaltyPoints,
      bookings,
      login,
      logout,
      register,
      refreshUser,
      fetchBookings,
      cancelBooking,
      rescheduleBooking,
    }),
    [
      user,
      isLoading,
      loyaltyPoints,
      bookings,
      login,
      logout,
      register,
      refreshUser,
      fetchBookings,
      cancelBooking,
      rescheduleBooking,
    ],
  );

  return <MemberAuthContext.Provider value={value}>{children}</MemberAuthContext.Provider>;
}

export function useMemberAuth(): MemberAuthContextValue {
  const ctx = useContext(MemberAuthContext);
  if (!ctx) {
    throw new Error("useMemberAuth must be used within MemberAuthProvider");
  }
  return ctx;
}

export default MemberAuthContext;
