export const THEMES = {
  midnight: {
    primary: "#D4AF37",
    secondary: "#B08D26",
    accent: "#F8FAFC",
    bg: "#09090B",
    card: "#17171A",
    dark: "#FFFFFF",
    text: "#F8FAFC",
    muted: "#94A3B8",
  },
  gold: {
    primary: "#D4AF37",
    secondary: "#A67C00",
    accent: "#FDFBF7",
    bg: "#FAFAF7",
    card: "#FFFFFF",
    dark: "#110E0A",
    text: "#241E15",
    muted: "#8C7A61",
  },
  silver: {
    primary: "#E2E8F0",
    secondary: "#94A3B8",
    accent: "#F8FAFC",
    bg: "#F1F5F9",
    card: "#FFFFFF",
    dark: "#0F172A",
    text: "#1E293B",
    muted: "#64748B",
  },
};

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

export const hoverCard = {
  rest: { y: 0, scale: 1, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)" },
  hover: {
    y: -8,
    scale: 1.02,
    boxShadow: "0 30px 60px -15px rgba(0, 0, 0, 0.15)",
    transition: { type: "spring", stiffness: 400, damping: 25 },
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
