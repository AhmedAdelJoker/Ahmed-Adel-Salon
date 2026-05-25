import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const SocketContext = createContext(null);
import { useAuth } from "./AuthContext";
function getUserId(user) {
  return user?.id || user?.user_id || user?.employee_id || null;
}

function buildSocketUrl(userId) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  const port = import.meta?.env?.VITE_WS_PORT || "8000";
  const basePath =
    import.meta?.env?.VITE_WS_NOTIFICATIONS_PATH || "/api/v1/notifications/ws";

  return `${protocol}//${host}:${port}${basePath}/${userId}`;
}

export const SocketProvider = ({ children }) => {
  const { user, currentUser, isAuthenticated } = useAuth();
  const activeUser = currentUser || user;
  const userId = getUserId(activeUser);

  const [notifications, setNotifications] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

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

  const sendNotification = useCallback((targetId, message, extra = {}) => {
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

  const value = useMemo(
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
    <SocketContext.Provider value={value || ""}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
