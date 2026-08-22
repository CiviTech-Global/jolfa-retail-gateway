import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../config/env.js";

/**
 * Pure unit tests for env-driven gateway selection — no database, no HTTP.
 *
 * `getGatewayConfig()` reads the `env` singleton at call time, so each case
 * re-imports the service behind a mocked `config/env.js` module.
 */
async function loadWithEnv(overrides: Partial<Env>) {
  vi.resetModules();
  vi.doMock("../../config/env.js", () => ({
    env: {
      API_PREFIX: "/api/v1",
      ZARINPAL_SANDBOX: "true",
      ...overrides,
    },
  }));
  return import("./payment.service.js");
}

afterEach(() => {
  vi.doUnmock("../../config/env.js");
  vi.resetModules();
});

describe("getGatewayConfig()", () => {
  it("selects ZIBAL when ZIBAL_MERCHANT_ID is set", async () => {
    const { getGatewayConfig } = await loadWithEnv({ ZIBAL_MERCHANT_ID: "zibal-merchant" });

    const config = getGatewayConfig();

    expect(config.gateway).toBe("ZIBAL");
    expect(config.merchantId).toBe("zibal-merchant");
    expect(config.apiBase).toBe("https://gateway.zibal.ir/v1");
  });

  it("falls back to ZARINPAL when ZIBAL_MERCHANT_ID is absent", async () => {
    const { getGatewayConfig } = await loadWithEnv({ ZARINPAL_MERCHANT_ID: "zp-merchant" });

    const config = getGatewayConfig();

    expect(config.gateway).toBe("ZARINPAL");
    expect(config.merchantId).toBe("zp-merchant");
  });

  it("points ZarinPal at the sandbox host when ZARINPAL_SANDBOX is 'true'", async () => {
    const { getGatewayConfig } = await loadWithEnv({ ZARINPAL_SANDBOX: "true" });

    expect(getGatewayConfig().apiBase).toBe("https://sandbox.zarinpal.com/pg/v4");
  });

  it("points ZarinPal at the production host when ZARINPAL_SANDBOX is 'false'", async () => {
    const { getGatewayConfig } = await loadWithEnv({
      ZARINPAL_SANDBOX: "false",
      ZARINPAL_MERCHANT_ID: "zp-live",
    });

    expect(getGatewayConfig().apiBase).toBe("https://api.zarinpal.com/pg/v4");
  });

  it("uses the placeholder sandbox merchant id when none is configured", async () => {
    const { getGatewayConfig } = await loadWithEnv({ ZARINPAL_SANDBOX: "true" });

    expect(getGatewayConfig().merchantId).toBe("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
  });

  // Documents the failure mode behind gap §12: in production with no merchant
  // id configured, the merchant id silently resolves to an empty string rather
  // than the request failing loudly at startup.
  it("yields an EMPTY merchant id in non-sandbox mode with no ZARINPAL_MERCHANT_ID", async () => {
    const { getGatewayConfig } = await loadWithEnv({ ZARINPAL_SANDBOX: "false" });

    expect(getGatewayConfig().merchantId).toBe("");
  });

  it("prefers an explicit callback URL over the derived default", async () => {
    const { getGatewayConfig } = await loadWithEnv({
      ZARINPAL_CALLBACK_URL: "https://shop.example/callback",
    });

    expect(getGatewayConfig().callbackUrl).toBe("https://shop.example/callback");
  });

  it("derives a callback URL from API_PREFIX when none is configured", async () => {
    const { getGatewayConfig } = await loadWithEnv({ API_PREFIX: "/api/v1" });

    expect(getGatewayConfig().callbackUrl).toBe("/api/v1/payments/verify/zarinpal");
  });
});
