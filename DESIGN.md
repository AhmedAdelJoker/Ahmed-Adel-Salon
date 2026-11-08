# DESIGN.md — Salon Pro Design System

> Auto-generated from the codebase by `/impeccable document`. Source of truth for visual
> identity: `frontend/src/styles/tokens.css` (values) + `frontend/tailwind.config.js` (utility names).
> This file captures what exists, not what is planned.

---

## 1) Platform & Users

- **Platform**: Web (Vite 8 + React 19 + TypeScript). Optional Electron wrapper around the same web build (not a native design language). Public site deploys separately (Netlify/Vercel).
- **Primary language**: Arabic (RTL) — default; English (LTR) fully supported. Every screen must work in both directions.
- **Users**: Salon staff (owner, manager, cashier/front desk, barbers, accountant) + customer-facing public site.
- **WCAG target**: 2.1 AA.

---

## 2) Aesthetic Direction

**"Royal OS" — Modern Tech**

A premium, Arabic-first salon operating system. The visual identity is dark-leaning, indigo-accented, and editorial. Three coexisting surfaces:

| Surface | Character | Location |
|---------|-----------|----------|
| **ERP (front desk + back office)** | Dense data, tables, cards, charts, RTL-first | `frontend/src/pages/cashier/**`, `frontend/src/pages/owner/**` |
| **Public site** | Light default, editorial, serif typography, marketing-focused | `public-site/` |
| **Mockups** | Static HTML design explorations | `DESIGN_MOCKUP*.html` (root) |

**Key traits:**
- Arabic-first: IBM Plex Sans Arabic leads the body stack; Alexandria leads display.
- RTL-native: logical properties (`ms-*`, `pe-*`, `border-s-*`, `start-*`, `end-*`) are mandatory. Physical utilities (`ml-*`, `pr-*`, `border-l-*`) are banned by `rtl-logical-spacing.test.ts`.
- Swappable accent: `indigo` (default), `violet`, `cyan`, `emerald`, `gold` via `[data-accent]`.
- Theme: light/dark via `[data-theme]` + `.dark` class.
- Density: compact / comfortable / spacious via `[data-density]`.
- Motion: reduced / normal / rich via `[data-motion]`.

---

## 3) Color System

### Ramps (raw material, 50–950 scale)

| Family | Purpose |
|--------|---------|
| **Indigo** | Primary brand accent (default Modern Tech identity) |
| **Zinc** | Neutral — cool, tuned for long reading sessions |
| **Emerald** | Success / positive |
| **Amber** | Warning / caution |
| **Rose** | Danger / destructive |
| **Sky** | Info / informational |

### Semantic tokens (the ONLY layer components may consume)

| Token | CSS Variable | Tailwind Utility |
|-------|-------------|-----------------|
| Canvas surface | `--surface-canvas` | `canvas` |
| Sunken surface | `--surface-sunken` | `sunken` |
| Raised surface | `--surface-raised` | `raised` |
| Overlay surface | `--surface-overlay` | `overlay` |
| Glass surface | `--surface-glass` | `glass` |
| Inset surface | `--surface-inset` | `inset` |
| Primary content | `--content-primary` | `content` |
| Secondary content | `--content-secondary` | `content-secondary` |
| Tertiary content | `--content-tertiary` | `content-tertiary` |
| Disabled content | `--content-disabled` | `content-disabled` |
| Accent content | `--content-accent` | `content-accent` |
| Default line | `--line-default` | `line` |
| Subtle line | `--line-subtle` | `line-subtle` |
| Strong line | `--line-strong` | `line-strong` |
| Accent line | `--line-accent` | `line-accent` |
| Accent glow | `--glow-accent` | `glow` / `accent` shadow |

### v1 legacy aliases (still referenced by 365 unmigrated files)

