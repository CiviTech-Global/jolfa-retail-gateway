import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestAdmin,
  createTestProduct,
  createTestUser,
  getAuthToken,
  validShippingAddress,
} from "../../../test/helpers/factories.js";
import { ensureDefaultSettings } from "../settings/settings.service.js";
import { prisma } from "../../shared/prisma.js";
import {
  DEFAULT_TAX_LABEL,
  TAX_SETTING_KEYS,
  calculateTax,
  getTaxConfig,
  parseTaxPercent,
} from "./tax.service.js";

async function setTax(values: { enabled?: string; label?: string; percent?: string }): Promise<void> {
  for (const [name, value] of Object.entries(values)) {
    const key = TAX_SETTING_KEYS[name as keyof typeof TAX_SETTING_KEYS];
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value, group: "tax", isPublic: true, description: "test" },
    });
  }
}

async function placeOrder(
  app: FastifyInstance,
  price = 100_000,
  shippingMethod: "POST" | "COURIER" = "POST",
) {
  const { user } = await createTestUser();
  const product = await createTestProduct({ price, stockQuantity: 5 });
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/orders",
    headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    payload: {
      items: [{ productId: product.id, quantity: 1 }],
      shippingAddress: validShippingAddress(),
      shippingMethod,
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json().data.order;
}

describe("reading a tax rate", () => {
  it.each([
    ["9.5", 950],
    ["0", 0],
    ["100", 10_000],
    ["12.25", 1225],
    ["۹٫۵", 950],
    ["۹/۵", 950],
    ["٩.٥", 950],
    ["9,5", 950],
    [" 9.5% ", 950],
    ["۹.۵٪", 950],
  ])("reads %s", (raw, expected) => {
    expect(parseTaxPercent(raw)).toBe(expected);
  });

  it.each(["", "   ", "abc", "-1", "100.01", "101", "9.555", "1e2", "9.5.5", "Infinity"])(
    "refuses %j",
    (raw) => {
      expect(parseTaxPercent(raw)).toBeNull();
    },
  );

  it("rounds the tax to a whole Toman", () => {
    expect(calculateTax(180_000, 950)).toBe(17_100);
    expect(calculateTax(33_333, 950)).toBe(3_167);
    expect(calculateTax(0, 950)).toBe(0);
  });
});

describe("the default tax settings", () => {
  /**
   * The important one. Deploying this must not change what anybody pays: the
   * rate and name are ready, and the owner switches it on.
   */
  it("are seeded switched off, at 9.5%, under the standard name", async () => {
    await ensureDefaultSettings();

    expect(await getTaxConfig()).toEqual({
      enabled: false,
      label: "مالیات بر ارزش افزوده",
      basisPoints: 950,
    });
  });

  it("do not overwrite what the owner set when the server restarts", async () => {
    await ensureDefaultSettings();
    await setTax({ enabled: "true", label: "عوارض", percent: "10" });

    await ensureDefaultSettings();

    expect(await getTaxConfig()).toEqual({ enabled: true, label: "عوارض", basisPoints: 1000 });
  });

  it("reach the storefront, which has to show the line before the order exists", async () => {
    const app = await createTestApp();
    await ensureDefaultSettings();

    const res = await app.inject({ method: "GET", url: "/api/v1/settings/public" });
    const keys = res.json().data.settings.map((setting: { key: string }) => setting.key);

    expect(keys).toEqual(expect.arrayContaining(Object.values(TAX_SETTING_KEYS)));
    await app.close();
  });
});

describe("tax on an order", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds nothing while it is off", async () => {
    const app = await createTestApp();
    await setTax({ enabled: "false", percent: "9.5" });

    const order = await placeOrder(app);

    expect(order.taxAmount).toBe(0);
    expect(order.taxLabel).toBeNull();
    expect(order.taxBasisPoints).toBe(0);
    expect(order.finalAmount).toBe(180_000);
    await app.close();
  });

  it("charges the rate on the items only, and records it on the order", async () => {
    const app = await createTestApp();
    await setTax({ enabled: "true", label: DEFAULT_TAX_LABEL, percent: "9.5" });

    const order = await placeOrder(app);

    expect(order.totalAmount).toBe(100_000);
    expect(order.shippingCost).toBe(80_000);
    expect(order.taxAmount).toBe(9_500);
    expect(order.taxLabel).toBe(DEFAULT_TAX_LABEL);
    expect(order.taxBasisPoints).toBe(950);
    expect(order.finalAmount).toBe(189_500);
    await app.close();
  });

  /** The bug this pins: delivery was taxed, so courier orders paid more tax than post. */
  it("charges the same tax whichever delivery method is chosen", async () => {
    const app = await createTestApp();
    await setTax({ enabled: "true", percent: "10" });

    const byPost = await placeOrder(app, 100_000, "POST");
    const byCourier = await placeOrder(app, 100_000, "COURIER");

    expect(byPost.taxAmount).toBe(10_000);
    expect(byCourier.taxAmount).toBe(10_000);
    expect(byCourier.finalAmount - byPost.finalAmount).toBe(
      byCourier.shippingCost - byPost.shippingCost,
    );
    await app.close();
  });

  it("asks the gateway for the taxed total, in Rial", async () => {
    const app = await createTestApp();
    await setTax({ enabled: "true", percent: "10" });
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct({ price: 100_000, stockQuantity: 5 });
    const placed = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddress: validShippingAddress(),
        shippingMethod: "POST",
      },
    });

    const sent: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        sent.push(JSON.parse(init.body) as Record<string, unknown>);
        return new Response(JSON.stringify({ result: 100, trackId: 1234, message: "success" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/payments/request",
      headers: { authorization: `Bearer ${token}` },
      payload: { orderId: placed.json().data.order.id },
    });

    expect(res.statusCode).toBe(200);
    expect(sent[0]?.amount).toBe(1_900_000);
    await app.close();
  });

  it("uses the name the owner chose", async () => {
    const app = await createTestApp();
    await setTax({ enabled: "true", label: "عوارض شهرداری", percent: "2" });

    const order = await placeOrder(app);

    expect(order.taxLabel).toBe("عوارض شهرداری");
    expect(order.taxAmount).toBe(2_000);
    await app.close();
  });

  it("treats a rate of zero as no tax", async () => {
    const app = await createTestApp();
    await setTax({ enabled: "true", percent: "0" });

    const order = await placeOrder(app);

    expect(order.taxAmount).toBe(0);
    expect(order.taxLabel).toBeNull();
    await app.close();
  });

  it("leaves a placed order alone when the owner changes the rate", async () => {
    const app = await createTestApp();
    await setTax({ enabled: "true", label: "اول", percent: "9.5" });
    const order = await placeOrder(app);

    await setTax({ enabled: "false", label: "دوم", percent: "20" });

    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.taxAmount).toBe(9_500);
    expect(saved.taxLabel).toBe("اول");
    expect(saved.taxBasisPoints).toBe(950);
    expect(saved.finalAmount).toBe(189_500);
    await app.close();
  });

  it("charges the default rate if the stored one is unreadable", async () => {
    const app = await createTestApp();
    await setTax({ enabled: "true", percent: "abc" });

    const order = await placeOrder(app);

    expect(order.taxBasisPoints).toBe(950);
    expect(Number.isInteger(order.finalAmount)).toBe(true);
    await app.close();
  });
});

