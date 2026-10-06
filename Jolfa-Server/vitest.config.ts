import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    /**
     * No credential that reaches a real third party may be live in a test run.
     *
     * This has to be declared here rather than cleared in test/setup.ts.
     * `src/index.ts` starts with `import "dotenv/config"`, which runs the first
     * time a test builds the app — after setup.ts — so a variable deleted there
     * is simply loaded again from the env file. dotenv never overwrites a key
     * that is already present, and an empty string counts as present, so
     * setting them here is what actually wins.
     *
     * A real SMS.ir key was found in `.env.test` on a developer machine, which
     * pointed the whole suite at the customer's live account: three
     * password-reset tests failed because a configured provider stops the reset
     * code coming back for local verification, and any path not stubbed at
     * `fetch` would have spent real credit and texted a stranger.
     *
     * A test that needs one of these sets it itself, per case, with a fake.
     */
    env: {
      DOTENV_CONFIG_PATH: ".env.test",
      SMS_IR_API_KEY: "",
      SMS_IR_OTP_TEMPLATE_ID: "",
      SMS_SENDER_NUMBER: "",
    },
    testTimeout: 20000,
    hookTimeout: 30000,
    // Tests share a single real Postgres test database (truncated between
    // tests), so files must not run concurrently against it.
    fileParallelism: false,
  },
});
