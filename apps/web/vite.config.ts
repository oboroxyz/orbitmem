import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

/**
 * Patch rolldown's CJS interop runtime for CF Workers.
 * Rolldown emits `createRequire(import.meta.url)` which fails because
 * `import.meta.url` is undefined in Workers validation. We replace it
 * with a file:// URL so createRequire succeeds.
 */
function patchCreateRequire(): Plugin {
  return {
    name: "patch-create-require",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.code.includes("createRequire(import.meta.url)")) {
          chunk.code = chunk.code.replace(
            /createRequire\(import\.meta\.url\)/g,
            'createRequire("file:///worker.mjs")',
          );
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      srcDirectory: "app",
    }),
    react(),
    patchCreateRequire(),
  ],
  resolve: {
    alias: {
      pino: path.resolve(__dirname, "app/lib/pino-noop.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "/v1"),
      },
    },
  },
});
