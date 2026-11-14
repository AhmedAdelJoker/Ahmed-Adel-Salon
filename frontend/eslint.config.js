import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";
import jsxA11y from "eslint-plugin-jsx-a11y";
import { existsSync, readdirSync } from "node:fs";

// Feature boundary: a feature may use its own internals freely, and may not
// reach into another feature's.
//
// The previous version of this rule was a single block over `src/features/**`
// that banned `@/features/*/components/*` and `@/features/*/services/*`
// outright. That is not the boundary anybody wants, and it produced 195
// warnings of which 194 were wrong:
//
//   179  a feature's own `index.ts` re-exporting that feature's components.
//       Which is what a barrel is for -- a barrel that cannot re-export its own
//       feature is not a barrel, it is an obstacle.
//   15   a feature importing a sibling module of itself.
//    1   the actual thing the rule exists for: `schedule` reaching into
//       `bookings/components`.
//
// Not one of the 195 was outside `src/features/`, so the boundary the audit
// asked for -- pages and app components staying out of feature internals --
// was already satisfied, and still is. That is enforced by the block below
// which reports zero; a rule nobody has ever tripped is either right or
// ineffective, and this one is right, so the warning count is not the measure
// of whether it works.
//
// `no-restricted-imports` cannot express "any feature except this one" -- the
// glob has no negation. So the boundary is one block per feature, each naming
// the other 31. The list comes from the directory rather than a hand-kept
// array, because a boundary maintained in two places eventually guards
// nothing: a new feature would be enforced only by whoever remembered to add
// it.
const FEATURE_ROOT = "src/features";
const CROSS_FEATURE_MESSAGE =
  "Feature internals are private. Import through the feature's public API " +
  "(@/features/<name>) instead.";

const featureNames = existsSync(FEATURE_ROOT)
  ? readdirSync(FEATURE_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  : [];

const featureBoundary = featureNames.map((owner) => ({
  files: [`${FEATURE_ROOT}/${owner}/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": [
      "warn",
      {
        patterns: [
          {
            group: ["../*"],
            message: "Use the @/ alias instead of relative parent imports.",
          },
          // Every other feature's internals -- and never this one's.
          ...featureNames
            .filter((name) => name !== owner)
            .map((name) => ({
              group: [
                `@/features/${name}/components/*`,
                `@/features/${name}/services/*`,
              ],
              message: CROSS_FEATURE_MESSAGE,
            })),
        ],
      },
    ],
  },
}));

// For everything that is not a feature: pages, app-level components, hooks,
// contexts. They have no internals of their own, so the ban is unconditional.
const featureBoundaryForNonFeatures = {
  files: ["src/**/*.{ts,tsx}"],
  ignores: [`${FEATURE_ROOT}/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": [
      "warn",
      {
        patterns: [
          {
            group: ["../*"],
            message: "Use the @/ alias instead of relative parent imports.",
          },
          {
            group: [
              "@/features/*/components/*",
              "@/features/*/services/*",
            ],
            message: CROSS_FEATURE_MESSAGE,
          },
        ],
      },
    ],
  },
};

export default [
  {
    ignores: [
      "dist",
      "build",
      "node_modules",
      ".vite",
      "**/*.bak_before_frontend_fix",
      "**/*.bak_before_fix",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        location: "readonly",
        history: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        File: "readonly",
        FormData: "readonly",
        WebSocket: "readonly",
        Notification: "readonly",
        EventSource: "readonly",
        fetch: "readonly",
        console: "readonly",
        IntersectionObserver: "readonly",
        CustomEvent: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        performance: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLImageElement: "readonly",
        HTMLAudioElement: "readonly",
        HTMLVideoElement: "readonly",
        HTMLFormElement: "readonly",
        Event: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        FocusEvent: "readonly",
        TouchEvent: "readonly",
        PointerEvent: "readonly",
        ClipboardEvent: "readonly",
        InputEvent: "readonly",
        CompositionEvent: "readonly",
        MediaQueryList: "readonly",
        MediaQueryListEvent: "readonly",
        ResizeObserver: "readonly",
        MutationObserver: "readonly",
        AudioContext: "readonly",
        webkitAudioContext: "readonly",
        crypto: "readonly",
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "unused-imports": unusedImports,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/jsx-uses-vars": "error",
      "react/prop-types": "off",

      // تعطيل تحذيرات React Hooks و Fast Refresh و Any
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-explicit-any": "off",

      // إيقاف القواعد القديمة وتأكيد التنظيف التلقائي
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": "off",

      "no-useless-escape": "off",

      // Architectural boundary: absolute @/ alias only, no relative parent imports
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message: "Use the @/ alias instead of relative parent imports.",
            },
          ],
        },
      ],
    },
  },
  featureBoundaryForNonFeatures,
  ...featureBoundary,
];