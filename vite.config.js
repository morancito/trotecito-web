import { defineConfig } from "vite";
import { resolve } from "node:path";

// El sitio vive en la raíz del dominio. BASE_PATH solo hace falta si se publica dentro de una carpeta.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  build: {
    target: "es2022", chunkSizeWarningLimit: 800,
    rollupOptions: { input: { main: resolve(__dirname, "index.html"), admin: resolve(__dirname, "admin.html"), herramientas: resolve(__dirname, "herramientas.html") } },
  },
});
