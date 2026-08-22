import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestAdmin,
  createTestCategory,
  createTestProduct,
  createTestUser,
  getAuthToken,
} from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";

async function buildTestApp(): Promise<FastifyInstance> {
  return createTestApp();
}

const BASE = "/api/v1/categories";

describe("GET /api/v1/categories", () => {
  it("returns only root categories by default, ordered by displayOrder", async () => {
    const app = await buildTestApp();
    const parent = await createTestCategory({ name: "والد", slug: "parent-a" });
    await prisma.category.update({ where: { id: parent.id }, data: { displayOrder: 2 } });
    const other = await createTestCategory({ name: "دوم", slug: "parent-b" });
    await prisma.category.update({ where: { id: other.id }, data: { displayOrder: 1 } });
    // A child must NOT appear in the default (root-only) listing.
    await createTestCategory({ name: "فرزند", slug: "child-a" }).then((c) =>
      prisma.category.update({ where: { id: c.id }, data: { parentId: parent.id } }),
    );

    const res = await app.inject({ method: "GET", url: BASE });

    expect(res.statusCode).toBe(200);
    const slugs = res.json().data.categories.map((c: { slug: string }) => c.slug);
    expect(slugs).toEqual(["parent-b", "parent-a"]);
    await app.close();
  });

  it("excludes inactive categories from the public listing", async () => {
    const app = await buildTestApp();
    await createTestCategory({ slug: "visible-cat" });
    await createTestCategory({ slug: "hidden-cat", isActive: false });

    const res = await app.inject({ method: "GET", url: BASE });

    const slugs = res.json().data.categories.map((c: { slug: string }) => c.slug);
    expect(slugs).toContain("visible-cat");
    expect(slugs).not.toContain("hidden-cat");
    await app.close();
  });

  it("nests children under their parent when tree=true", async () => {
    const app = await buildTestApp();
    const parent = await createTestCategory({ slug: "tree-parent" });
    const child = await createTestCategory({ slug: "tree-child" });
    await prisma.category.update({ where: { id: child.id }, data: { parentId: parent.id } });

    const res = await app.inject({ method: "GET", url: `${BASE}?tree=true` });

    expect(res.statusCode).toBe(200);
    const roots = res.json().data.categories as { slug: string; children: { slug: string }[] }[];
    const root = roots.find((c) => c.slug === "tree-parent");
    expect(root).toBeDefined();
    expect(root?.children.map((c) => c.slug)).toEqual(["tree-child"]);
    // The child must not also surface as a root node.
    expect(roots.map((c) => c.slug)).not.toContain("tree-child");
    await app.close();
  });

  it("filters to a single parent's children when parentId is supplied", async () => {
    const app = await buildTestApp();
    const parent = await createTestCategory({ slug: "filter-parent" });
    const child = await createTestCategory({ slug: "filter-child" });
    await prisma.category.update({ where: { id: child.id }, data: { parentId: parent.id } });
    await createTestCategory({ slug: "unrelated-root" });

    const res = await app.inject({ method: "GET", url: `${BASE}?parentId=${parent.id}` });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.categories.map((c: { slug: string }) => c.slug)).toEqual([
      "filter-child",
    ]);
    await app.close();
  });

  it("rejects a non-uuid parentId with 422", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: `${BASE}?parentId=not-a-uuid` });

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
    await app.close();
  });
});

describe("GET /api/v1/categories/:slug", () => {
  it("returns the category with its active children", async () => {
    const app = await buildTestApp();
    const parent = await createTestCategory({ slug: "detail-parent", name: "مادر" });
    const child = await createTestCategory({ slug: "detail-child" });
    await prisma.category.update({ where: { id: child.id }, data: { parentId: parent.id } });
    const inactiveChild = await createTestCategory({ slug: "detail-child-off", isActive: false });
    await prisma.category.update({
      where: { id: inactiveChild.id },
      data: { parentId: parent.id },
    });

    const res = await app.inject({ method: "GET", url: `${BASE}/detail-parent` });

    expect(res.statusCode).toBe(200);
    const body = res.json().data.category;
    expect(body.name).toBe("مادر");
    expect(body.children.map((c: { slug: string }) => c.slug)).toEqual(["detail-child"]);
    await app.close();
  });

  it("returns 404 for an unknown slug", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: `${BASE}/no-such-category` });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
    await app.close();
  });
});

