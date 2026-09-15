import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

Object.assign(process.env, loadEnv("test", process.cwd(), ""));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
