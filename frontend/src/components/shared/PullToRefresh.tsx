import { useState, useRef, useCallback } from "react";
import { motion, useAnimation } from "framer-motion";
import { cn } from "@/lib/core/utils";
import { RefreshCw } from "lucide-react";

export default function PullToRefresh({ onRefresh, children, className = "" }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const controls = useAnimation();

  const THRESHOLD = 80;

  const handleTouchStart = useCallback(
    (e) => {
      if (isRefreshing) return;
      startY.current = e.touches[0].clientY;
    },
    [isRefreshing],
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (isRefreshing) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 0) {
        setPullDistance(Math.min(diff * 0.5, THRESHOLD * 1.5));
      }
    },
    [isRefreshing],
  );

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= THRESHOLD && onRefresh) {
      setIsRefreshing(true);
      setPullDistance(THRESHOLD);
      await onRefresh();
      setIsRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {showIndicator && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-2"
          style={{ height: pullDistance }}
        >
          <motion.div
            animate={{ rotate: isRefreshing ? 360 : progress * 180 }}
            transition={
              isRefreshing
                ? { duration: 1, repeat: Infinity, ease: "linear" }
                : { duration: 0 }
            }
          >
            <RefreshCw
              size={20}
              className={cn(
                "transition-colors",
                progress >= 1 ? "text-primary" : "text-muted",
              )}
            />
          </motion.div>
          <span className="mr-2 text-xs font-bold text-muted">
            {isRefreshing
              ? "جاري التحديث..."
              : progress >= 1
                ? "اترك للتحديث"
                : "اسحب للتحديث"}
          </span>
        </motion.div>
      )}

      {/* Content */}
      <motion.div
        animate={{ y: isRefreshing ? 0 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
