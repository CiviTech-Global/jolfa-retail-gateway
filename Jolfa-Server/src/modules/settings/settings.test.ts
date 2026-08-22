import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../../../test/helpers/build-app.js";
import { createTestAdmin, createTestUser, getAuthToken } from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";

async function buildTestApp(): Promise<FastifyInstance> {
  return createTestApp();
}

const BASE = "/api/v1/settings";

async function seedSetting(key: string, value: string, isPublic: boolean, group = "general") {
  return prisma.setting.create({ data: { key, value, isPublic, group } });
}

describe("GET /api/v1/settings/public", () => {
  it("returns only settings flagged isPublic", async () => {
    const app = await buildTestApp();
    await seedSetting("site_name", "فروشگاه جلفا", true);
    await seedSetting("smtp_password", "super-secret", false);

    const res = await app.inject({ method: "GET", url: `${BASE}/public` });

    expect(res.statusCode).toBe(200);
    const keys = res.json().data.settings.map((s: { key: string }) => s.key);
    expect(keys).toEqual(["site_name"]);
    // A private setting's value must not leak anywhere in the payload.
    expect(res.body).not.toContain("super-secret");
    await app.close();
  });

  it("requires no authentication", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: `${BASE}/public` });

    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("returns an empty list when nothing is public", async () => {
    const app = await buildTestApp();
    await seedSetting("internal_flag", "x", false);

    const res = await app.inject({ method: "GET", url: `${BASE}/public` });

    expect(res.json().data.settings).toEqual([]);
    await app.close();
  });
});

describe("GET /api/v1/settings (admin)", () => {
  it("rejects anonymous with 401 and CUSTOMER with 403", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();

    expect((await app.inject({ method: "GET", url: BASE })).statusCode).toBe(401);

    const forbidden = await app.inject({
      method: "GET",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });

  it("returns public AND private settings for an admin", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    await seedSetting("site_name", "جلفا", true);
    await seedSetting("smtp_password", "secret", false);

    const res = await app.inject({
      method: "GET",
      url: BASE,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
    });

    expect(res.statusCode).toBe(200);
    const keys = (res.json().data.settings as { key: string }[]).map((s) => s.key).sort();
    expect(keys).toEqual(["site_name", "smtp_password"]);
    await app.close();
  });
});

describe("PATCH /api/v1/settings/:key (admin)", () => {
  it("updates a value and writes an audit row capturing the change", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    const setting = await seedSetting("site_name", "قدیمی", true);

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/site_name`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { value: "جدید" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.setting.value).toBe("جدید");
    expect((await prisma.setting.findUnique({ where: { key: "site_name" } }))?.value).toBe("جدید");

    const audits = await prisma.auditLog.findMany({ where: { entityType: "Setting" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ entityId: setting.id, userId: admin.id, action: "UPDATE" });
    await app.close();
  });

  it("takes effect immediately on the public endpoint", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    await seedSetting("tagline", "قبل", true);

    await app.inject({
      method: "PATCH",
      url: `${BASE}/tagline`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { value: "بعد" },
    });

    const res = await app.inject({ method: "GET", url: `${BASE}/public` });
    const tagline = (res.json().data.settings as { key: string; value: string }[]).find(
      (s) => s.key === "tagline",
    );
    expect(tagline?.value).toBe("بعد");
    await app.close();
  });

  it("accepts an empty-string value", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    await seedSetting("optional_note", "something", true);

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/optional_note`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { value: "" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.setting.value).toBe("");
    await app.close();
  });

  it("returns 404 for an unknown key — it does not create one", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/never_seeded`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { value: "x" },
    });

    expect(res.statusCode).toBe(404);
    expect(await prisma.setting.count({ where: { key: "never_seeded" } })).toBe(0);
    await app.close();
  });

  it("rejects a non-string value with 422", async () => {
    const app = await buildTestApp();
    const { user: admin } = await createTestAdmin();
    await seedSetting("numeric_setting", "1", true);

    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/numeric_setting`,
      headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
      payload: { value: 42 },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it("rejects a CUSTOMER with 403 and anonymous with 401", async () => {
    const app = await buildTestApp();
    const { user } = await createTestUser();
    await seedSetting("guarded", "v", true);

    const anon = await app.inject({
      method: "PATCH",
      url: `${BASE}/guarded`,
      payload: { value: "x" },
    });
    expect(anon.statusCode).toBe(401);

    const forbidden = await app.inject({
      method: "PATCH",
      url: `${BASE}/guarded`,
      headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
      payload: { value: "x" },
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });
});
