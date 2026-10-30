import { defineConfig } from "vite";
import { resolve } from "node:path";

// BASE_PATH lo define el workflow de GitHub Pages (ej. "/trotecito-web/").
// En tu compu y en Cloudflare Pages queda en "/".
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  build: {
    target: "es2022", chunkSizeWarningLimit: 800,
    rollupOptions: { input: { main: resolve(__dirname, "index.html"), admin: resolve(__dirname, "admin.html") } },
  },
});
