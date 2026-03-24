import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import ui from "@nuxt/ui/vite";

export default defineConfig({
  plugins: [vue(), ui()],
  define: {
    "import.meta": {},
  },
  optimizeDeps: {
    include: [
      "@nuxt/ui > prosemirror-state",
      "@nuxt/ui > prosemirror-transform",
      "@nuxt/ui > prosemirror-model",
      "@nuxt/ui > prosemirror-view",
      "@nuxt/ui > prosemirror-gapcursor",
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  build: {
    // Worker and wasm assets are intentionally large in this project.
    chunkSizeWarningLimit: 2500,
  },
  test: {
    environment: "node",
    pool: "threads",
    maxWorkers: 1,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/composables/**/*.ts", "src/utils/**/*.ts", "src/components/**/*.vue"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
