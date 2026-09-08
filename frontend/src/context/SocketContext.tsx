import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/context/AuthContext";
import api from "@/services/api";
import type { ID } from "@/types/common";

export interface NotificationItem {
  id?: ID;
  message?: string;
  [key: string]: unknown;
}

export interface SocketContextValue {
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  clearNotifications: () => void;
  sendNotification: (
    targetId: ID,
    message: string,
    extra?: Record<string, unknown>,
  ) => boolean;
  connected: boolean;
  socket: WebSocket | null;
}

export const SocketContext = createContext<SocketContextValue | null>(null);
function getUserId(user: AuthUser | null | undefined): ID | null {
  return user?.id || user?.user_id || user?.employee_id || null;
}

function buildSocketUrl(userId: ID): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  const port = import.meta?.env?.VITE_WS_PORT || "8000";
  const basePath =
    import.meta?.env?.VITE_WS_NOTIFICATIONS_PATH || "/api/v1/notifications/ws";

  return `${protocol}//${host}:${port}${basePath}/${userId}`;
}

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { user, currentUser, isAuthenticated } = useAuth();
  const activeUser = currentUser || user;
  const userId = getUserId(activeUser);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsEnabledRef = useRef(true); // disable WS after first failure

  // Fallback polling for notifications
  const pollNotifications = useCallback(async () => {
    if (!isAuthenticated || !userId || wsEnabledRef.current) return;
    try {
      const res = await api.get("/notifications", {
        params: { page: 1, page_size: 20, unread_only: true },
      });
      const data = res.data?.items || res.data || [];
      if (data.length > 0) {
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const newOnes = data.filter((n) => !existingIds.has(n.id));
          return [...newOnes, ...prev].slice(0, 50);
        });
      }
    } catch (_err) {
      // ignore polling errors
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setConnected(false);
      return undefined;
    }

    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      if (!wsEnabledRef.current) {
        // Fallback to polling
        pollIntervalRef.current = setInterval(pollNotifications, 30000);
        pollNotifications(); // initial
        setConnected(true);
        return;
      }

      const wsUrl = buildSocketUrl(userId);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (socketRef.current === socket) {
          reconnectAttempts = 0;
          setConnected(true);
          // clear polling if WS connects
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      };

      socket.onmessage = (event) => {
        if (socketRef.current !== socket) return;
        try {
          const data = JSON.parse(event.data);
          setNotifications((prev) => [data, ...prev]);

          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            new Notification("Salon Pro", {
              body: data.message || "إشعار جديد",
            });
          }
        } catch (error) {
          console.error("WS Message Error:", error);
        }
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        setConnected(false);
        if (!disposed && reconnectAttempts < 3) {
          const delay = Math.min(10000, 1000 * 2 ** reconnectAttempts);
          reconnectAttempts += 1;
          reconnectTimer = setTimeout(connect, delay);
        } else {
          // Disable WS after few failures, fall back to polling
          wsEnabledRef.current = false;
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = setInterval(pollNotifications, 30000);
          pollNotifications();
        }
      };

      socket.onerror = () => {
        if (socket.readyState !== WebSocket.CLOSED) {
          // silent - onclose will handle fallback
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (socketRef.current) {
        const socket = socketRef.current;
        socketRef.current = null;
        if (socket.readyState === WebSocket.OPEN) {
          socket.onopen = null;
          socket.onmessage = null;
          socket.onclose = null;
          socket.onerror = null;
          socket.close();
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.onopen = () => socket.close();
          socket.onmessage = null;
          socket.onerror = null;
        }
      }
    };
  }, [isAuthenticated, userId, pollNotifications]);

  const sendNotification = useCallback(
    (
      targetId: ID,
      message: string,
      extra: Record<string, unknown> = {},
    ): boolean => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          targetId,
          message,
          ...extra,
        }),
      );
      return true;
    }
    return false;
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  const value = useMemo<SocketContextValue>(
    () => ({
      notifications,
      setNotifications,
      clearNotifications,
      sendNotification,
      connected,
      socket: socketRef.current,
    }),
    [notifications, clearNotifications, sendNotification, connected],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextValue | null =>
  useContext(SocketContext);
