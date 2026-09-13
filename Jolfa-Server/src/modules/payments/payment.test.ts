import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { User } from "@prisma/client";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestUser,
  createTestProduct,
  getAuthToken,
  validShippingAddress,
} from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";

/**
 * The payments module moves money. These drive the real routes end to end
 * against the database, with the gateway itself stubbed at `fetch`.
 *
 * Stubbing fetch rather than the Zibal client module is deliberate: it keeps the
 * client's own logic — result-code interpretation, the Toman-to-Rial
 * conversion, the amount cross-check — inside what is under test. Mocking the
 * client would assert only that the service calls a function.
 *
 * It also stops the suite reaching the real gateway. Zibal's documented test
 * merchant works over the public internet, so an unstubbed run quietly depended
 * on their uptime and took a network round trip per test.
 */

const TRACK_ID = "15966442233311";

/**
 * The amount Zibal was last asked for, in Rial.
 *
 * Module-level rather than per-stub because tests re-stub mid-test to change
 * what verify reports, and that must not make the gateway forget the session it
 * already opened — which would fail the service's amount cross-check for the
 * wrong reason and make the test look like a product bug.
 */
let lastRequestedAmountRial = 0;

interface ZibalStub {
  /** Result code for /v1/request. 100 is success. */
  requestResult?: number;
  /** Result code for /v1/verify. 100 success, 201 already verified. */
  verifyResult?: number;
  /** Payment-session status. 1 = paid+verified, 2 = paid+unverified, 3 = cancelled. */
  verifyStatus?: number;
  /** What Zibal says was paid, in RIAL. Defaults to whatever was requested. */
  verifyAmountRial?: number;
  trackId?: string;
}

/** Installs a fake Zibal and returns a record of what was sent to it. */
function stubZibal(options: ZibalStub = {}) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      calls.push({ url: String(url), body });

      if (String(url).endsWith("/v1/request")) {
        lastRequestedAmountRial = Number(body.amount);
        return new Response(
          JSON.stringify({
            result: options.requestResult ?? 100,
            trackId: Number(options.trackId ?? TRACK_ID),
            message: "success",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          result: options.verifyResult ?? 100,
          status: options.verifyStatus ?? 1,
          amount: options.verifyAmountRial ?? lastRequestedAmountRial,
          refNumber: 987654,
          cardNumber: "62741****44",
          paidAt: "2026-09-13T10:00:00.000000",
          message: "success",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );

  return { calls };
}

interface Fixture {
  app: FastifyInstance;
  user: User;
  token: string;
  orderId: string;
}

async function placeOrder(): Promise<Fixture> {
  const app = await createTestApp();
  const { user } = await createTestUser();
  const token = getAuthToken(app, user);
  const product = await createTestProduct({ price: 50_000, stockQuantity: 10 });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/orders",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      items: [{ productId: product.id, quantity: 2 }],
      shippingAddress: validShippingAddress(),
      shippingMethod: "POST",
    },
  });

  expect(res.statusCode).toBe(201);
  return { app, user, token, orderId: res.json().data.order.id };
}

async function requestPayment(f: Fixture) {
  return f.app.inject({
    method: "POST",
    url: "/api/v1/payments/request",
    headers: { authorization: `Bearer ${f.token}` },
    payload: { orderId: f.orderId },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  lastRequestedAmountRial = 0;
});

describe("POST /api/v1/payments/request", () => {
  let fixture: Fixture;
  beforeEach(async () => {
    stubZibal();
    fixture = await placeOrder();
  });

  it("returns a redirect URL and records a pending payment", async () => {
    const res = await requestPayment(fixture);

    expect(res.statusCode).toBe(200);
    const { paymentUrl, authority } = res.json().data;
    expect(authority).toBeTruthy();
    expect(paymentUrl).toContain(authority);

    const payment = await prisma.payment.findFirstOrThrow({ where: { authority } });
    expect(payment.status).toBe("PENDING");
    expect(payment.orderId).toBe(fixture.orderId);
  });

  it("charges the order's final amount, including shipping", async () => {
    const res = await requestPayment(fixture);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: fixture.orderId } });
    const payment = await prisma.payment.findFirstOrThrow({
      where: { authority: res.json().data.authority },
    });

    // 2 × 50,000 + 80,000 postal shipping.
    expect(order.finalAmount).toBe(180_000);
    expect(payment.amount).toBe(order.finalAmount);
  });

  it("reuses the pending authority instead of minting a second one", async () => {
    const first = await requestPayment(fixture);
    const second = await requestPayment(fixture);

    expect(second.json().data.authority).toBe(first.json().data.authority);
    expect(await prisma.payment.count({ where: { orderId: fixture.orderId } })).toBe(1);
  });

  it("refuses to let one customer pay another customer's order", async () => {
    const { user: attacker } = await createTestUser();
    const attackerToken = getAuthToken(fixture.app, attacker);

    const res = await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/request",
      headers: { authorization: `Bearer ${attackerToken}` },
      payload: { orderId: fixture.orderId },
    });

    expect(res.statusCode).toBe(400);
    expect(await prisma.payment.count()).toBe(0);
  });

  it("requires authentication", async () => {
    const res = await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/request",
      payload: { orderId: fixture.orderId },
    });

    expect(res.statusCode).toBe(401);
  });

  it("404s for an order that does not exist", async () => {
    const res = await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/request",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { orderId: "00000000-0000-4000-8000-000000000000" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("rejects a malformed order id before touching the database", async () => {
    const res = await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/request",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { orderId: "not-a-uuid" },
    });

    expect(res.statusCode).toBe(422);
  });

  it("refuses a second payment once the order is already paid", async () => {
    const { authority } = (await requestPayment(fixture)).json().data;
    await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      payload: { authority, status: "OK" },
    });

    const res = await requestPayment(fixture);
    expect(res.statusCode).toBe(409);
  });
});

