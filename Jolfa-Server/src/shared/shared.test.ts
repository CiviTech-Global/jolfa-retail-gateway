import { describe, expect, it } from "vitest";
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./app-error.js";

/**
 * Pure unit tests for the error taxonomy. These classes decide the status code
 * and machine-readable `code` of every failed request, and `src/index.ts`'s
 * error handler reads `statusCode`/`code`/`details` off them by duck-typing —
 * so their shape is a contract, not an implementation detail.
 */
describe("AppError", () => {
  it("defaults to a 500 INTERNAL_ERROR", () => {
    const error = new AppError("boom");

    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.details).toBeUndefined();
    expect(error.message).toBe("boom");
  });

  it("is a real Error subclass with a captured stack", () => {
    const error = new AppError("boom");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppError");
    expect(typeof error.stack).toBe("string");
  });

  it("carries an explicit status, code and details", () => {
    const error = new AppError("nope", 418, "IM_A_TEAPOT", { brewing: true });

    expect(error.statusCode).toBe(418);
    expect(error.code).toBe("IM_A_TEAPOT");
    expect(error.details).toEqual({ brewing: true });
  });
});

describe("error subclasses map to the right status codes", () => {
  it.each([
    [new BadRequestError(), 400, "BAD_REQUEST"],
    [new UnauthorizedError(), 401, "UNAUTHORIZED"],
    [new ForbiddenError(), 403, "FORBIDDEN"],
    [new NotFoundError(), 404, "NOT_FOUND"],
    [new ConflictError(), 409, "CONFLICT"],
    [new ValidationError(), 422, "VALIDATION_ERROR"],
  ])("%s -> %i %s", (error, statusCode, code) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(statusCode);
    expect(error.code).toBe(code);
  });

  it("builds NotFoundError's message from the resource name", () => {
    expect(new NotFoundError("Order").message).toBe("Order not found");
    expect(new NotFoundError().message).toBe("Resource not found");
  });

  it("preserves custom messages on each subclass", () => {
    expect(new ConflictError("موجودی کافی نیست").message).toBe("موجودی کافی نیست");
    expect(new ForbiddenError("no entry").message).toBe("no entry");
  });

  it("carries details on the error types that accept them", () => {
    expect(new BadRequestError("bad", { field: "phone" }).details).toEqual({ field: "phone" });
    expect(new ValidationError("invalid", { phone: ["too short"] }).details).toEqual({
      phone: ["too short"],
    });
  });

  it("leaves details undefined when not supplied, so the handler omits the key", () => {
    expect(new ValidationError("invalid").details).toBeUndefined();
    expect(new UnauthorizedError().details).toBeUndefined();
  });
});