| v1 Name | v2 Equivalent |
|---------|---------------|
| `background` | `canvas` |
| `foreground` | `content` |
| `card` | `raised` |
| `soft` | `sunken` |
| `elevated` | `raised` |
| `main` | `content` |
| `muted` | `content-tertiary` |
| `primary` | `accent` |
| `secondary` | `neutral` |
| `border` | `line` |

### Status semantics (Okabe-Ito derived, colour-blind safe)

| Status | Token | Tailwind |
|--------|-------|----------|
| Success | `--status-success` | `success` |
| Warning | `--status-warning` | `warning` |
| Danger | `--status-danger` | `danger` |
| Info | `--status-info` | `info` |
| Neutral | `--status-neutral` | `neutral` |

Each status has bg/content/line variants: `success.bg`, `success.content`, `success.line`.

### Accent system (swappable)

Accent colours are applied via `[data-accent]` attribute on the root element. Five options:
- `indigo` (default, Modern Tech identity)
- `violet`
- `cyan`
- `emerald`
- `gold`

### Theme

- Light: `data-theme="light"` (default)
- Dark: `data-theme="dark"` + `.dark` class on root
- Both must be set together — they must never diverge.

---

## 4) Typography

### Font families

| Token | Stack | Usage |
|-------|-------|-------|
| `font-sans` | IBM Plex Sans Arabic → Alexandria → Cairo → system-ui | Body text (Arabic primary) |
| `font-display` | Alexandria → IBM Plex Sans Arabic → system-ui | Headings, titles |
| `font-mono` | JetBrains Mono → ui-monospace → Menlo | Code, numbers, tabular data |

### Fluid type scale

| Token | Size | Line height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `display-2xl` | clamp(2.25rem → 3.5rem) | 1.08 | 700 | Hero titles |
| `display-xl` | clamp(1.875rem → 2.75rem) | 1.12 | 700 | Page titles |
| `display-lg` | clamp(1.625rem → 2.25rem) | 1.18 | 650 | Section titles |
| `display-md` | clamp(1.375rem → 1.875rem) | 1.25 | 600 | Sub-sections |
| `display-sm` | clamp(1.25rem → 1.5rem) | 1.3 | 600 | Card titles |
| `title-lg` | 1.125rem | 1.4 | 600 | Large labels |
| `title-md` | 1rem | 1.45 | 600 | Medium labels |
| `title-sm` | 0.9375rem | 1.45 | 600 | Small labels |
| `body-lg` | 1rem | 1.6 | 400 | Body text |
| `body-md` | 0.9375rem | 1.55 | 400 | Default body |
| `body-sm` | 0.8125rem | 1.5 | 400 | Small text |
| `body-xs` | 0.75rem | 1.45 | 400 | Captions |
| `label-lg` | 0.875rem | 1.35 | 600 | Large labels |
| `label-md` | 0.8125rem | 1.3 | 600 | Medium labels |
| `label-sm` | 0.6875rem | 1.3 | 700 | Small labels (uppercase, tracked) |

### Arabic typography notes
- Arabic text requires larger line-height than English (1.5–1.6 vs 1.3–1.4).
- Use `text-right` / `dir="rtl"` for Arabic, `text-left` / `dir="ltr"` for English.
- Prefer logical properties (`ms-*`, `pe-*`, `border-s-*`) over physical (`ml-*`, `pr-*`, `border-l-*`).

---

## 5) Spacing & Density

### Base scale
- 4px base unit (Tailwind default).
- Semantic spacing: `section` (4rem), `subsection` (2.5rem), `gutter` (1.5rem), `tight` (0.5rem), `tighter` (0.25rem).

### Density system
Three density levels controlled by `[data-density]`:
- `compact` — tighter spacing, smaller controls
- `comfortable` (default) — balanced
- `spacious` — more breathing room

Control heights: `control` (varies by density), `control-sm` (2rem), `control-lg` (3rem).

---

