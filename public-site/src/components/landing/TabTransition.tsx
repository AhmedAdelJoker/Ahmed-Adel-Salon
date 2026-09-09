import { motion } from "framer-motion";

/**
 * TabTransition — Page-level transition wrapper for landing page tabs.
 * Provides smooth fade + slide between active tabs.
 * Wraps content with consistent entry/exit animation.
 */
const tabVariants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -16,
    transition: { duration: 0.25, ease: [0.7, 0, 0.84, 0] },
  },
};

export default function TabTransition({ tabKey, children, className = "" }) {
  return (
    <motion.div
      key={tabKey}
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}
