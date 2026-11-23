import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const root = path.dirname(fileURLToPath(import.meta.url));

// Public origin, e.g. https://meshlink.example.com — social crawlers need absolute og:image / og:url.
// Empty default keeps index.html's %VITE_SITE_URL% placeholders from leaking into the build.
process.env.VITE_SITE_URL = (process.env.VITE_SITE_URL || "").replace(/\/$/, "");

const description = "Device to device, nothing in between. Private, instant file transfer: never uploaded, no account, any size.";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt", // the app shows an "Update available" toast instead of reloading mid-transfer
      includeAssets: ["favicon.ico", "favicon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        id: "/",
        name: "MeshLink — Private file transfer",
        short_name: "MeshLink",
        description,
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#0b0c12",
        theme_color: "#0b0c12",
        categories: ["productivity", "utilities"],
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Send files", short_name: "Send", url: "/send", icons: [{ src: "pwa-192x192.png", sizes: "192x192" }] },
          { name: "Receive files", short_name: "Receive", url: "/receive", icons: [{ src: "pwa-192x192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        globIgnores: ["og-image.png"], // only crawlers need it
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/, /^\/health/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(root, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/health": "http://localhost:3000",
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