## 6) Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | `var(--radius-xs)` | Small chips |
| `sm` | `var(--radius-sm)` | Buttons, inputs |
| `md` | `var(--radius-md)` | Cards, panels |
| `lg` | `var(--radius-lg)` | Modals, dialogs |
| `xl` | `var(--radius-xl)` | Large cards |
| `2xl` | `var(--radius-2xl)` | Hero sections |
| `3xl` | `var(--radius-3xl)` | Full-page containers |
| `pill` | `var(--radius-pill)` | Badges, pills |
| `premium` | `var(--radius-xl)` | Legacy v1 alias |

---

## 7) Elevation

Five-step scale (`elevation-0` to `elevation-4`) + accent glow:

| Token | Tailwind | Usage |
|-------|----------|-------|
| `none` | `shadow-none` | Flat elements |
| `soft` | `shadow-soft` / `shadow-elev1` | Cards, panels |
| `elev2` | `shadow-elev2` | Dropdowns, popovers |
| `premium` | `shadow-premium` / `shadow-elev3` | Modals, important cards |
| `elev4` | `shadow-elev4` | Toasts, overlays |
| `accent` | `shadow-accent` / `shadow-glow` | Primary action buttons |
| `inner-top` | `shadow-inner-top` | Inset highlights |

---

## 8) Responsive Breakpoints

| Token | Width | Target |
|-------|-------|--------|
| `xs` | 480px | Small phones |
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1440px | Large desktops |
| `3xl` | 1920px | Ultra-wide |

---

## 9) Motion & Animation

### Timing functions
- `smooth` — `var(--ease-out)` — default for most transitions
- `snappy` — `var(--ease-spring)` — for interactive elements
- `standard` — `var(--ease-in-out)` — for symmetric transitions

### Durations
- `fast` — `var(--duration-fast)` — micro-interactions
- `base` — `var(--duration-base)` — standard transitions
- `slow` — `var(--duration-slow)` — page transitions

### Keyframe animations
- `fade-in` — opacity 0 → 1
- `scale-in` — scale 0.96 → 1 with spring
- `slide-up` — translate-y from bottom
- `slide-down` — translate-y from top
- `shimmer` — loading skeleton effect

### Motion preference
- `reduced` — minimal motion (accessibility)
- `normal` (default) — standard
- `rich` — enhanced animations

---

## 10) Z-Index Scale

Named tokens (never use `z-[9999]`):

| Token | Usage |
|-------|-------|
| `base` | Default |
| `raised` | Elevated elements |
| `sticky` | Sticky headers |
| `drawer` | Side drawers |
| `overlay` / `modal-backdrop` | Modal backdrops |
| `modal` | Modal content |
| `popover` / `dropdown` | Popovers, dropdowns |
| `tooltip` | Tooltips |
| `toast` | Toast notifications |

---

## 11) Component Patterns

### Page Shell
Every page uses `<PageShell>` with optional `<PageHeader>` containing:
- `title`, `subtitle`, `badge`, `icon`, `actions`

### Cards
- Use `rounded-2xl` or `rounded-3xl` for containers
- `bg-card` for background, `border border-border` for borders
- `shadow-sm` or `shadow-premium` for elevation
- Hover: `hover:border-accent/40 hover:shadow-md`

### Buttons
- Variants: `primary`, `secondary`, `outline`, `ghost`, `danger`, `dangerSoft`, `success`, `successSoft`, `warning`, `warningSoft`, `premium`, `gold`
- Sizes: `sm`, `md`, `lg`, `icon`
- Always use logical padding: `px-*` with `ms-*`/`me-*` for icons

### Badges
- Rounded: `rounded-lg` or `rounded-xl`
- Sizes: `text-[8px]` to `text-[10px]`
- Variants: color + bg from status tokens

### Inputs
- `h-12 rounded-xl bg-soft border-border/60`
- Focus: `focus:border-accent focus:ring-0`
- RTL: `pe-11` (padding-end) for search icons

### Tables
- `text-right` for Arabic (RTL)
- `text-left` for English (LTR)
- Prefer logical: `text-start`, `text-end`

