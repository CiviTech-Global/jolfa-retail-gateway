import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { createTestApp } from "../../../test/helpers/build-app.js";
import { createTestAdmin, createTestUser, getAuthToken } from "../../../test/helpers/factories.js";
import { prisma } from "../../shared/prisma.js";

const API = "/api/v1";

describe("credential management", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /auth/change-password", () => {
    it("changes the password when the current one is correct", async () => {
      const { user, password } = await createTestUser();

      const response = await app.inject({
        method: "POST",
        url: `${API}/auth/change-password`,
        headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
        payload: { currentPassword: password, newPassword: "new-password-1" },
      });

      expect(response.statusCode).toBe(200);

      const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(await bcrypt.compare("new-password-1", updated.passwordHash)).toBe(true);
    });

    it("rejects a wrong current password", async () => {
      const { user } = await createTestUser();

      const response = await app.inject({
        method: "POST",
        url: `${API}/auth/change-password`,
        headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
        payload: { currentPassword: "not-my-password", newPassword: "new-password-1" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("requires authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: `${API}/auth/change-password`,
        payload: { currentPassword: "a", newPassword: "new-password-1" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("forgot / reset password", () => {
    it("completes a reset with the emitted code", async () => {
      const { user } = await createTestUser();

      const forgot = await app.inject({
        method: "POST",
        url: `${API}/auth/forgot-password`,
        payload: { phone: user.phone },
      });
      expect(forgot.statusCode).toBe(200);

      // No SMS provider is configured under test, so the code comes back for
      // local verification rather than being sent.
      const devCode = forgot.json().data.devCode as string;
      expect(devCode).toMatch(/^\d{6}$/);

      const reset = await app.inject({
        method: "POST",
        url: `${API}/auth/reset-password`,
        payload: { phone: user.phone, code: devCode, newPassword: "recovered-pass-1" },
      });
      expect(reset.statusCode).toBe(200);

      const login = await app.inject({
        method: "POST",
        url: `${API}/auth/login`,
        payload: { phone: user.phone, password: "recovered-pass-1" },
      });
      expect(login.statusCode).toBe(200);
    });

    it("rejects a wrong code and does not change the password", async () => {
      const { user, password } = await createTestUser();
      await app.inject({
        method: "POST",
        url: `${API}/auth/forgot-password`,
        payload: { phone: user.phone },
      });

      const reset = await app.inject({
        method: "POST",
        url: `${API}/auth/reset-password`,
        payload: { phone: user.phone, code: "000000", newPassword: "attacker-pass" },
      });
      expect(reset.statusCode).toBe(400);

      const login = await app.inject({
        method: "POST",
        url: `${API}/auth/login`,
        payload: { phone: user.phone, password },
      });
      expect(login.statusCode).toBe(200);
    });

    it("does not reveal whether a phone is registered", async () => {
      const unknown = await app.inject({
        method: "POST",
        url: `${API}/auth/forgot-password`,
        payload: { phone: "09999999999" },
      });

      // Same status and shape as the registered-phone case above.
      expect(unknown.statusCode).toBe(200);
      expect(unknown.json().data.message).toBeDefined();
    });

    it("burns the code after a single use", async () => {
      const { user } = await createTestUser();
      const forgot = await app.inject({
        method: "POST",
        url: `${API}/auth/forgot-password`,
        payload: { phone: user.phone },
      });
      const devCode = forgot.json().data.devCode as string;

      const first = await app.inject({
        method: "POST",
        url: `${API}/auth/reset-password`,
        payload: { phone: user.phone, code: devCode, newPassword: "first-pass-1" },
      });
      expect(first.statusCode).toBe(200);

      const replay = await app.inject({
        method: "POST",
        url: `${API}/auth/reset-password`,
        payload: { phone: user.phone, code: devCode, newPassword: "replayed-pass" },
      });
      expect(replay.statusCode).toBe(400);
    });

    it("throttles repeated code requests", async () => {
      const { user } = await createTestUser();
      await app.inject({
        method: "POST",
        url: `${API}/auth/forgot-password`,
        payload: { phone: user.phone },
      });

      const second = await app.inject({
        method: "POST",
        url: `${API}/auth/forgot-password`,
        payload: { phone: user.phone },
      });
      expect(second.statusCode).toBe(429);
    });

    it("stores the code hashed, never in plain text", async () => {
      const { user } = await createTestUser();
      const forgot = await app.inject({
        method: "POST",
        url: `${API}/auth/forgot-password`,
        payload: { phone: user.phone },
      });
      const devCode = forgot.json().data.devCode as string;

      const token = await prisma.passwordResetToken.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(token.codeHash).not.toBe(devCode);
      expect(await bcrypt.compare(devCode, token.codeHash)).toBe(true);
    });
  });

  describe("PATCH /admin/users/:id/password", () => {
    it("lets an admin set a new password for a user", async () => {
      const { user: admin } = await createTestAdmin();
      const { user } = await createTestUser();

      const response = await app.inject({
        method: "PATCH",
        url: `${API}/admin/users/${user.id}/password`,
        headers: { authorization: `Bearer ${getAuthToken(app, admin)}` },
        payload: { newPassword: "admin-set-pass-1" },
      });

      expect(response.statusCode).toBe(200);

      const login = await app.inject({
        method: "POST",
        url: `${API}/auth/login`,
        payload: { phone: user.phone, password: "admin-set-pass-1" },
      });
      expect(login.statusCode).toBe(200);
    });

    it("refuses a non-admin", async () => {
      const { user: actor } = await createTestUser();
      const { user: target } = await createTestUser();

      const response = await app.inject({
        method: "PATCH",
        url: `${API}/admin/users/${target.id}/password`,
        headers: { authorization: `Bearer ${getAuthToken(app, actor)}` },
        payload: { newPassword: "should-not-work" },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PATCH /auth/me", () => {
    it("updates the caller's own profile", async () => {
      const { user } = await createTestUser();

      const response = await app.inject({
        method: "PATCH",
        url: `${API}/auth/me`,
        headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
        payload: { firstName: "علی", lastName: "رضایی", email: "ali@example.com" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.user.firstName).toBe("علی");
    });

    it("rejects an email already used by another account", async () => {
      await createTestUser({ email: "taken@example.com" });
      const { user } = await createTestUser();

      const response = await app.inject({
        method: "PATCH",
        url: `${API}/auth/me`,
        headers: { authorization: `Bearer ${getAuthToken(app, user)}` },
        payload: { email: "taken@example.com" },
      });

      expect(response.statusCode).toBe(409);
    });
  });
});
