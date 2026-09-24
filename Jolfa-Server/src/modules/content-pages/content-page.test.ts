import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import { createTestAdmin, createTestUser, getAuthToken } from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";
import { ensureDefaultContentPages } from "./content-page.service.js";

const API = "/api/v1/content-pages";

/**
 * The /about page was hardcoded in the React bundle and unreachable: the
 * `show_about` setting was off, and the route guard renders 404 when it is, so
 * the page reported itself as missing rather than as switched off. These cover
 * the editing path that replaced it.
 */
describe("content pages", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
    // The suite truncates between tests, so the boot-time seeding is redone
    // here rather than relied upon.
    await ensureDefaultContentPages();
  });

  const adminAuth = async () => {
    const { user } = await createTestAdmin();
    return { authorization: `Bearer ${getAuthToken(app, user)}` };
  };

  describe("seeding", () => {
    it("creates the three static pages with their shipped copy", async () => {
      const slugs = await prisma.contentPage.findMany({ select: { slug: true } });
      expect(slugs.map((p) => p.slug).sort()).toEqual(["about", "contact", "rules"]);
    });

    // A deploy runs the seeding again. If it upserted, every release would wipe
    // whatever the shop owner had written — the same trap `ensureDefaultSettings`
    // avoids by excluding `value` from its upsert.
    it("never overwrites copy an admin has already edited", async () => {
      await prisma.contentPage.update({
        where: { slug: "about" },
        data: { title: "درباره ما — ویرایش‌شده", blocks: [] },
      });

      await ensureDefaultContentPages();

      const page = await prisma.contentPage.findUniqueOrThrow({ where: { slug: "about" } });
      expect(page.title).toBe("درباره ما — ویرایش‌شده");
      expect(page.blocks).toEqual([]);
    });
  });

  describe("GET /public/:slug", () => {
    it("serves the page to an anonymous visitor", async () => {
      const res = await app.inject({ method: "GET", url: `${API}/public/about` });

      expect(res.statusCode).toBe(200);
      const page = res.json().data.page;
      expect(page.slug).toBe("about");
      expect(page.blocks.length).toBeGreaterThan(0);
      expect(page.blocks[0].type).toBe("heading");
    });

    it("rejects a slug the storefront has no route for", async () => {
      // Otherwise a page could be created and edited in the admin that no
      // visitor can ever reach.
      const res = await app.inject({ method: "GET", url: `${API}/public/secret-page` });
      expect(res.statusCode).toBe(422);
    });

    // One stale block must not turn the whole page into an error screen.
    it("drops a block that no longer parses instead of failing the page", async () => {
      await prisma.contentPage.update({
        where: { slug: "about" },
        data: {
          blocks: [
            { id: "ok", type: "text", body: "متن سالم" },
            { id: "broken", type: "text" },
            { id: "unknown", type: "type_that_no_longer_exists", foo: 1 },
          ],
        },
      });

      const res = await app.inject({ method: "GET", url: `${API}/public/about` });

      expect(res.statusCode).toBe(200);
      const blocks = res.json().data.page.blocks;
      expect(blocks).toHaveLength(1);
      expect(blocks[0].id).toBe("ok");
    });
  });

  describe("PATCH /:slug", () => {
    it("saves new blocks for an admin", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${API}/about`,
        headers: await adminAuth(),
        payload: {
          title: "درباره ارس پرو",
          blocks: [
            { id: "b1", type: "heading", text: "سلام", align: "center" },
            {
              id: "b2",
              type: "feature_cards",
              cards: [{ icon: "store", title: "کارت", description: "توضیح" }],
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.page.blocks).toHaveLength(2);
    });

    it("refuses an unknown block type", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${API}/about`,
        headers: await adminAuth(),
        payload: { blocks: [{ id: "x", type: "raw_html", html: "<script>alert(1)</script>" }] },
      });

      expect(res.statusCode).toBe(422);
    });

    it("refuses an icon the storefront cannot draw", async () => {
      // A free-text icon name would render an empty square on the live page.
      const res = await app.inject({
        method: "PATCH",
        url: `${API}/about`,
        headers: await adminAuth(),
        payload: {
          blocks: [
            {
              id: "x",
              type: "feature_cards",
              cards: [{ icon: "nope", title: "t", description: "d" }],
            },
          ],
        },
      });

      expect(res.statusCode).toBe(422);
    });

    it("refuses a javascript: destination on a button", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${API}/about`,
        headers: await adminAuth(),
        payload: {
          blocks: [
            {
              id: "x",
              type: "cta",
              title: "t",
              buttonLabel: "کلیک",
              // eslint-disable-next-line no-script-url
              buttonUrl: "javascript:alert(1)",
            },
          ],
        },
      });

      expect(res.statusCode).toBe(422);
    });

    it("refuses an edit from a customer", async () => {
      const { user } = await createTestUser();
      const res = await app.inject({
        method: "PATCH",
        url: `${API}/about`,
        headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
        payload: { title: "تغییر غیرمجاز" },
      });

      expect(res.statusCode).toBe(403);
    });

    it("requires authentication", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${API}/about`,
        payload: { title: "تغییر غیرمجاز" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("records who changed the page", async () => {
      const { user } = await createTestAdmin();
      await app.inject({
        method: "PATCH",
        url: `${API}/about`,
        headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
        payload: { title: "عنوان تازه" },
      });

      const entry = await prisma.auditLog.findFirst({
        where: { entityType: "ContentPage", userId: user.id },
      });
      expect(entry).not.toBeNull();
      expect(entry?.action).toBe("UPDATE");
    });
  });
});
