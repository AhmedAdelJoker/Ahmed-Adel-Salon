/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",

  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],

  theme: {
    // ============================================================
    // RESPONSIVE BREAKPOINTS — 4-tier scale (320 / 768 / 1024 / 1440)
    // ============================================================
    screens: {
      xs: "480px",     // small phones
      sm: "640px",     // large phones
      md: "768px",     // tablets
      lg: "1024px",    // small laptops
      xl: "1280px",    // desktops
      "2xl": "1440px", // large desktops
      "3xl": "1920px", // ultra-wide
    },

    extend: {
      // ============================================================
      // BACKGROUNDS
      // ============================================================
      backgroundColor: {
        main: "var(--bg-main)",
      },

      // ============================================================
      // TYPOGRAPHY (Arabic + Latin)
      // ============================================================
      fontFamily: {
        sans: ["Alexandria", "IBM Plex Sans Arabic", "Cairo", "sans-serif"],
        display: ["Alexandria", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Display scale
        "display-2xl": ["3.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-xl": ["2.75rem", { lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "700" }],
        "display-lg": ["2.25rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        "display-md": ["1.875rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "display-sm": ["1.5rem", { lineHeight: "1.4", fontWeight: "600" }],
        // Body scale
        "body-lg": ["1.0625rem", { lineHeight: "1.6" }],
        "body-md": ["0.9375rem", { lineHeight: "1.55" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.5" }],
        "body-xs": ["0.6875rem", { lineHeight: "1.45", letterSpacing: "0.02em" }],
      },

      // ============================================================
      // COLORS — Brand + Semantic
      // ============================================================
      colors: {
        // Base
        background: "var(--bg-main)",
        foreground: "var(--text-main)",

        card: "var(--bg-card)",
        soft: "var(--bg-soft)",
        elevated: "var(--bg-elevated)",

        primary: "var(--primary)",
        "primary-soft": "var(--primary-soft)",
        "primary-strong": "var(--primary-strong)",
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

      // ============================================================
      // SPACING — 4px-based scale
      // ============================================================
      spacing: {
        "section": "4rem",        // 64px — between major sections
        "subsection": "2.5rem",   // 40px — between subsections
        "gutter": "1.5rem",       // 24px — between cards/blocks
        "tight": "0.5rem",        // 8px — within a component
        "tighter": "0.25rem",     // 4px — within tight groups
      },

      // ============================================================
      // BORDER RADIUS
      // ============================================================
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
        premium: "26px",
      },

      // ============================================================
      // SHADOWS / ELEVATION
      // ============================================================
      boxShadow: {
        soft: "var(--shadow-soft)",
        premium: "var(--shadow-premium)",
        accent: "var(--shadow-accent)",
        "elevation-1": "0 1px 2px 0 rgba(0,0,0,.05)",
        "elevation-2": "0 2px 4px -1px rgba(0,0,0,.06), 0 4px 6px -1px rgba(0,0,0,.04)",
        "elevation-3": "0 4px 6px -2px rgba(0,0,0,.07), 0 10px 15px -3px rgba(0,0,0,.05)",
        "elevation-4": "0 10px 25px -5px rgba(0,0,0,.08), 0 8px 10px -6px rgba(0,0,0,.05)",
      },

      // ============================================================
      // TRANSITIONS / ANIMATION
      // ============================================================
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
        snappy: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-up": "slideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-down": "slideDown 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },

      // ============================================================
      // Z-INDEX SCALE
      // ============================================================
      zIndex: {
        dropdown: "100",
        sticky: "200",
        fixed: "300",
        "modal-backdrop": "400",
        modal: "500",
        popover: "600",
        tooltip: "700",
        toast: "800",
      },
    },
  },

  plugins: [],
};
