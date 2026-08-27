import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `env` is parsed once at import time, so each case re-imports the service with
 * a patched module registry rather than mutating `process.env` after the fact.
 */
async function loadWithEnv(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  const actual = await vi.importActual<typeof import("../../config/env.js")>("../../config/env.js");
  vi.doMock("../../config/env.js", () => ({
    env: { ...actual.env, ...overrides },
  }));
  return import("./payment.service.js");
}

afterEach(() => {
  vi.doUnmock("../../config/env.js");
  vi.resetModules();
});

describe("ZarinPal gateway URLs", () => {
  it("uses the sandbox host for both the API and the redirect", async () => {
    const { getGatewayConfig, buildPaymentUrl } = await loadWithEnv({
      ZIBAL_MERCHANT_ID: undefined,
      ZARINPAL_SANDBOX: "true",
    });

    const config = getGatewayConfig();
    expect(config.gateway).toBe("ZARINPAL");
    expect(config.apiBase).toBe("https://sandbox.zarinpal.com/pg/v4");
    expect(buildPaymentUrl(config, "A00001")).toBe(
      "https://sandbox.zarinpal.com/pg/StartPay/A00001",
    );
  });

  it("uses the live host for both the API and the redirect", async () => {
    const { getGatewayConfig, buildPaymentUrl } = await loadWithEnv({
      ZIBAL_MERCHANT_ID: undefined,
      ZARINPAL_SANDBOX: "false",
      ZARINPAL_MERCHANT_ID: "11111111-2222-3333-4444-555555555555",
    });

    const config = getGatewayConfig();
    expect(config.apiBase).toBe("https://api.zarinpal.com/pg/v4");
    expect(buildPaymentUrl(config, "A00001")).toBe("https://www.zarinpal.com/pg/StartPay/A00001");
  });

  it("never sends a live-minted authority to the sandbox", async () => {
    // The original bug: apiBase honoured the flag, the redirect did not, so a
    // real order was created against the live API and then paid in the sandbox.
    const { getGatewayConfig, buildPaymentUrl } = await loadWithEnv({
      ZIBAL_MERCHANT_ID: undefined,
      ZARINPAL_SANDBOX: "false",
      ZARINPAL_MERCHANT_ID: "11111111-2222-3333-4444-555555555555",
    });

    const config = getGatewayConfig();
    expect(buildPaymentUrl(config, "A00001")).not.toContain("sandbox");
  });
});

describe("Zibal gateway URLs", () => {
  it("pairs the Zibal API base with the Zibal redirect", async () => {
    const { getGatewayConfig, buildPaymentUrl } = await loadWithEnv({
      ZIBAL_MERCHANT_ID: "zibal-merchant",
    });

    const config = getGatewayConfig();
    expect(config.gateway).toBe("ZIBAL");
    expect(config.apiBase).toBe("https://gateway.zibal.ir/v1");
    expect(buildPaymentUrl(config, "TRK9")).toBe("https://gateway.zibal.ir/start/TRK9");
  });

  it("ignores ZARINPAL_SANDBOX when Zibal is the active gateway", async () => {
    const { getGatewayConfig, buildPaymentUrl } = await loadWithEnv({
      ZIBAL_MERCHANT_ID: "zibal-merchant",
      ZARINPAL_SANDBOX: "true",
    });

    expect(buildPaymentUrl(getGatewayConfig(), "TRK9")).not.toContain("zarinpal");
  });
});