### Dialogs
- `rounded-2xl` or `rounded-3xl`
- `max-w-md` to `max-w-2xl`
- Header with icon + title + description
- Footer with cancel/confirm buttons

### Empty States
- Use `<EmptyState>` component
- Icon (muted, large), title, hint, optional action button

### Loading States
- Use `<LoadingState variant="page" label="..." />`
- Skeleton placeholders for content areas

---

## 12) i18n & RTL Rules

1. **Every user-facing string must use `t("namespace.key")`** — no hardcoded Arabic/English.
2. **Namespaces**: `common`, `appearance`, `pos`, `reception`, `bookings`, `schedule`, `customers` (pending).
3. **Parity test**: `src/test/i18n.test.ts` enforces identical key sets across locales.
4. **RTL/LTR**: Use logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `border-s-*`, `border-e-*`, `start-*`, `end-*`). Physical utilities (`ml-*`, `mr-*`, `pl-*`, `pr-*`, `border-l-*`, `border-r-*`) are banned by `rtl-logical-spacing.test.ts`.
5. **Date/Time**: Use `i18n.language === "ar" ? "ar-EG" : "en-US"` for locale-aware formatting. Never hardcode `ar-EG`.
6. **Numbers**: Arabic numerals (٠١٢٣٤٥٦٧٨٩) in Arabic mode, Western digits in English mode.

---

## 13) Dark Mode

- Toggle via `data-theme="dark"` + `.dark` class on `<html>`.
- All colours resolve through CSS variables — flipping the theme re-themes everything.
- Canvas paint guard in `index.html` prevents black flash on reload.
- `color-scheme` meta tag updated dynamically.

---

## 14) Accessibility (WCAG 2.1 AA)

- All interactive elements need `aria-label` or visible text.
- Icon-only buttons need `aria-label` + `title`.
- Tables need `scope` on headers (currently missing in some places).
- Clickable rows need `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space).
- Chip/filter buttons need `aria-pressed`.
- Form inputs need associated `<label>` elements.
- Loading states need `aria-live="polite"`.
- Reduced motion: respect `prefers-reduced-motion`.

---

## 15) Known Issues & Gaps

1. **i18n not complete**: Only `bookings` and `schedule` namespaces are fully translated. `pos`, `reception` are partially done. `customers`, `owner/*`, `manager/*` pages still have hardcoded Arabic.
2. **Two design generations coexist**: v1 (`primary`, `soft`, `main`, `muted`) and v2 (`accent`, `canvas`, `content`, `line`) — 365 files still use v1 names.
3. **Physical spacing utilities**: 145 baseline instances of `ml-*`, `pr-*`, etc. still exist (tracked by `rtl-logical-spacing.test.ts`).
4. **No visual regression gate**: No automated screenshot/visual comparison tests.
5. **Mockup files in root**: `DESIGN_MOCKUP*.html` are isolated design explorations, not part of the app.
6. **Duplicate Settings pages**: `common/Settings.tsx` + `owner/Settings.tsx` + `BusinessSettingsPage` — information architecture is heavy.
7. **No DESIGN.md previously**: This file is new — the design system was undocumented.

---

## 16) File Locations

| Concern | Location |
|---------|----------|
| Design tokens (CSS variables) | `frontend/src/styles/tokens.css` |
| Tailwind config (utility names) | `frontend/tailwind.config.js` |
| Theme bootstrap | `frontend/index.html` (inline script) |
| i18n entry point | `frontend/src/i18n/index.ts` |
| Locale files | `frontend/src/i18n/locales/{ar,en}/*.json` |
| Shared components | `frontend/src/components/shared/` |
| UI primitives | `frontend/src/components/ui/` |
| RTL guard test | `frontend/src/test/rtl-logical-spacing.test.ts` |
| i18n parity test | `frontend/src/test/i18n.test.ts` |
| Design mockups | `DESIGN_MOCKUP*.html` (root) |

---

*This document was generated by `/impeccable document` based on the codebase state as of Nov 2026.*