describe("POST /api/v1/payments/verify", () => {
  let fixture: Fixture;
  let authority: string;

  beforeEach(async () => {
    stubZibal();
    fixture = await placeOrder();
    authority = (await requestPayment(fixture)).json().data.authority;
  });

  it("completes the payment and advances the order", async () => {
    const res = await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      payload: { authority, status: "OK" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.success).toBe(true);

    const payment = await prisma.payment.findFirstOrThrow({ where: { authority } });
    expect(payment.status).toBe("COMPLETED");
    expect(payment.refId).toBeTruthy();
    expect(payment.paidAt).not.toBeNull();

    const order = await prisma.order.findUniqueOrThrow({ where: { id: fixture.orderId } });
    expect(order.paymentStatus).toBe("COMPLETED");
    expect(order.status).toBe("PROCESSING");
  });

  it("records a completed transaction for the ledger", async () => {
    await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      payload: { authority, status: "OK" },
    });

    const transactions = await prisma.transaction.findMany({
      where: { orderId: fixture.orderId, status: "COMPLETED" },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.amount).toBe(180_000);
  });

  it("is idempotent — a replayed callback does not double-credit", async () => {
    // Gateways retry. Verifying twice must not create a second transaction or
    // move the order on a second time.
    const first = await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      payload: { authority, status: "OK" },
    });
    const second = await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      payload: { authority, status: "OK" },
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json().data.success).toBe(true);
    expect(second.json().data.refId).toBe(first.json().data.refId);

    expect(
      await prisma.transaction.count({ where: { orderId: fixture.orderId, status: "COMPLETED" } }),
    ).toBe(1);
  });

  it("marks the payment failed when the gateway reports a cancelled session", async () => {
    // Zibal status 3 = cancelled by the customer.
    stubZibal({ verifyResult: 202, verifyStatus: 3 });

    const res = await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      payload: { authority, status: "OK" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.success).toBe(false);

    const payment = await prisma.payment.findFirstOrThrow({ where: { authority } });
    expect(payment.status).toBe("FAILED");

    const order = await prisma.order.findUniqueOrThrow({ where: { id: fixture.orderId } });
    expect(order.paymentStatus).toBe("PENDING");
    expect(order.status).toBe("PENDING");
  });

  // The regression this whole rewrite exists for.
  //
  // Verification used to read `status` from the request body: anything that was
  // not "NOK" marked the order paid. The endpoint needs no authentication and
  // the customer is handed their own authority by /payments/request, so this
  // was a free-order button for anyone who opened the network tab.
  it("does not trust the caller's claim of success when the gateway disagrees", async () => {
    stubZibal({ verifyResult: 202, verifyStatus: 3 });

    const res = await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      payload: { authority, status: "OK" },
    });

    expect(res.json().data.success).toBe(false);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: fixture.orderId } });
    expect(order.paymentStatus).toBe("PENDING");
  });

  it("refuses to settle when the gateway reports a different amount", async () => {
    // A mismatch means something is wrong that must not be papered over by
    // shipping goods: a mixed-up trackId, a tampered session, or our own
    // Toman/Rial conversion drifting.
    stubZibal({ verifyAmountRial: 10_000 });

    const res = await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      payload: { authority, status: "OK" },
    });

    expect(res.json().data.success).toBe(false);

    const payment = await prisma.payment.findFirstOrThrow({ where: { authority } });
    expect(payment.status).toBe("FAILED");

    const order = await prisma.order.findUniqueOrThrow({ where: { id: fixture.orderId } });
    expect(order.paymentStatus).toBe("PENDING");
  });

  it("treats 'already verified' as success, so a retried callback still settles", async () => {
    // Result 201. A retry, a refreshed return page, or our own timeout retry
    // all produce it; treating it as a failure would mark a paid order failed.
    stubZibal({ verifyResult: 201, verifyStatus: 1 });

    const res = await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      payload: { authority },
    });

    expect(res.json().data.success).toBe(true);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: fixture.orderId } });
    expect(order.paymentStatus).toBe("COMPLETED");
  });

  it("404s for an authority nobody issued", async () => {
    // A forged callback must not be able to complete an order.
    const res = await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      payload: { authority: "forged-authority-value", status: "OK" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("rejects a callback with no authority", async () => {
    const res = await fixture.app.inject({
      method: "POST",
      url: "/api/v1/payments/verify",
      payload: { status: "OK" },
    });

    expect(res.statusCode).toBe(422);
  });
});

describe("GET /api/v1/payments/:authority", () => {
  it("returns the payment with its order summary", async () => {
    const fixture = await placeOrder();
    const authority = (await requestPayment(fixture)).json().data.authority;

    const res = await fixture.app.inject({
      method: "GET",
      url: `/api/v1/payments/${authority}`,
      headers: { authorization: `Bearer ${fixture.token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.payment.authority).toBe(authority);
    expect(res.json().data.payment.order.id).toBe(fixture.orderId);
  });

  it("requires authentication", async () => {
    const fixture = await placeOrder();
    const authority = (await requestPayment(fixture)).json().data.authority;

    const res = await fixture.app.inject({
      method: "GET",
      url: `/api/v1/payments/${authority}`,
    });

    expect(res.statusCode).toBe(401);
  });
});
