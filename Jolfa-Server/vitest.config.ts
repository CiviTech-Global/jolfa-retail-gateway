import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    // Tests share a single real Postgres test database (truncated between
    // tests), so files must not run concurrently against it.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.types.ts",
        "src/shared/types/**",
        "src/index.ts",
      ],
    },
  },
});