describe("PATCH /api/v1/settings for tax", () => {
  async function patch(app: FastifyInstance, key: string, value: string) {
    const { user } = await createTestAdmin();
    return app.inject({
      method: "PATCH",
      url: `/api/v1/settings/${key}`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: { value },
    });
  }

  it("stores a typed Persian rate in its plain form", async () => {
    const app = await createTestApp();
    await ensureDefaultSettings();

    const res = await patch(app, TAX_SETTING_KEYS.percent, "۱۲٫۵٪");

    expect(res.statusCode).toBe(200);
    expect(res.json().data.setting.value).toBe("12.5");
    await app.close();
  });

  it("refuses a rate it cannot read, and keeps the old one", async () => {
    const app = await createTestApp();
    await ensureDefaultSettings();

    for (const bad of ["", "abc", "150", "-3"]) {
      const res = await patch(app, TAX_SETTING_KEYS.percent, bad);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("INVALID_SETTING_VALUE");
    }

    expect((await getTaxConfig()).basisPoints).toBe(950);
    await app.close();
  });

  it("brings the default name back when the field is cleared", async () => {
    const app = await createTestApp();
    await ensureDefaultSettings();

    const res = await patch(app, TAX_SETTING_KEYS.label, "   ");

    expect(res.json().data.setting.value).toBe(DEFAULT_TAX_LABEL);
    await app.close();
  });

  it("refuses a name too long to keep on an order", async () => {
    const app = await createTestApp();
    await ensureDefaultSettings();

    const res = await patch(app, TAX_SETTING_KEYS.label, "م".repeat(101));

    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
