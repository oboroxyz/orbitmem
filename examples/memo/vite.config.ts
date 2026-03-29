import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "zod/mini": path.resolve(__dirname, "node_modules/zod/mini/index.js"),
      "@open-wallet-standard/core": path.resolve(__dirname, "src/stubs/ows.ts"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core", "wagmi", "@wagmi/core", "@wagmi/connectors"],
  },
  build: {
    target: "esnext",
  },
  server: {
    port: 5174,
  },
});
