/**
 * Tailwind bridge (v3-style config consumed by Tailwind v4 through
 * `@config "../../tailwind.config.js"` in src/styles/index.css).
 *
 * Division of labour with the CSS token layer:
 *   tokens.css  owns the custom property VALUES (ramps, semantics, depth)
 *   this file   owns the UTILITY NAMES that map onto them
 *
 * Rule: a colour may only be declared here as `var(--token)`. Never as a
 * hex literal — that is how the codebase ended up with 1,600+ off-token
 * `slate-*` / `emerald-*` references that ignored the theme entirely.
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',

  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

  theme: {
    // ============================================================
    // RESPONSIVE BREAKPOINTS
    // ============================================================
    screens: {
      xs: '480px', // small phones
      sm: '640px', // large phones
      md: '768px', // tablets
      lg: '1024px', // small laptops
      xl: '1280px', // desktops
      '2xl': '1440px', // large desktops
      '3xl': '1920px', // ultra-wide
    },

    extend: {
      // ============================================================
      // TYPOGRAPHY
      // Arabic is the primary locale, so IBM Plex Sans Arabic leads the
      // body stack; Alexandria (geometric, tighter) leads display. The
      // system fallbacks matter for the Electron offline boot, where the
      // Google Fonts request may not have resolved.
      // ============================================================
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'Alexandria', 'Cairo', 'system-ui', 'sans-serif'],
        display: ['Alexandria', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      // Fluid scale: `clamp()` keeps a 360px phone and a 1440px desktop
      // readable without a single breakpoint. `min` is the phone floor,
      // `max` the desktop ceiling, the middle term is the preferred value.
      fontSize: {
        'display-2xl': ['clamp(2.25rem, 1.5rem + 3.5vw, 3.5rem)', { lineHeight: '1.08', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-xl': ['clamp(1.875rem, 1.4rem + 2.2vw, 2.75rem)', { lineHeight: '1.12', letterSpacing: '-0.025em', fontWeight: '700' }],
        'display-lg': ['clamp(1.625rem, 1.35rem + 1.3vw, 2.25rem)', { lineHeight: '1.18', letterSpacing: '-0.02em', fontWeight: '650' }],
        'display-md': ['clamp(1.375rem, 1.2rem + 0.8vw, 1.875rem)', { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '600' }],
        'display-sm': ['clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem)', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],

        'title-lg': ['1.125rem', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '600' }],
        'title-md': ['1rem', { lineHeight: '1.45', letterSpacing: '-0.005em', fontWeight: '600' }],
        'title-sm': ['0.9375rem', { lineHeight: '1.45', fontWeight: '600' }],

        'body-lg': ['1rem', { lineHeight: '1.6' }],
        'body-md': ['0.9375rem', { lineHeight: '1.55' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.5' }],
        'body-xs': ['0.75rem', { lineHeight: '1.45', letterSpacing: '0.01em' }],

        'label-lg': ['0.875rem', { lineHeight: '1.35', fontWeight: '600' }],
        'label-md': ['0.8125rem', { lineHeight: '1.3', fontWeight: '600' }],
        'label-sm': ['0.6875rem', { lineHeight: '1.3', letterSpacing: '0.04em', fontWeight: '700' }],
      },

      // ============================================================
      // COLOURS
      //
      // Three generations coexist on purpose:
      //   1. `zinc-*` / `accent-*`  — the v2 ramps (new code)
      //   2. `canvas`…`neutral-*`  — the v2 semantic layer (new code)
      //   3. `primary`…`info`       — the v1 names (365 files, migrating)
      // Everything resolves through tokens.css, so flipping the theme or
      // swapping the accent re-themes all three at once.
      // ============================================================
      colors: {
        // -- 1. ramps -------------------------------------------------
        accent: {
          50: 'var(--accent-50)',
          100: 'var(--accent-100)',
          200: 'var(--accent-200)',
          300: 'var(--accent-300)',
          400: 'var(--accent-400)',
          500: 'var(--accent-500)',
          600: 'var(--accent-600)',
          700: 'var(--accent-700)',
          800: 'var(--accent-800)',
          900: 'var(--accent-900)',
          950: 'var(--accent-950)',
          DEFAULT: 'var(--accent-500)',
        },
        zinc: {
          50: 'var(--zinc-50)',
          100: 'var(--zinc-100)',
          200: 'var(--zinc-200)',
          300: 'var(--zinc-300)',
          400: 'var(--zinc-400)',
          500: 'var(--zinc-500)',
          600: 'var(--zinc-600)',
          700: 'var(--zinc-700)',
          800: 'var(--zinc-800)',
          900: 'var(--zinc-900)',
          950: 'var(--zinc-950)',
        },
        success: {
          DEFAULT: 'var(--status-success)',
          bg: 'var(--status-success-bg)',
          content: 'var(--status-success-content)',
          line: 'var(--status-success-line)',
        },
        warning: {
          DEFAULT: 'var(--status-warning)',
          bg: 'var(--status-warning-bg)',
          content: 'var(--status-warning-content)',
          line: 'var(--status-warning-line)',
        },
        danger: {
          DEFAULT: 'var(--status-danger)',
          bg: 'var(--status-danger-bg)',
          content: 'var(--status-danger-content)',
          line: 'var(--status-danger-line)',
        },
        info: {
          DEFAULT: 'var(--status-info)',
          bg: 'var(--status-info-bg)',
          content: 'var(--status-info-content)',
          line: 'var(--status-info-line)',
        },
        neutral: {
          DEFAULT: 'var(--status-neutral)',
          bg: 'var(--status-neutral-bg)',
          content: 'var(--status-neutral-content)',
          line: 'var(--status-neutral-line)',
        },
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
          6: 'var(--chart-6)',
          7: 'var(--chart-7)',
          8: 'var(--chart-8)',
        },

        // -- 2. semantic surfaces & content ---------------------------
        canvas: 'var(--surface-canvas)',
        sunken: 'var(--surface-sunken)',
        raised: 'var(--surface-raised)',
        overlay: 'var(--surface-overlay)',
        glass: 'var(--surface-glass)',
        inset: 'var(--surface-inset)',

        content: {
          DEFAULT: 'var(--content-primary)',
          secondary: 'var(--content-secondary)',
          tertiary: 'var(--content-tertiary)',
          disabled: 'var(--content-disabled)',
          inverse: 'var(--content-inverse)',
          accent: 'var(--content-accent)',
          'on-accent': 'var(--content-on-accent)',
        },

        line: {
          DEFAULT: 'var(--line-default)',
          subtle: 'var(--line-subtle)',
          strong: 'var(--line-strong)',
          accent: 'var(--line-accent)',
        },

        // -- 3. v1 names, kept alive for the 365 unmigrated files -----
        background: 'var(--bg-main)',
        foreground: 'var(--text-main)',
        card: 'var(--bg-card)',
        soft: 'var(--bg-soft)',
        elevated: 'var(--bg-elevated)',
        main: 'var(--text-main)',
        muted: 'var(--text-muted)',
        inverse: 'var(--text-inverse)',

        primary: {
          DEFAULT: 'var(--primary)',
          soft: 'var(--primary-soft)',
          subtle: 'var(--primary-subtle)',
          strong: 'var(--primary-strong)',
          muted: 'var(--primary-muted)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          soft: 'var(--secondary-soft)',
          dark: 'var(--secondary-dark)',
        },
        accentLegacy: 'var(--accent)',
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
          soft: 'var(--border-soft)',
        },
      },

      // ============================================================
      // SPACING — 4px base, plus semantic rhythm driven by [data-density]
      // ============================================================
      spacing: {
        section: '4rem',
        subsection: '2.5rem',
        gutter: '1.5rem',
        tight: '0.5rem',
        tighter: '0.25rem',
        control: 'var(--density-control-h)',
        'control-sm': '2rem',
        'control-lg': '3rem',
      },

      // ============================================================
      // BORDER RADIUS — the v2 shape language
      // ============================================================
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        pill: 'var(--radius-pill)',
        // v1 alias, still referenced by the ERP page containers
        premium: 'var(--radius-xl)',
      },

      // ============================================================
      // ELEVATION — one 5-step scale instead of ad-hoc box-shadows
      // ============================================================
      boxShadow: {
        none: 'var(--elevation-0)',
        soft: 'var(--elevation-1)',
        premium: 'var(--elevation-3)',
        accent: 'var(--glow-accent)',
        elev1: 'var(--elevation-1)',
        elev2: 'var(--elevation-2)',
        elev3: 'var(--elevation-3)',
        elev4: 'var(--elevation-4)',
        glow: 'var(--glow-accent)',
        'inner-top': 'var(--highlight-inner)',
      },

      // ============================================================
      // TRANSITIONS
      // ============================================================
      transitionTimingFunction: {
        smooth: 'var(--ease-out)',
        snappy: 'var(--ease-spring)',
        standard: 'var(--ease-in-out)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      animation: {
        'fade-in': 'royal-fade-in var(--duration-base) var(--ease-out) both',
        'fade-in-0': 'royal-fade-in-0 var(--duration-base) var(--ease-out) both',
        'scale-in': 'royal-scale-in var(--duration-base) var(--ease-spring) both',
        'slide-up': 'royal-slide-bottom var(--duration-base) var(--ease-out) both',
        'slide-down': 'royal-slide-top var(--duration-base) var(--ease-out) both',
        shimmer: 'royal-shimmer 1.6s linear infinite',
      },

      // ============================================================
      // Z-INDEX — named so nobody invents `z-[9999]`
      // ============================================================
      zIndex: {
        base: 'var(--z-base)',
        raised: 'var(--z-raised)',
        sticky: 'var(--z-sticky)',
        drawer: 'var(--z-drawer)',
        overlay: 'var(--z-overlay)',
        'modal-backdrop': 'var(--z-overlay)',
        modal: 'var(--z-modal)',
        popover: 'var(--z-popover)',
        dropdown: 'var(--z-popover)',
        tooltip: 'var(--z-tooltip)',
        toast: 'var(--z-toast)',
      },
    },
  },

  plugins: [],
};
