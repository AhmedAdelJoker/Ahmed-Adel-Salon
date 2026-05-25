import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const chunkGroups = [
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

function resolveManualChunk(id) {
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
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": "/src",
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,

    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