describe("POST /api/v1/categories (admin)", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      payload: { name: "بدون توکن" },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("rejects a CUSTOMER token with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: { name: "بدون دسترسی" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
    await app.close();
  });

  it("creates a category for an ADMIN token and writes an audit row", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { name: "کفش", slug: "shoes", displayOrder: 3 },
    });

    expect(res.statusCode).toBe(201);
    const category = res.json().data.category;
    expect(category.slug).toBe("shoes");
    expect(category.displayOrder).toBe(3);

    const audits = await prisma.auditLog.findMany({ where: { entityType: "Category" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "CREATE",
      entityId: category.id,
      userId: admin.id,
    });
    await app.close();
  });

  it("derives a slug from the name when none is supplied", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { name: "Winter Boots" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.category.slug).toBe("winter-boots");
    await app.close();
  });

  it("rejects a duplicate slug with 409", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    await createTestCategory({ slug: "taken-slug" });

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { name: "تکراری", slug: "taken-slug" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("CONFLICT");
    await app.close();
  });

  it("rejects a slug that violates the lowercase-kebab pattern with 422", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { name: "بد", slug: "Not Valid Slug" },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it("returns 404 when parentId points at a non-existent category", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: {
        name: "یتیم",
        slug: "orphan",
        parentId: "00000000-0000-4000-8000-000000000000",
      },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe("PATCH /api/v1/categories/:slug (admin)", () => {
  it("applies a partial update without clobbering unspecified fields", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    await createTestCategory({ slug: "patch-me", name: "نام اصلی" });

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/patch-me`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { description: "توضیح تازه" },
    });

    expect(res.statusCode).toBe(200);
    const category = res.json().data.category;
    expect(category.description).toBe("توضیح تازه");
    // Untouched fields survive the PATCH.
    expect(category.name).toBe("نام اصلی");
    expect(category.slug).toBe("patch-me");
    expect(category.isActive).toBe(true);
    await app.close();
  });

  it("rejects making a category its own parent with 400", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory({ slug: "self-parent" });

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/self-parent`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { parentId: category.id },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("rejects renaming onto an already-used slug with 409", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    await createTestCategory({ slug: "existing-one" });
    await createTestCategory({ slug: "rename-me" });

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/rename-me`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { slug: "existing-one" },
    });

    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it("rejects a CUSTOMER token with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    await createTestCategory({ slug: "guarded" });

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/guarded`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: { name: "تلاش" },
    });

    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe("DELETE /api/v1/categories/:slug (admin)", () => {
  it("deletes an empty category and writes a DELETE audit row", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    await createTestCategory({ slug: "delete-me" });

    const res = await app.inject({
      method: "DELETE",
      url: `${BASE}/delete-me`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(await prisma.category.findUnique({ where: { slug: "delete-me" } })).toBeNull();

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "Category", action: "DELETE" },
    });
    expect(audits).toHaveLength(1);
    await app.close();
  });

  // Pins down the behaviour the manual checklist (05-admin-catalog.md) left open:
  // deletion is BLOCKED, not cascading and not orphaning.
  it("refuses to delete a category that still has an active product (409)", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory({ slug: "has-products" });
    await createTestProduct({ categoryId: category.id, isActive: true });

    const res = await app.inject({
      method: "DELETE",
      url: `${BASE}/has-products`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(409);
    expect(await prisma.category.findUnique({ where: { slug: "has-products" } })).not.toBeNull();
    await app.close();
  });

  // Regression: an INACTIVE product still holds a `Restrict` FK, so the delete
  // must be refused with a 409 rather than escaping to Postgres as a 500.
  it("refuses to delete a category whose only products are inactive (409, not 500)", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const category = await createTestCategory({ slug: "inactive-products" });
    await createTestProduct({ categoryId: category.id, isActive: false });

    const res = await app.inject({
      method: "DELETE",
      url: `${BASE}/inactive-products`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("CONFLICT");
    await app.close();
  });

  // Same regression on the Category self-relation (`onDelete: NoAction`).
  it("refuses to delete a category whose only child is inactive (409, not 500)", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const parent = await createTestCategory({ slug: "inactive-child-parent" });
    const child = await createTestCategory({ slug: "inactive-child", isActive: false });
    await prisma.category.update({ where: { id: child.id }, data: { parentId: parent.id } });

    const res = await app.inject({
      method: "DELETE",
      url: `${BASE}/inactive-child-parent`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it("refuses to delete a category that still has an active child (409)", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const parent = await createTestCategory({ slug: "has-children" });
    const child = await createTestCategory({ slug: "a-child" });
    await prisma.category.update({ where: { id: child.id }, data: { parentId: parent.id } });

    const res = await app.inject({
      method: "DELETE",
      url: `${BASE}/has-children`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it("returns 404 deleting an unknown slug", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "DELETE",
      url: `${BASE}/ghost`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("rejects an unauthenticated delete with 401", async () => {
    const app = await buildTestApp();
    await createTestCategory({ slug: "protected-cat" });

    const res = await app.inject({ method: "DELETE", url: `${BASE}/protected-cat` });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
