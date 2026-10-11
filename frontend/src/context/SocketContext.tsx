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

import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/context/AuthContext";
import api from "@/services/api";
import { keysForSocketEvent } from "@/lib/queryKeys";
import { needsTwoFactorEnrollment } from "@/lib/auth/twoFactorEnrollment";
import type { ID } from "@/types/common";

export interface NotificationItem {
  id?: ID;
  message?: string;
  [key: string]: unknown;
}

/**
 * Maps a socket event to the query keys it invalidates.
 *
 * The 30s auto-refresh in `App.tsx` deliberately invalidates *everything*, so
 * this is an optimisation for responsiveness, not for correctness: a live
 * event refreshes only the affected slices immediately, and the periodic sweep
 * still acts as the safety net if an event is missed or dropped.
 */
function invalidateForEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  data: NotificationItem,
): void {
  const keys = keysForSocketEvent(data);
  if (keys.length === 0) return;
  for (const key of keys) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

export interface SocketContextValue {
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  clearNotifications: () => void;
  connected: boolean;
  socket: WebSocket | null;
}

export const SocketContext = createContext<SocketContextValue | null>(null);
function getUserId(user: AuthUser | null | undefined): ID | null {
  return user?.id || user?.user_id || user?.employee_id || null;
}

function buildSocketUrl(userId: ID): string {
  const basePath =
    import.meta.env.VITE_WS_NOTIFICATIONS_PATH || "/api/v1/notifications/ws";
  const configuredBase = import.meta.env.VITE_WS_URL?.replace(/\/$/, "");
  if (configuredBase) {
    return `${configuredBase}${basePath}/${userId}`;
  }

  const isElectron = window.location.protocol === "file:";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname || "127.0.0.1";
  const port =
    import.meta.env.VITE_WS_PORT || (isElectron ? "8000" : window.location.port);
  const authority = port ? `${host}:${port}` : host;

  return `${protocol}//${authority}${basePath}/${userId}`;
}

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { user, currentUser, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
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
    // Notifications are not reachable from an enrolment-only session; asking
    // for them just produces a 403 every cycle. No notification the user has to
    // act on can arrive before they have finished enrolling anyway.
    if (needsTwoFactorEnrollment()) return;
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

    // A blocked session cannot open the notification socket, and the backend
    // rejects the handshake just as it rejects the REST calls. Connecting anyway
    // produced a failed handshake plus a retry loop; and the poll fallback that
    // took over from it then 403'd on a 30-second timer. Nothing is lost by not
    // connecting: the user has no notifications to receive until they enrol.
    if (needsTwoFactorEnrollment()) {
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
      const accessToken = localStorage.getItem("token");
      if (!accessToken) {
        wsEnabledRef.current = false;
        pollIntervalRef.current = setInterval(pollNotifications, 30000);
        pollNotifications();
        return;
      }
      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrl, ["access-token", accessToken]);
      } catch {
        // عنوان WS معطوب (مثلاً file://) — نتحول للـ polling بدل كسر الريندر
        wsEnabledRef.current = false;
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(pollNotifications, 30000);
        pollNotifications();
        return;
      }
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
          invalidateForEvent(queryClient, data);

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


  const clearNotifications = useCallback(() => setNotifications([]), []);

  const value = useMemo<SocketContextValue>(
    () => ({
      notifications,
      setNotifications,
      clearNotifications,
      connected,
      socket: socketRef.current,
    }),
    [notifications, clearNotifications, connected],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextValue | null =>
  useContext(SocketContext);
