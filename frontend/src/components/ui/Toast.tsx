import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/core/utils";
import {
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";

export type ToastVariant = "success" | "error" | "warning" | "info" | "loading";

export interface ToastData {
  id: string;
  variant: ToastVariant;
  message: string;
  duration?: number;
  persistent?: boolean;
}

export interface ToastOptions {
  duration?: number;
  persistent?: boolean;
}

export interface ToastContextValue {
  toasts: ToastData[];
  showToast: (variant: ToastVariant, message: string, options?: ToastOptions) => string;
  hideToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantIcons: Record<ToastVariant, ReactNode> = {
  success: (
    <CheckCircle2
      className="toast-icon toast-icon-success"
      aria-hidden="true"
    />
  ),
  error: (
    <AlertCircle className="toast-icon toast-icon-error" aria-hidden="true" />
  ),
  warning: (
    <AlertTriangle
      className="toast-icon toast-icon-warning"
      aria-hidden="true"
    />
  ),
  info: <Info className="toast-icon toast-icon-info" aria-hidden="true" />,
  loading: (
    <Loader2 className="toast-icon toast-icon-loading" aria-hidden="true" />
  ),
};

const variantClasses: Record<ToastVariant, string> = {
  success: "toast-success",
  error: "toast-error",
  warning: "toast-warning",
  info: "toast-info",
  loading: "toast-loading",
};

const defaultDurations: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 0, // persistent by default
  loading: 0, // persistent
};

function ToastItem({
  toast,
  onClose,
}: {
  toast: ToastData;
  onClose: (id: string) => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!toast.persistent && toast.duration !== 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onClose(toast.id), 250); // wait for exit animation
      }, toast.duration ?? defaultDurations[toast.variant]);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "toast toast-stack",
        variantClasses[toast.variant],
        "animate-toast-slide-in",
      )}
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
    >
      {variantIcons[toast.variant]}
      <span className="toast-message">{toast.message}</span>
      {!toast.persistent && (
        <button
          className="toast-close"
          onClick={() => onClose(toast.id)}
          aria-label="إغلاق التنبيه"
        >
          <X className="icon-size" />
        </button>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast = {
      id,
      variant,
      message,
      duration: options?.duration,
      persistent:
        options?.persistent ?? (variant === "error" || variant === "loading"),
    };
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Render toasts in a portal at the end of body
  const toastElements = toasts.map((toast) => (
    <ToastItem key={toast.id} toast={toast} onClose={hideToast} />
  ));

  return (
    <ToastContext.Provider
      value={{ toasts, showToast, hideToast, clearToasts }}
    >
      {children}
      {createPortal(
        <div
          className="toast-stack"
          style={{
            position: "fixed",
            top: "16px",
            right: "16px",
            left: "auto",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            pointerEvents: "none",
          }}
          aria-live="polite"
          aria-atomic="true"
        >
          {toastElements}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Convenience hooks
export function useToastHelpers() {
  const { showToast, hideToast, clearToasts } = useToast();
  return {
    success: (message: string, options?: ToastOptions) =>
      showToast("success", message, options),
    error: (message: string, options?: ToastOptions) =>
      showToast("error", message, options),
    warning: (message: string, options?: ToastOptions) =>
      showToast("warning", message, options),
    info: (message: string, options?: ToastOptions) =>
      showToast("info", message, options),
    loading: (message: string) =>
      showToast("loading", message, { persistent: true }),
    dismiss: hideToast,
    dismissAll: clearToasts,
  };
}
