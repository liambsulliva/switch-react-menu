import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite is used purely for browser previewing
// NRO is handled with a separate ESBuild pipeline
const siteBase =
  process.env.SITE_BASE_PATH?.replace(/\/?$/, "/") ??
  process.env.GITHUB_PAGES_BASE?.replace(/\/?$/, "/") ??
  "/";

export default defineConfig({
  root: ".",
  base: siteBase,
  publicDir: "public",
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: "dist/browser",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: true,
  },
  // Keep the Switch entrypoint out of dependency optimization
  optimizeDeps: {
    entries: ["src/browser/main.tsx"],
  },
});
