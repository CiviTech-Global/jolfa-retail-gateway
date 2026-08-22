import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    // Tests share a single real Postgres test database (truncated between
    // tests), so files must not run concurrently against it.
    fileParallelism: false,
  },
});
