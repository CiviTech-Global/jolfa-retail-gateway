import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import { createTestAdmin, createTestUser, getAuthToken } from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";

async function buildTestApp(): Promise<FastifyInstance> {
  return createTestApp();
}

// The banner plugin is registered under the `/banners` prefix AND declares
// `/banners` + `/admin/banners` routes, so the effective paths are doubled.
// Jolfa-web calls these exact paths (features/cms/api.ts), so they are the
// real contract — asserted here so an "obvious" cleanup can't break the client.
const PUBLIC = "/api/v1/banners/banners";
const ADMIN = "/api/v1/banners/admin/banners";

async function seedBanner(
  title: string,
  overrides: Partial<{ position: string; isActive: boolean; displayOrder: number }> = {},
) {
  return prisma.banner.create({
    data: {
      title,
      imageUrl: `/banners/${title}.jpg`,
      position: overrides.position ?? "hero",
      isActive: overrides.isActive ?? true,
      displayOrder: overrides.displayOrder ?? 0,
    },
  });
}

describe("GET /api/v1/banners/banners (public)", () => {
  it("returns only active banners", async () => {
    const app = await buildTestApp();
    await seedBanner("live");
    await seedBanner("draft", { isActive: false });

    const res = await app.inject({ method: "GET", url: PUBLIC });

    expect(res.statusCode).toBe(200);
    const titles = (res.json().data.banners as { title: string }[]).map((b) => b.title);
    expect(titles).toEqual(["live"]);
    await app.close();
  });

  it("filters by position", async () => {
    const app = await buildTestApp();
    await seedBanner("hero-one", { position: "hero" });
    await seedBanner("side-one", { position: "sidebar" });

    const res = await app.inject({ method: "GET", url: `${PUBLIC}?position=sidebar` });

    const titles = (res.json().data.banners as { title: string }[]).map((b) => b.title);
    expect(titles).toEqual(["side-one"]);
    await app.close();
  });

  it("requires no authentication", async () => {
    const app = await buildTestApp();

    expect((await app.inject({ method: "GET", url: PUBLIC })).statusCode).toBe(200);
    await app.close();
  });
});

describe("GET /api/v1/banners/admin/banners", () => {
  it("includes inactive banners and is admin-gated", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    await seedBanner("shown");
    await seedBanner("hidden", { isActive: false });

    expect((await app.inject({ method: "GET", url: ADMIN })).statusCode).toBe(401);

    const forbidden = await app.inject({
      method: "GET",
      url: ADMIN,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });
    expect(forbidden.statusCode).toBe(403);

    const res = await app.inject({
      method: "GET",
      url: ADMIN,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });
    const titles = (res.json().data.banners as { title: string }[]).map((b) => b.title).sort();
    expect(titles).toEqual(["hidden", "shown"]);
    await app.close();
  });
});

describe("POST /api/v1/banners/admin/banners", () => {
  it("creates a banner and audits it", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "POST",
      url: ADMIN,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: {
        title: "تخفیف پاییزی",
        subtitle: "تا ۵۰٪",
        imageUrl: "/uploads/autumn.jpg",
        link: "/products?featured=true",
        position: "hero",
        displayOrder: 2,
      },
    });

    expect(res.statusCode).toBe(201);
    const banner = res.json().data.banner;
    expect(banner).toMatchObject({
      title: "تخفیف پاییزی",
      position: "hero",
      displayOrder: 2,
      isActive: true,
    });

    const audits = await prisma.auditLog.findMany({ where: { entityType: "Banner" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "CREATE", userId: admin.id });
    await app.close();
  });

  it("defaults position to 'hero' when omitted", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "POST",
      url: ADMIN,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { title: "بدون موقعیت", imageUrl: "/x.jpg" },
    });

    expect(res.json().data.banner.position).toBe("hero");
    await app.close();
  });

  it("rejects a missing imageUrl with 422 and a CUSTOMER with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();

    const invalid = await app.inject({
      method: "POST",
      url: ADMIN,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { title: "بدون تصویر" },
    });
    expect(invalid.statusCode).toBe(422);

    const forbidden = await app.inject({
      method: "POST",
      url: ADMIN,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: { title: "x", imageUrl: "/y.jpg" },
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });
});

describe("PATCH /api/v1/banners/admin/banners/:id", () => {
  it("applies a partial update without clobbering other fields", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const banner = await seedBanner("original", { position: "sidebar", displayOrder: 4 });

    const res = await app.inject({
      method: "PATCH",
      url: `${ADMIN}/${banner.id}`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { title: "تازه" },
    });

    expect(res.statusCode).toBe(200);
    const updated = res.json().data.banner;
    expect(updated.title).toBe("تازه");
    expect(updated.position).toBe("sidebar");
    expect(updated.displayOrder).toBe(4);
    await app.close();
  });

  it("hides the banner from the public endpoint when deactivated", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const banner = await seedBanner("toggle");

    await app.inject({
      method: "PATCH",
      url: `${ADMIN}/${banner.id}`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { isActive: false },
    });

    const res = await app.inject({ method: "GET", url: PUBLIC });
    expect(res.json().data.banners).toEqual([]);
    await app.close();
  });

  it("returns 404 for an unknown id and 422 for a non-uuid id", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    const missing = await app.inject({
      method: "PATCH",
      url: `${ADMIN}/00000000-0000-4000-8000-000000000000`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "x" },
    });
    expect(missing.statusCode).toBe(404);

    const invalid = await app.inject({
      method: "PATCH",
      url: `${ADMIN}/nope`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "x" },
    });
    expect(invalid.statusCode).toBe(422);
    await app.close();
  });
});

describe("DELETE /api/v1/banners/admin/banners/:id", () => {
  it("deletes the banner, clears it from public output, and audits it", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const banner = await seedBanner("remove-me");

    const res = await app.inject({
      method: "DELETE",
      url: `${ADMIN}/${banner.id}`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(await prisma.banner.findUnique({ where: { id: banner.id } })).toBeNull();

    const publicRes = await app.inject({ method: "GET", url: PUBLIC });
    expect(publicRes.json().data.banners).toEqual([]);

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "Banner", action: "DELETE" },
    });
    expect(audits).toHaveLength(1);
    await app.close();
  });

  it("returns 404 for an unknown id, 403 for a CUSTOMER, 401 for anonymous", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const banner = await seedBanner("guarded-banner");

    const missing = await app.inject({
      method: "DELETE",
      url: `${ADMIN}/00000000-0000-4000-8000-000000000000`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });
    expect(missing.statusCode).toBe(404);

    const forbidden = await app.inject({
      method: "DELETE",
      url: `${ADMIN}/${banner.id}`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });
    expect(forbidden.statusCode).toBe(403);

    const anon = await app.inject({ method: "DELETE", url: `${ADMIN}/${banner.id}` });
    expect(anon.statusCode).toBe(401);
    await app.close();
  });
});
