import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { rm } from "node:fs/promises";
import { createTestApp } from "../../../test/helpers/build-app.js";
import { createTestAdmin, createTestUser, getAuthToken } from "../../../test/helpers/factories.js";
import { getUploadDir } from "./upload.service.js";

/** Smallest valid PNG: an 8-byte signature is what the sniffer checks. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngBody = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(64)]);

function multipart(
  parts: { filename: string; contentType: string; body: Buffer },
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = "----vitestboundary1234567890";
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${parts.filename}"\r\n` +
      `Content-Type: ${parts.contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, parts.body, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

describe("POST /api/v1/uploads", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await rm(getUploadDir(), { recursive: true, force: true });
  });

  it("stores a valid image and returns an absolute URL", async () => {
    const { user } = await createTestAdmin();
    const { payload, headers } = multipart({
      filename: "photo.png",
      contentType: "image/png",
      body: pngBody,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/uploads",
      headers: { ...headers, authorization: `Bearer ${getAuthToken(app, user)}` },
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    // Relative URLs resolve against the web app's origin, not the API's, and
    // render as broken images.
    expect(body.data.url).toMatch(/^https?:\/\/.+\/uploads\/.+\.png$/);
    expect(body.data.filename).toMatch(/\.png$/);
  });

  it("rejects a non-image mimetype", async () => {
    const { user } = await createTestAdmin();
    const { payload, headers } = multipart({
      filename: "notes.txt",
      contentType: "text/plain",
      body: Buffer.from("hello"),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/uploads",
      headers: { ...headers, authorization: `Bearer ${getAuthToken(app, user)}` },
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INVALID_FILE_TYPE");
  });

  it("rejects a file whose content does not match its declared type", async () => {
    const { user } = await createTestAdmin();
    const { payload, headers } = multipart({
      filename: "evil.png",
      contentType: "image/png",
      body: Buffer.from("MZ this is not a png"),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/uploads",
      headers: { ...headers, authorization: `Bearer ${getAuthToken(app, user)}` },
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INVALID_FILE_CONTENT");
  });

  it("returns a structured error when the request is not multipart", async () => {
    const { user } = await createTestAdmin();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/uploads",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${getAuthToken(app, user)}`,
      },
      payload: {},
    });

    // This is exactly what the web client used to send for every upload.
    expect(response.statusCode).toBe(415);
    expect(response.json().error.code).toBe("INVALID_CONTENT_TYPE");
  });

  it("requires an admin", async () => {
    const { user } = await createTestUser();
    const { payload, headers } = multipart({
      filename: "photo.png",
      contentType: "image/png",
      body: pngBody,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/uploads",
      headers: { ...headers, authorization: `Bearer ${getAuthToken(app, user)}` },
      payload,
    });

    expect(response.statusCode).toBe(403);
  });
});
