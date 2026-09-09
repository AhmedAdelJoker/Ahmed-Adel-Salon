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

export interface MemberAuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loyaltyPoints: number;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  register: (formData: Record<string, unknown>) => Promise<AuthUser>;
  refreshUser: () => Promise<void>;
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
    setAuth(null, null);
  }, [setAuth]);

  const value = useMemo<MemberAuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      loyaltyPoints,
      login,
      logout,
      register,
      refreshUser,
    }),
    [user, isLoading, loyaltyPoints, login, logout, register, refreshUser],
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
