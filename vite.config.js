import { defineConfig } from "vite";

// BASE_PATH lo define el workflow de GitHub Pages (ej. "/rodaje-web/").
// En tu compu y en Cloudflare Pages queda en "/".
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  build: { target: "es2022", chunkSizeWarningLimit: 800 },
});
