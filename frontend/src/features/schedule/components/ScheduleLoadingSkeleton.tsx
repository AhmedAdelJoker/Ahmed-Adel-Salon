import { motion } from "framer-motion";

export function ScheduleLoadingSkeleton() {
  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      <div className="h-20 rounded-2xl bg-soft animate-pulse" />
      <div className="flex gap-4">
        <div
          className="w-24 rounded-2xl bg-soft animate-pulse"
          style={{ height: 500 }}
        />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1 rounded-2xl bg-soft/60 animate-pulse"
            style={{ height: 500 }}
          />
        ))}
      </div>
    </motion.div>
  );
}
