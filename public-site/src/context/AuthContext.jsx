import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { SocketContext } from "./SocketContext";

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const socket = useContext(SocketContext);

  const [user, setUser] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(true);

  const logout = useCallback(({ silent = false, redirect = true } = {}) => {
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

  const fetchUserProfile = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      return null;
    }

    try {
      const response = await api.get("/auth/me");
      const profile = response.data || null;
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
    if (!socket) return;

    const handleStorageChange = (event) => {
      if (event.key !== "token") return;

      if (!event.newValue) {
        setUser(null);
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      } else {
        fetchUserProfile();
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

  const login = useCallback(async (username, password) => {
    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      const response = await api.post("/auth/login", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token, refresh_token, user: userData } = response.data;
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
      console.error("Login error details:", err.response?.data);
      let errorMsg = "فشل تسجيل الدخول";
      const detail = err.response?.data?.detail;

      if (typeof detail === "string") {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail[0]?.msg || errorMsg;
      }

      toast.error(errorMsg);
      throw err;
    }
  }, []);

  const value = useMemo(
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

  return (
    <AuthContext.Provider value={value || ""}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
