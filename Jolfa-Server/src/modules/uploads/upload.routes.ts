import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { saveUploadFile, formatMaxFileSize } from "./upload.service.js";
import { AppError } from "../../shared/app-error.js";

/** Fastify multipart signals these through `error.code`, not a status. */
const MULTIPART_ERRORS: Record<string, AppError> = {
  FST_REQ_FILE_TOO_LARGE: new AppError(
    `حجم فایل باید کمتر از ${formatMaxFileSize()} باشد`,
    413,
    "FILE_TOO_LARGE",
  ),
  FST_INVALID_MULTIPART_CONTENT_TYPE: new AppError(
    "درخواست باید از نوع multipart/form-data باشد",
    415,
    "INVALID_CONTENT_TYPE",
  ),
  FST_FILES_LIMIT: new AppError("تعداد فایل‌ها بیش از حد مجاز است", 400, "TOO_MANY_FILES"),
};

export default async function uploadRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  app.post(
    "/",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request, reply) => {
      let file;
      try {
        file = await request.file();
      } catch (error) {
        const code = (error as { code?: string }).code ?? "";
        throw MULTIPART_ERRORS[code] ?? error;
      }

      if (!file) {
        throw new AppError("فایلی انتخاب نشده است", 400, "MISSING_FILE");
      }

      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch (error) {
        const code = (error as { code?: string }).code ?? "";
        throw MULTIPART_ERRORS[code] ?? error;
      }

      // `toBuffer()` resolves even when the stream was truncated at the limit,
      // so the flag has to be checked explicitly.
      if (file.file.truncated) {
        throw MULTIPART_ERRORS.FST_REQ_FILE_TOO_LARGE;
      }

      const uploaded = await saveUploadFile(buffer, file.filename, file.mimetype);

      return reply.status(201).send({
        success: true,
        data: uploaded,
      });
    },
  );
}
