import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import {
  createTestAdmin,
  createTestCategory,
  createTestProduct,
  createTestSubcategory,
  getAuthToken,
} from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";

const API = "/api/v1";

/**
 * The catalogue is Category -> Subcategory -> Product, exactly two levels deep,
 * with products attached only to subcategories.
 *
 * Both rules are enforced twice over: in the service layer, which produces a
 * Persian message an admin can act on, and by database triggers, which hold for
 * anything that bypasses the API. These tests cover the service layer — the
 * path a real request takes — plus the listing behaviour that the shape exists
 * to support.
 */
describe("two-level catalogue", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // Per test, not once in beforeAll: the suite truncates tables between tests,
  // so an admin created up front stops existing and its token stops resolving —
  // every write would fail with 401 instead of exercising the rule under test.
  const auth = async () => {
    const { user } = await createTestAdmin();
    return { authorization: `Bearer ${getAuthToken(app, user)}` };
  };

  describe("depth", () => {
    it("allows a subcategory under a top-level category", async () => {
      const parent = await createTestCategory({ name: "بهداشت بدن" });

      const response = await app.inject({
        method: "POST",
        url: `${API}/categories`,
        headers: await auth(),
        payload: { name: "مراقبت مو", parentId: parent.id },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data.category.parentId).toBe(parent.id);
    });

    it("refuses a third level", async () => {
      const subcategory = await createTestSubcategory();

      const response = await app.inject({
        method: "POST",
        url: `${API}/categories`,
        headers: await auth(),
        payload: { name: "خیلی عمیق", parentId: subcategory.id },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("CATEGORY_DEPTH_EXCEEDED");
    });

    it("refuses to demote a category that has children", async () => {
      const parent = await createTestCategory();
      await createTestSubcategory({ parentId: parent.id });
      const otherRoot = await createTestCategory();

      const response = await app.inject({
        method: "PATCH",
        url: `${API}/categories/${parent.slug}`,
        headers: await auth(),
        payload: { parentId: otherRoot.id },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("CATEGORY_HAS_CHILDREN");
    });

    // The old guard compared only against the category's own id, so A -> A was
    // caught and A -> B -> A was not. The depth rules close that: the only edge
    // that can be created runs from a childless node to a root, and a root has
    // no parent to loop back through.
    it("refuses a two-step cycle", async () => {
      const a = await createTestCategory();
      const b = await createTestSubcategory({ parentId: a.id });

      const response = await app.inject({
        method: "PATCH",
        url: `${API}/categories/${a.slug}`,
        headers: await auth(),
        payload: { parentId: b.id },
      });

      expect(response.statusCode).toBe(400);
      const found = await prisma.category.findUniqueOrThrow({ where: { id: a.id } });
      expect(found.parentId).toBeNull();
    });

    it("refuses a category as its own parent", async () => {
      const category = await createTestCategory();

      const response = await app.inject({
        method: "PATCH",
        url: `${API}/categories/${category.slug}`,
        headers: await auth(),
        payload: { parentId: category.id },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("product placement", () => {
    it("accepts a product in a subcategory", async () => {
      const subcategory = await createTestSubcategory();

      const response = await app.inject({
        method: "POST",
        url: `${API}/products`,
        headers: await auth(),
        payload: {
          title: "محصول درست",
          price: 50000,
          stockQuantity: 3,
          categoryId: subcategory.id,
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it("refuses a product in a top-level category", async () => {
      const topLevel = await createTestCategory();

      const response = await app.inject({
        method: "POST",
        url: `${API}/products`,
        headers: await auth(),
        payload: {
          title: "محصول نادرست",
          price: 50000,
          stockQuantity: 3,
          categoryId: topLevel.id,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("PRODUCT_REQUIRES_SUBCATEGORY");
    });

    it("refuses to move an existing product up to a top-level category", async () => {
      const product = await createTestProduct();
      const topLevel = await createTestCategory();

      const response = await app.inject({
        method: "PATCH",
        url: `${API}/products/${product.slug}`,
        headers: await auth(),
        payload: { categoryId: topLevel.id },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("PRODUCT_REQUIRES_SUBCATEGORY");
    });

    it("refuses to promote a subcategory that still holds products", async () => {
      const subcategory = await createTestSubcategory();
      await createTestProduct({ categoryId: subcategory.id });

      const response = await app.inject({
        method: "PATCH",
        url: `${API}/categories/${subcategory.slug}`,
        headers: await auth(),
        payload: { parentId: null },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("CATEGORY_HAS_PRODUCTS");
    });
  });

  describe("listing", () => {
    // The behaviour the whole hierarchy exists for. Filtering by a top-level
    // slug used to match that category alone and therefore returned nothing,
    // because products never sit there — an empty grid with no error anywhere.
    it("returns products from every subcategory when filtered by the parent", async () => {
      const parent = await createTestCategory({ slug: `parent-${Date.now()}` });
      const first = await createTestSubcategory({ parentId: parent.id });
      const second = await createTestSubcategory({ parentId: parent.id });

      await createTestProduct({ categoryId: first.id, title: "اولی" });
      await createTestProduct({ categoryId: second.id, title: "دومی" });

      const response = await app.inject({
        method: "GET",
        url: `${API}/products?categorySlug=${parent.slug}&limit=50`,
      });

      expect(response.statusCode).toBe(200);
      const titles = response.json().data.products.map((p: { title: string }) => p.title);
      expect(titles).toContain("اولی");
      expect(titles).toContain("دومی");
    });

    it("returns only its own products when filtered by a subcategory", async () => {
      const parent = await createTestCategory();
      const mine = await createTestSubcategory({ parentId: parent.id });
      const sibling = await createTestSubcategory({ parentId: parent.id });

      await createTestProduct({ categoryId: mine.id, title: "مال من" });
      await createTestProduct({ categoryId: sibling.id, title: "مال همسایه" });

      const response = await app.inject({
        method: "GET",
        url: `${API}/products?categorySlug=${mine.slug}&limit=50`,
      });

      const titles = response.json().data.products.map((p: { title: string }) => p.title);
      expect(titles).toContain("مال من");
      expect(titles).not.toContain("مال همسایه");
    });

    it("reports a top-level category's product count as the sum of its subcategories", async () => {
      const parent = await createTestCategory();
      const child = await createTestSubcategory({ parentId: parent.id });
      await createTestProduct({ categoryId: child.id });
      await createTestProduct({ categoryId: child.id });

      const response = await app.inject({
        method: "GET",
        url: `${API}/categories/${parent.slug}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.category.productCount).toBe(2);
    });

    it("returns the parent on a subcategory so breadcrumbs need no second request", async () => {
      const parent = await createTestCategory({ name: "دسته والد" });
      const child = await createTestSubcategory({ parentId: parent.id });

      const response = await app.inject({
        method: "GET",
        url: `${API}/categories/${child.slug}`,
      });

      expect(response.json().data.category.parent).toMatchObject({
        id: parent.id,
        name: "دسته والد",
        slug: parent.slug,
      });
    });

    it("nests subcategories under their parent in the tree", async () => {
      const parent = await createTestCategory();
      const child = await createTestSubcategory({ parentId: parent.id });

      const response = await app.inject({ method: "GET", url: `${API}/categories?tree=true` });

      const root = response
        .json()
        .data.categories.find((c: { id: string }) => c.id === parent.id);
      expect(root.children.map((c: { id: string }) => c.id)).toContain(child.id);
    });
  });

  describe("deletion", () => {
    it("refuses to delete a subcategory that holds a product", async () => {
      const subcategory = await createTestSubcategory();
      await createTestProduct({ categoryId: subcategory.id });

      const response = await app.inject({
        method: "DELETE",
        url: `${API}/categories/${subcategory.slug}`,
        headers: await auth(),
      });

      expect(response.statusCode).toBe(409);
    });

    it("refuses to delete a category that still has subcategories", async () => {
      const parent = await createTestCategory();
      await createTestSubcategory({ parentId: parent.id });

      const response = await app.inject({
        method: "DELETE",
        url: `${API}/categories/${parent.slug}`,
        headers: await auth(),
      });

      expect(response.statusCode).toBe(409);
    });

    // Previously the guards filtered to active rows, so an inactive product
    // slipped past the check and the delete failed on the foreign key instead —
    // a raw constraint violation rather than a sentence the admin can act on.
    it("refuses to delete a subcategory holding an INACTIVE product", async () => {
      const subcategory = await createTestSubcategory();
      await createTestProduct({ categoryId: subcategory.id, isActive: false });

      const response = await app.inject({
        method: "DELETE",
        url: `${API}/categories/${subcategory.slug}`,
        headers: await auth(),
      });

      expect(response.statusCode).toBe(409);
    });
  });
});
