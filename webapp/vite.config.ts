import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    fs: {
      // Allow serving files from the solver-wasm/pkg directory
      allow: [".."],
    },
    headers: {
      // Enable Cross-Origin-Embedder-Policy for SharedArrayBuffer support
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  optimizeDeps: {
    exclude: ["@/../solver-wasm/pkg"],
  },
  assetsInclude: ["**/*.wasm"],
});
