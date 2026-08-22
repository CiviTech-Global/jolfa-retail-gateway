import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import { createTestAdmin, createTestUser, getAuthToken } from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";
import { KNOWN_SECTION_TYPES } from "./homepage-section.types.js";

async function buildTestApp(): Promise<FastifyInstance> {
  return createTestApp();
}

const BASE = "/api/v1/homepage-sections";

async function seedSection(
  key: string,
  overrides: Partial<{ type: string; isActive: boolean; displayOrder: number; title: string }> = {},
) {
  return prisma.homepageSection.create({
    data: {
      key,
      title: overrides.title ?? "بخش",
      type: overrides.type ?? "hero",
      displayOrder: overrides.displayOrder ?? 0,
      isActive: overrides.isActive ?? true,
    },
  });
}

describe("GET /api/v1/homepage-sections/public", () => {
  it("returns only active sections, ordered by displayOrder", async () => {
    const app = await buildTestApp();
    await seedSection("second", { displayOrder: 2 });
    await seedSection("first", { displayOrder: 1 });
    await seedSection("hidden", { displayOrder: 0, isActive: false });

    const res = await app.inject({ method: "GET", url: `${BASE}/public` });

    expect(res.statusCode).toBe(200);
    const keys = (res.json().data as { key: string }[]).map((s) => s.key);
    expect(keys).toEqual(["first", "second"]);
    await app.close();
  });

  it("returns an empty list when every section is deactivated", async () => {
    const app = await buildTestApp();
    await seedSection("off-1", { isActive: false });
    await seedSection("off-2", { isActive: false });

    const res = await app.inject({ method: "GET", url: `${BASE}/public` });

    expect(res.json().data).toEqual([]);
    await app.close();
  });

  it("requires no authentication", async () => {
    const app = await buildTestApp();

    expect((await app.inject({ method: "GET", url: `${BASE}/public` })).statusCode).toBe(200);
    await app.close();
  });
});

describe("GET /api/v1/homepage-sections (admin)", () => {
  it("returns inactive sections too, and is admin-gated", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    await seedSection("visible");
    await seedSection("invisible", { isActive: false });

    expect((await app.inject({ method: "GET", url: BASE })).statusCode).toBe(401);

    const forbidden = await app.inject({
      method: "GET",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });
    expect(forbidden.statusCode).toBe(403);

    const res = await app.inject({
      method: "GET",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });
    expect((res.json().data as { key: string }[]).map((s) => s.key).sort()).toEqual([
      "invisible",
      "visible",
    ]);
    await app.close();
  });
});

describe("POST /api/v1/homepage-sections (admin)", () => {
  it("creates a section with an arbitrary JSON config and audits it", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: {
        key: "home-hero",
        title: "اسلایدر اصلی",
        type: "hero_carousel",
        config: { slides: [{ image: "/a.jpg", caption: "سلام" }], autoplay: true, interval: 5000 },
        displayOrder: 1,
      },
    });

    expect(res.statusCode).toBe(201);
    const section = res.json().data;
    expect(section.type).toBe("hero_carousel");
    expect(section.config).toMatchObject({ autoplay: true, interval: 5000 });
    expect(section.config.slides).toHaveLength(1);

    const audits = await prisma.auditLog.findMany({ where: { entityType: "HomepageSection" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "CREATE", userId: admin.id });
    await app.close();
  });

  // Guards the admin UI's dropdown from being bypassed by a direct API call.
  it("rejects an unrecognised section type with 422", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { key: "bogus", title: "بد", type: "definitely_not_a_section" },
    });

    expect(res.statusCode).toBe(422);
    expect(await prisma.homepageSection.count({ where: { key: "bogus" } })).toBe(0);
    await app.close();
  });

  it("accepts every type listed in KNOWN_SECTION_TYPES", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);

    for (const type of KNOWN_SECTION_TYPES) {
      const res = await app.inject({
        method: "POST",
        url: BASE,
        headers: { authorization: `Bearer ${token}` },
        payload: { key: `key-${type}`, title: `بخش ${type}`, type },
      });
      expect(res.statusCode, `type ${type} should be accepted`).toBe(201);
    }

    expect(await prisma.homepageSection.count()).toBe(KNOWN_SECTION_TYPES.length);
    await app.close();
  });

  it("rejects a duplicate key with 409", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    await seedSection("taken-key");

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { key: "taken-key", title: "تکراری", type: "hero" },
    });

    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it("creates successfully with no config at all", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { key: "no-config", title: "بدون تنظیمات", type: "trust_badges" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.config).toBeNull();
    await app.close();
  });

  // A malformed body must be a 4xx, never a 500.
  it("rejects a malformed JSON body with a 400, not a 500", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "POST",
      url: BASE,
      headers: {
        authorization: `Bearer ${getAuthToken(app, admin)}`,
        "content-type": "application/json",
      },
      payload: '{"key": "broken", "title": ',
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("rejects a missing title with 422 and a CUSTOMER with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();

    const invalid = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { key: "no-title", type: "hero" },
    });
    expect(invalid.statusCode).toBe(422);

    const forbidden = await app.inject({
      method: "POST",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: { key: "x", title: "y", type: "hero" },
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });
});

