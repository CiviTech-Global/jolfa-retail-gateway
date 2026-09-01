import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slugify.js";

/** Nothing is taken. */
const free = async () => false;

describe("slugify", () => {
  it("builds a slug from a latin title", () => {
    expect(slugify("My New Product")).toBe("my-new-product");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("  Hello --- World!!  ")).toBe("hello-world");
  });

  it("returns an empty string for a Persian-only title", () => {
    // The reason uniqueSlug exists: this store's titles are almost all Persian.
    expect(slugify("چای سیاه ارگانیک")).toBe("");
  });

  it("never leaves a leading or trailing dash", () => {
    expect(slugify("زعفران saffron")).toBe("saffron");
  });
});

describe("uniqueSlug", () => {
  it("uses the slugified title when it is free", async () => {
    const slug = await uniqueSlug("Black Tea", { prefix: "product", isTaken: free });
    expect(slug).toBe("black-tea");
  });

  it("generates a prefixed slug when the title has no latin characters", async () => {
    const slug = await uniqueSlug("چای سیاه ارگانیک", { prefix: "product", isTaken: free });
    expect(slug).toMatch(/^product-[0-9a-f]{6}$/);
  });

  it("gives two Persian titles different slugs", async () => {
    const taken = new Set<string>();
    const isTaken = async (slug: string) => taken.has(slug);

    const first = await uniqueSlug("عسل طبیعی", { prefix: "product", isTaken });
    taken.add(first);
    const second = await uniqueSlug("زعفران سرگل", { prefix: "product", isTaken });

    // Previously both collapsed to the same value and the second insert failed.
    expect(second).not.toBe(first);
  });

  it("suffixes a taken latin slug instead of colliding", async () => {
    const taken = new Set(["black-tea"]);
    const slug = await uniqueSlug("Black Tea", {
      prefix: "product",
      isTaken: async (value) => taken.has(value),
    });
    expect(slug).toBe("black-tea-2");
  });

  it("keeps counting past the first suffix", async () => {
    const taken = new Set(["black-tea", "black-tea-2", "black-tea-3"]);
    const slug = await uniqueSlug("Black Tea", {
      prefix: "product",
      isTaken: async (value) => taken.has(value),
    });
    expect(slug).toBe("black-tea-4");
  });

  it("respects the max length", async () => {
    const slug = await uniqueSlug("a".repeat(300), {
      prefix: "product",
      isTaken: free,
      maxLength: 50,
    });
    expect(slug.length).toBeLessThanOrEqual(50);
  });
});
