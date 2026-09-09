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

import { useAuth } from "./AuthContext";
import type { AuthUser, ID, NotificationItem } from "../types/common";

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

function buildSocketUrl(userId: ID) {
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

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    if (!isAuthenticated || !userId) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setConnected(false);
      return undefined;
    }

    const wsUrl = buildSocketUrl(userId);
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
    };

    socket.onmessage = (event) => {
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
    };

    socket.onerror = (error) => {
      console.warn("⚠️ WebSocket Connection Issue:", error);
    };

    return () => {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    };
  }, [isAuthenticated, userId]);

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
    },
    [],
  );

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
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextValue | null =>
  useContext(SocketContext);
