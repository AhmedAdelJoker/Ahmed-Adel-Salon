import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";
import jsxA11y from "eslint-plugin-jsx-a11y";

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
  // Feature boundary: features should import through barrel exports
  {
    files: ["src/features/**/*.{ts,tsx}"],
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
              group: ["@/features/*/components/*", "@/features/*/services/*"],
              message: "Feature internal modules are private. Import through the feature barrel (@/features/<name>) instead.",
            },
          ],
        },
      ],
    },
  },
];