describe("PATCH /api/v1/homepage-sections/:id (admin)", () => {
  it("applies a partial update without clobbering other fields", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const section = await seedSection("patch-target", { title: "عنوان", displayOrder: 5 });

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/${section.id}`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { title: "عنوان تازه" },
    });

    expect(res.statusCode).toBe(200);
    const updated = res.json().data;
    expect(updated.title).toBe("عنوان تازه");
    expect(updated.displayOrder).toBe(5);
    expect(updated.type).toBe("hero");
    await app.close();
  });

  it("reorders sections on the public endpoint via displayOrder", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const first = await seedSection("alpha", { displayOrder: 1 });
    await seedSection("beta", { displayOrder: 2 });

    await app.inject({
      method: "PATCH",
      url: `${BASE}/${first.id}`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { displayOrder: 3 },
    });

    const res = await app.inject({ method: "GET", url: `${BASE}/public` });
    expect((res.json().data as { key: string }[]).map((s) => s.key)).toEqual([
      "beta",
      "alpha",
    ]);
    await app.close();
  });

  it("removes a section from the public endpoint when deactivated", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const section = await seedSection("toggle-me");

    await app.inject({
      method: "PATCH",
      url: `${BASE}/${section.id}`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { isActive: false },
    });

    const res = await app.inject({ method: "GET", url: `${BASE}/public` });
    expect(res.json().data).toEqual([]);
    await app.close();
  });

  it("replaces the config object wholesale", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const section = await prisma.homepageSection.create({
      data: { key: "config-swap", title: "ت", type: "hero", config: { old: true, keep: 1 } },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/${section.id}`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { config: { fresh: true } },
    });

    expect(res.json().data.config).toEqual({ fresh: true });
    await app.close();
  });

  it("rejects an unknown type with 422 and an unknown id with 404", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const token = getAuthToken(app, admin);
    const section = await seedSection("type-guard");

    const badType = await app.inject({
      method: "PATCH",
      url: `${BASE}/${section.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: "made_up_type" },
    });
    expect(badType.statusCode).toBe(422);

    const missing = await app.inject({
      method: "PATCH",
      url: `${BASE}/00000000-0000-4000-8000-000000000000`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "x" },
    });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it("rejects a non-uuid id with 422", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/not-a-uuid`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { title: "x" },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });
});

describe("DELETE /api/v1/homepage-sections/:id (admin)", () => {
  it("hard-deletes the row, removes it from public output, and audits it", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const section = await seedSection("delete-target");

    const res = await app.inject({
      method: "DELETE",
      url: `${BASE}/${section.id}`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(await prisma.homepageSection.findUnique({ where: { id: section.id } })).toBeNull();

    const publicRes = await app.inject({ method: "GET", url: `${BASE}/public` });
    expect(publicRes.json().data).toEqual([]);

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "HomepageSection", action: "DELETE" },
    });
    expect(audits).toHaveLength(1);
    await app.close();
  });

  it("returns 404 for an unknown id, 403 for a CUSTOMER, 401 for anonymous", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    const { user: admin } = await createTestAdmin();
    const section = await seedSection("guarded-section");

    const missing = await app.inject({
      method: "DELETE",
      url: `${BASE}/00000000-0000-4000-8000-000000000000`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });
    expect(missing.statusCode).toBe(404);

    const forbidden = await app.inject({
      method: "DELETE",
      url: `${BASE}/${section.id}`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });
    expect(forbidden.statusCode).toBe(403);

    const anon = await app.inject({ method: "DELETE", url: `${BASE}/${section.id}` });
    expect(anon.statusCode).toBe(401);
    await app.close();
  });
});
