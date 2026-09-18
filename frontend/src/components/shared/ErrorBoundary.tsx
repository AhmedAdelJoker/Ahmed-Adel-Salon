import { Component, type ReactNode } from "react";
import { motion } from "framer-motion";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface SharedErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface SharedErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<SharedErrorBoundaryProps, SharedErrorBoundaryState> {
  constructor(props: SharedErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SharedErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-24 px-6 text-center"
        >
          <div className="bg-rose-50 dark:bg-rose-950/20 p-8 rounded-[3rem] border border-rose-200 dark:border-rose-800/30 shadow-lg mb-8">
            <AlertTriangle size={64} className="text-rose-400" />
          </div>
          <h2 className="text-2xl font-black text-main mb-3">
            حدث خطأ غير متوقع
          </h2>
          <p className="text-muted font-bold max-w-md mb-1">
            نعتذر عن هذا الخطأ. يمكنك تحديث الصفحة للمحاولة مرة أخرى.
          </p>
          {this.state.error?.message && (
            <p className="text-xs font-mono text-rose-500 bg-rose-50 dark:bg-rose-950/10 px-4 py-2 rounded-xl mt-4 max-w-lg break-all">
              {this.state.error.message}
            </p>
          )}
          <div className="flex items-center gap-3 mt-8">
            <Button
              onClick={this.handleReset}
              variant="primary"
              className="rounded-xl px-6"
            >
              <RefreshCcw size={18} />
              إعادة المحاولة
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => window.location.reload()}
            >
              تحديث الصفحة
            </Button>
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}
