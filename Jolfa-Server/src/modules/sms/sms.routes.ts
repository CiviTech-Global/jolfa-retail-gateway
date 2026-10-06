import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticate, authorize } from "../../shared/middleware/auth.js";
import { validateRequest } from "../../shared/middleware/validate-request.js";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import {
  getSmsAccountStatus,
  listSmsLog,
  listSmsTemplates,
  sendTestSms,
  updateSmsTemplate,
} from "./sms.service.js";
import {
  smsTemplateParamsSchema,
  smsTemplateUpdateSchema,
  smsTestSendSchema,
} from "./sms.types.js";
import type { SmsTemplateParams, SmsTemplateUpdateBody, SmsTestSendBody } from "./sms.types.js";

const adminPreHandler = [authenticate, authorize("ADMIN")];

const logQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  event: z.string().trim().optional(),
  status: z.enum(["PENDING", "SENT", "FAILED"]).optional(),
});

type LogQuery = z.infer<typeof logQuerySchema>;

const templates = asyncHandler(async (_request: FastifyRequest, reply: FastifyReply) => {
  sendSuccess(reply, await listSmsTemplates());
});

const update = asyncHandler(
  async (
    request: FastifyRequest<{ Params: SmsTemplateParams; Body: SmsTemplateUpdateBody }>,
    reply: FastifyReply,
  ) => {
    sendSuccess(
      reply,
      await updateSmsTemplate(request.params.event, request.body, request.user.id),
    );
  },
);

const testSend = asyncHandler(
  async (request: FastifyRequest<{ Body: SmsTestSendBody }>, reply: FastifyReply) => {
    sendSuccess(reply, await sendTestSms(request.body, request.user.id));
  },
);

const status = asyncHandler(async (_request: FastifyRequest, reply: FastifyReply) => {
  sendSuccess(reply, await getSmsAccountStatus());
});

const log = asyncHandler(
  async (request: FastifyRequest<{ Querystring: LogQuery }>, reply: FastifyReply) => {
    const { page, limit, event, status: rowStatus } = request.query;
    sendSuccess(reply, await listSmsLog(page, limit, event, rowStatus));
  },
);

export default async function smsRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  app.get("/sms/templates", { preHandler: adminPreHandler }, templates);

  app.patch(
    "/sms/templates/:event",
    {
      preHandler: [
        ...adminPreHandler,
        validateRequest({ params: smsTemplateParamsSchema, body: smsTemplateUpdateSchema }),
      ],
    },
    update,
  );

  // Sends one real message and spends real credit, which is why it is a POST
  // behind the admin guard and takes an explicit destination.
  app.post(
    "/sms/test",
    { preHandler: [...adminPreHandler, validateRequest({ body: smsTestSendSchema })] },
    testSend,
  );

  app.get("/sms/status", { preHandler: adminPreHandler }, status);

  app.get(
    "/sms/log",
    { preHandler: [...adminPreHandler, validateRequest({ query: logQuerySchema })] },
    log,
  );
}
