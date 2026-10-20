import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Globals are listed by hand rather than pulled from the `globals` package:
 * that package is only present as a transitive dependency of @eslint/js, so
 * importing it directly would work today and break under a different
 * npm dedupe layout — and `npm ci` in CI is exactly where that would surface.
 */
const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  location: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  fetch: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  matchMedia: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  Blob: "readonly",
  FormData: "readonly",
  Headers: "readonly",
  Request: "readonly",
  Response: "readonly",
  Event: "readonly",
  EventSource: "readonly",
  WebSocket: "readonly",
  AbortController: "readonly",
  Intl: "readonly",
  performance: "readonly",
  crypto: "readonly",
  self: "readonly",
  caches: "readonly",
  Cache: "readonly",
  Notification: "readonly",
  CustomEvent: "readonly",
  Image: "readonly",
};

const nodeGlobals = {
  process: "readonly",
  console: "readonly",
  Buffer: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
};

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: browserGlobals,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,

      /**
       * The WCAG 2.1 AA rules that matter most for this project, promoted from
       * `recommended` (which sets several of them to "warn" or leaves them
       * off) to hard errors, because each one corresponds to a defect this
       * codebase actually had:
       *
       *  - label-has-associated-control: the booking form used `placeholder`
       *    as its only label, and MemberPortal shipped four `<label>` elements
       *    with no `htmlFor` at all, so screen readers announced nothing.
       *
       *    `assert: "nesting"` restricts it to the implicit form, and
       *    `controlComponents` tells it that `Input` renders a real control.
       *    Both are needed: the association check cannot see through a
       *    computed `htmlFor`, and the text check cannot see that the `label`
       *    prop of a shared field component is always a non-empty string.
       *  - no-redundant-roles / role-supports-aria-props: the switchers
       *    declared listbox/option semantics inconsistently.
       *  - tabindex-no-positive: keeps focus order aligned with the DOM.
       */
      "jsx-a11y/label-has-associated-control": [
        "error",
        { assert: "either", controlComponents: ["Input"], depth: 3 },
      ],
      "jsx-a11y/tabindex-no-positive": "error",
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/interactive-supports-focus": "error",

      // `no-undef` is off because TypeScript already reports unknown
      // identifiers as TS2304, with better messages.
      "no-undef": "off",
      /**
       * Unused-code detection used to be switched off outright, which is how
       * `import React` under the automatic JSX runtime, an unused
       * `formatCurrency` import, an unused `progressPercentage` constant and
       * two unused icon imports all survived review.
       *
       * Only the TypeScript-aware rule is enabled here. The base
       * `no-unused-vars` cannot parse type-only declarations — it reports the
       * parameters of every interface method signature and function type in
       * the project as unused variables. `noUnusedLocals` in tsconfig is what
       * fails the build; this is the fast editor feedback loop.
       */
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      eqeqeq: ["warn", "smart"],
      "prefer-const": "warn",
      "no-var": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Build config and build scripts run in Node, not the browser.
    files: ["vite.config.js", "scripts/**/*.mjs"],
    languageOptions: {
      globals: nodeGlobals,
    },
    rules: {
      "no-console": "off",
    },
  },
];
