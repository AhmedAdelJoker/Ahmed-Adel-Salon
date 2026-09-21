import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import checker from "vite-plugin-checker";

const chunkGroups = [
  {
    // CSS class utilities are imported by lib/core/utils.ts, which every
    // route uses. They MUST NOT float into reports-vendor, otherwise each
    // page (including /login) downloads recharts (~84KiB wasted, LCP +0.4s).
    // A dedicated chunk (not merged into ui-vendor) is what Rolldown honors
    // deterministically here.
    name: "css-utils",
    packages: ["clsx", "tailwind-merge", "class-variance-authority"],
  },
  {
    name: "react-vendor",
    packages: ["react", "react-dom", "react-router-dom"],
  },
  {
    name: "ui-vendor",
    packages: ["axios", "lucide-react", "react-hot-toast"],
  },
  {
    name: "i18n-vendor",
    packages: [
      "i18next",
      "react-i18next",
      "i18next-browser-languagedetector",
    ],
  },
  {
    name: "reports-vendor",
    packages: ["recharts", "xlsx"],
  },
];

function resolveManualChunk(id: string) {
  for (const group of chunkGroups) {
    const matchesGroup = group.packages.some((pkg) => {
      return (
        id.includes(`/node_modules/${pkg}/`) ||
        id.includes(`\\node_modules\\${pkg}\\`)
      );
    });

    if (matchesGroup) {
      return group.name;
    }
  }

  return undefined;
}

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    checker({
      typescript: true,
      // ESLint checker disabled: vite-plugin-checker@0.7 passes removed
      // ESLint v9 options (extensions, useEslintrc...) and crashes dev server.
      // Run lint separately via `npm run lint`.
    }),
  ],

  resolve: {
    alias: {
      "@": "/src",
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          for (const group of chunkGroups) {
            const matchesGroup = group.packages.some((pkg) => {
              return (
                id.includes(`/node_modules/${pkg}/`) ||
                id.includes(`\\node_modules\\${pkg}\\`)
              );
            });

            if (matchesGroup) {
              return group.name;
            }
          }
          return undefined;
        },
      },
    },
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,

    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});