import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestUser,
  createTestProduct,
  getAuthToken,
  validShippingAddress,
} from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";
import { ConflictError } from "../../shared/app-error.js";
import { createOrder } from "./order.service.js";

/**
 * Regression cover for the oversell race.
 *
 * The stock guard used to compare against a read taken *before* the transaction
 * opened, so it could never observe a concurrent buyer. Two orders for the last
 * unit both passed, stock went negative, and neither customer was told.
 */
describe("stock is never oversold", () => {
  it("lets only one of two concurrent orders take the last unit", async () => {
    const app = await createTestApp();
    const product = await createTestProduct({ price: 50_000, stockQuantity: 1 });
    const [first, second] = await Promise.all([createTestUser(), createTestUser()]);

    const order = (userId: string) =>
      createOrder(userId, {
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddress: validShippingAddress(),
        shippingMethod: "POST",
      } as Parameters<typeof createOrder>[1]);

    // Both callers read stockQuantity: 1 before either transaction commits.
    const results = await Promise.allSettled([order(first.user.id), order(second.user.id)]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // The loser gets a clean 409 in Persian, whether the application check or
    // the database constraint is what caught it — never a raw 500.
    const reason = (rejected[0] as PromiseRejectedResult).reason as ConflictError;
    expect(reason).toBeInstanceOf(ConflictError);
    expect(reason.statusCode).toBe(409);
    expect(reason.message).toContain("به پایان رسید");

    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.stockQuantity).toBe(0);

    // The losing order must not exist at all — the throw rolls back the whole
    // transaction, including the order row and its address snapshot.
    expect(await prisma.order.count()).toBe(1);

    await app.close();
  });

  it("keeps stock non-negative under a burst of concurrent orders", async () => {
    const app = await createTestApp();
    const product = await createTestProduct({ price: 50_000, stockQuantity: 3 });
    const users = await Promise.all(Array.from({ length: 8 }, () => createTestUser()));

    const results = await Promise.allSettled(
      users.map(({ user }) =>
        createOrder(user.id, {
          items: [{ productId: product.id, quantity: 1 }],
          shippingAddress: validShippingAddress(),
          shippingMethod: "POST",
        } as Parameters<typeof createOrder>[1]),
      ),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(3);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.stockQuantity).toBe(0);
    expect(await prisma.order.count()).toBe(3);

    await app.close();
  });

  it("rejects a single order that exceeds available stock", async () => {
    const app = await createTestApp();
    const { user } = await createTestUser();
    const token = getAuthToken(app, user);
    const product = await createTestProduct({ price: 50_000, stockQuantity: 2 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ productId: product.id, quantity: 5 }],
        shippingAddress: validShippingAddress(),
        shippingMethod: "POST",
      },
    });

    expect(res.statusCode).toBe(409);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.stockQuantity).toBe(2);

    await app.close();
  });
});

describe("the database refuses negative stock", () => {
  it("rejects a direct update that would go below zero", async () => {
    // Defence in depth: even a caller that skips the service layer entirely
    // cannot corrupt stock, because the CHECK constraint stops it.
    const product = await createTestProduct({ stockQuantity: 1 });

    await expect(
      prisma.product.update({
        where: { id: product.id },
        data: { stockQuantity: { decrement: 5 } },
      }),
    ).rejects.toThrow();

    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.stockQuantity).toBe(1);
  });
});
