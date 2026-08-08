import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from "fastify";
import { z, type ZodSchema } from "zod";
import { ValidationError } from "../app-error.js";

interface ValidateRequestOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!result[path]) {
      result[path] = [];
    }
    result[path].push(issue.message);
  }
  return result;
}

export function validateRequest(options: ValidateRequestOptions): preHandlerHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    try {
      if (options.body) {
        request.body = options.body.parse(request.body);
      }
      if (options.query) {
        request.query = options.query.parse(request.query);
      }
      if (options.params) {
        request.params = options.params.parse(request.params);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("اطلاعات ورودی معتبر نیست", formatZodErrors(error));
      }
      throw error;
    }
  };
}
