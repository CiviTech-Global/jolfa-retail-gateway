import { describe, expect, it } from "vitest";
import { prisma } from "../../shared/prisma.js";
import {
  SHIPPING_COST_DEFAULTS,
  SHIPPING_COST_KEYS,
  getShippingCosts,
  resolveShippingCost,
} from "./shipping.service.js";

async function setCost(method: "POST" | "COURIER", value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SHIPPING_COST_KEYS[method] },
    update: { value },
    create: {
      key: SHIPPING_COST_KEYS[method],
      value,
      group: "shipping",
      isPublic: true,
      description: "test",
    },
  });
}

describe("shipping costs", () => {
  it("falls back to the previous hard-coded figures when unset", async () => {
    expect(await getShippingCosts()).toEqual(SHIPPING_COST_DEFAULTS);
  });

  it("uses what the shop owner set", async () => {
    await setCost("POST", "45000");
    await setCost("COURIER", "210000");

    expect(await resolveShippingCost("POST")).toBe(45_000);
    expect(await resolveShippingCost("COURIER")).toBe(210_000);
  });

  it("accepts free delivery", async () => {
    await setCost("POST", "0");
    expect(await resolveShippingCost("POST")).toBe(0);
  });

  // The admin types into an RTL page, so these are what actually gets pasted.
  it("reads Persian digits and thousands separators", async () => {
    await setCost("POST", "۹۵۰۰۰");
    expect(await resolveShippingCost("POST")).toBe(95_000);

    await setCost("POST", "120,000");
    expect(await resolveShippingCost("POST")).toBe(120_000);
  });

  /**
   * The important one. This value is arithmetic that reaches `finalAmount`, and
   * `NaN` there is not a wrong price — Prisma rejects the write and the shopper
   * reads it as a broken checkout. Anything unusable falls back instead.
   */
  it("never lets an unusable value reach the order total", async () => {
    for (const bad of ["", "   ", "abc", "-5000", "12.5", "1e9999"]) {
      await setCost("POST", bad);
      const cost = await resolveShippingCost("POST");
      expect(Number.isInteger(cost)).toBe(true);
      expect(cost).toBeGreaterThanOrEqual(0);
    }
  });

  it("is unaffected by a blank setting for the other method", async () => {
    await setCost("POST", "");
    await setCost("COURIER", "99000");

    const costs = await getShippingCosts();
    expect(costs.POST).toBe(SHIPPING_COST_DEFAULTS.POST);
    expect(costs.COURIER).toBe(99_000);
  });
});
