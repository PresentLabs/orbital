import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import { randomUUID } from "node:crypto";

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL,
  output: "server",
  adapter: node({ mode: "standalone" }),
  devToolbar: { enabled: false },
  server: { host: "127.0.0.1", port: 4345 },
  vite: {
    build: { cssTarget: "safari15.4" },
    define: { "import.meta.env.PUBLIC_ORBITA_BUILD": JSON.stringify(randomUUID()) },
    optimizeDeps: { exclude: ["pdfjs-dist"] },
  },
});
