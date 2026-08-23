import { describe, expect, it } from "vitest";
import { z } from "zod";
import { productCreateBodySchema, productUpdateBodySchema } from "../modules/products/product.types.js";
import { categoryCreateBodySchema } from "../modules/categories/category.types.js";
import { nullable, nullableNumber, optionalString } from "./zod-helpers.js";

describe("zod-helpers", () => {
  it("treats an absent key, an empty string and null distinctly", () => {
    const schema = z.object({ note: nullable(z.string()) });

    expect(schema.parse({})).toEqual({});
    expect(schema.parse({ note: "" })).toEqual({ note: null });
    expect(schema.parse({ note: null })).toEqual({ note: null });
    expect(schema.parse({ note: "hi" })).toEqual({ note: "hi" });
  });

  it("does not coerce null to 0 for numbers", () => {
    const schema = z.object({ price: nullableNumber(z.number().positive()) });

    // `z.coerce.number()` would turn null into 0 and then fail `.positive()`.
    expect(schema.parse({ price: null })).toEqual({ price: null });
    expect(schema.parse({ price: "1500" })).toEqual({ price: 1500 });
  });

  it("maps empty to undefined for non-clearable fields", () => {
    const schema = z.object({ slug: optionalString(z.string()) });
    expect(schema.parse({ slug: "" })).toEqual({});
  });
});

describe("productCreateBodySchema", () => {
  const base = {
    title: "کیف چرمی",
    price: 250000,
    categoryId: "3f0f8b7e-1c2d-4a5b-8e9f-0a1b2c3d4e5f",
  };

  it("accepts a product whose optional fields are all empty", () => {
    // This is the exact payload the admin form sends for a minimal product;
    // it used to fail with "Number must be greater than 0" on compareAtPrice.
    const result = productCreateBodySchema.safeParse({
      ...base,
      compareAtPrice: null,
      weightGrams: null,
      sku: null,
      metaTitle: null,
      metaDescription: null,
      description: "",
      shortDescription: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.compareAtPrice).toBeNull();
      expect(result.data.weightGrams).toBeNull();
    }
  });

  it("reports missing required fields in Persian", () => {
    const result = productCreateBodySchema.safeParse({ title: "", price: 0, categoryId: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages.some((m) => m.includes("الزامی است"))).toBe(true);
      expect(messages.every((m) => !/[A-Za-z]{4,}/.test(m))).toBe(true);
    }
  });

  it("leaves untouched fields alone on a partial update", () => {
    const result = productUpdateBodySchema.parse({ title: "عنوان تازه" });
    expect(result).toEqual({ title: "عنوان تازه" });
    expect("compareAtPrice" in result).toBe(false);
  });

  it("accepts a server-relative image URL from the upload endpoint", () => {
    const result = productCreateBodySchema.safeParse({
      ...base,
      images: [{ url: "/uploads/abc.png" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("categoryCreateBodySchema", () => {
  it("accepts a relative imageUrl", () => {
    // `z.string().url()` rejected exactly what /uploads returns.
    const result = categoryCreateBodySchema.safeParse({
      name: "کیف",
      imageUrl: "/uploads/abc.png",
    });
    expect(result.success).toBe(true);
  });

  it("clears imageUrl and parentId when sent empty", () => {
    const result = categoryCreateBodySchema.parse({
      name: "کیف",
      imageUrl: "",
      parentId: null,
    });
    expect(result.imageUrl).toBeNull();
    expect(result.parentId).toBeNull();
  });
});
