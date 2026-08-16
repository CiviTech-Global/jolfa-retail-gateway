import { z } from "zod";

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  role: z.enum(["CUSTOMER", "ADMIN"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export const userRoleUpdateSchema = z.object({
  role: z.enum(["CUSTOMER", "ADMIN"]),
});

export const userStatusUpdateSchema = z.object({
  isActive: z.boolean(),
});

export const userParamsSchema = z.object({
  id: z.string().uuid(),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type UserRoleUpdateBody = z.infer<typeof userRoleUpdateSchema>;
export type UserStatusUpdateBody = z.infer<typeof userStatusUpdateSchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
