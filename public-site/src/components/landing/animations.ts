// Shared Framer Motion variants to keep bundle small (used in multiple sections).
export const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 20,
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

export const cardMotion = {
  initial: { opacity: 0, y: 40 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 20,
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  hover: {
    y: -8,
    scale: 1.02,
    boxShadow: "0 30px 60px -15px rgba(0, 0, 0, 0.15)",
    transition: { type: "spring", stiffness: 400, damping: 25 },
  },
};
