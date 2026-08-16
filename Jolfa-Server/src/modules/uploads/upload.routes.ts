import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { saveUploadFile } from "./upload.service.js";
import { AppError } from "../../shared/app-error.js";

export default async function uploadRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  app.post(
    "/",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request, reply) => {
      const file = await request.file();
      if (!file) {
        throw new AppError("No file provided", 400, "MISSING_FILE");
      }

      const buffer = await file.toBuffer();
      const uploaded = await saveUploadFile(buffer, file.filename, file.mimetype);

      return reply.status(201).send({
        success: true,
        data: uploaded,
      });
    },
  );
}
