import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Single source of truth for the dev/preview API proxy.
 * Kept as an object so `server` and `preview` cannot drift apart.
 */
const API_PROXY = {
  "/api": {
    target: "http://localhost:8000",
    changeOrigin: true,
    secure: false,
  },
  // Uploaded media — barber photos, service images, the logo — is served by the
  // API on /uploads, not by the site. Without this entry the dev server's SPA
  // fallback answers `/uploads/foo.jpg` with index.html, so the browser gets
  // 4.4 kB of HTML where it expected an image and every tenant picture renders
  // as a broken-image icon even though the file is on disk.
  "/uploads": {
    target: "http://localhost:8000",
    changeOrigin: true,
    secure: false,
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    },
  },
  build: {
    target: "es2020",
    cssMinify: true,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        /**
         * Split the long-lived vendor code out of the app entry so a UI
         * change does not invalidate ~340 kB of framework JS in every
         * visitor's cache.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) {
            return "vendor-motion";
          }
          if (id.includes("react-router") || id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) {
            return "vendor-react";
          }
          if (id.includes("axios") || id.includes("follow-redirects") || id.includes("form-data")) {
            return "vendor-http";
          }
          return "vendor";
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    proxy: API_PROXY,
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: API_PROXY,
  },
});
