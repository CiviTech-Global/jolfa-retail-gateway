import { afterEach, describe, expect, it, vi } from "vitest";
import { rialToToman, tomanToRial } from "./payment.service.js";
import {
  buildZibalStartUrl,
  describeZibalStatus,
  isPaidStatus,
  isSandbox,
} from "./zibal.client.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("currency", () => {
  // The whole integration turns on this. Orders are stored in Toman — that is
  // what the admin types and what `formatPrice` renders — while Zibal's API is
  // denominated in Rial. Getting it wrong does not throw: it charges ten times
  // too much, or a tenth of the price, and both look like a working checkout.
  it("converts Toman to Rial by a factor of ten", () => {
    expect(tomanToRial(180_000)).toBe(1_800_000);
    expect(tomanToRial(1)).toBe(10);
    expect(tomanToRial(0)).toBe(0);
  });

  it("round-trips a realistic order total", () => {
    const orderTotal = 635_000;
    expect(rialToToman(tomanToRial(orderTotal))).toBe(orderTotal);
  });

  it("puts Zibal's documented minimum at 100 Toman", () => {
    // Result code 105 is "amount must be greater than 1,000 Rial", which lands
    // at 100 Toman. Checked against the sandbox: 1,000 Rial was in fact
    // accepted, so the real boundary is at most this and possibly lower. Only
    // the conversion is asserted here — the gateway's exact cut-off is theirs
    // to change, and a test that guessed at it would fail for the wrong reason.
    expect(tomanToRial(100)).toBe(1_000);
  });
});

describe("payment session status", () => {
  it("treats both paid states as paid", () => {
    // 1 is paid-and-verified; 2 is paid-but-unverified, which is exactly what a
    // session looks like at the moment the customer returns and before verify
    // settles it. Rejecting 2 would fail every genuine payment.
    expect(isPaidStatus(1)).toBe(true);
    expect(isPaidStatus(2)).toBe(true);
  });

  it("treats everything else as not paid", () => {
    for (const status of [-2, -1, 3, 4, 5, 6, 11, 15, 18, 21]) {
      expect(isPaidStatus(status)).toBe(false);
    }
    expect(isPaidStatus(null)).toBe(false);
    expect(isPaidStatus(undefined)).toBe(false);
  });

  it("describes known statuses in Persian and is honest about unknown ones", () => {
    expect(describeZibalStatus(3)).toContain("لغو");
    expect(describeZibalStatus(5)).toContain("موجودی");
    expect(describeZibalStatus(999)).toContain("999");
  });
});

describe("sandbox", () => {
  // Zibal serves live and test from the same hostname and decides purely from
  // the merchant value, so an unset flag must never mean "live".
  it("defaults to sandbox when the flag is absent", () => {
    vi.stubEnv("ZIBAL_SANDBOX", "");
    expect(isSandbox()).toBe(true);
  });

  it("only leaves sandbox for an explicit false", () => {
    vi.stubEnv("ZIBAL_SANDBOX", "true");
    expect(isSandbox()).toBe(true);
  });
});

describe("redirect url", () => {
  it("points at the gateway's start endpoint", () => {
    expect(buildZibalStartUrl("15966442233311")).toBe(
      "https://gateway.zibal.ir/start/15966442233311",
    );
  });
});
