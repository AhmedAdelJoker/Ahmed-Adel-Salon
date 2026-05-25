/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",

  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],

  theme: {
    extend: {
      backgroundColor: {
        main: "var(--bg-main)",
      },
      fontFamily: {
        sans: ["Alexandria", "sans-serif"],
      },

      colors: {
        // Base
        background: "var(--bg-main)",
        foreground: "var(--text-main)",

        card: "var(--bg-card)",
        soft: "var(--bg-soft)",
        elevated: "var(--bg-elevated)",

        primary: "var(--primary)",
        "primary-muted": "var(--primary-muted)",

        secondary: "var(--secondary)",
        "secondary-soft": "var(--secondary-soft)",
        "secondary-dark": "var(--secondary-dark)",

        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "accent-light": "var(--accent-light)",
        "accent-dark": "var(--accent-dark)",

        border: "var(--border)",
        "border-strong": "var(--border-strong)",

        // Text
        main: "var(--text-main)",
        muted: "var(--text-muted)",
        inverse: "var(--text-inverse)",

        // Semantic
        success: "var(--success)",
        "success-soft": "var(--success-soft)",

        warning: "var(--warning)",
        "warning-soft": "var(--warning-soft)",

        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",

        info: "var(--info)",
        "info-soft": "var(--info-soft)",
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
        premium: "26px",
      },

      boxShadow: {
        soft: "var(--shadow-soft)",
        premium: "var(--shadow-premium)",
        accent: "var(--shadow-accent)",
      },
    },
  },

  plugins: [],
};
