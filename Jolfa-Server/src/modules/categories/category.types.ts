import { z } from "zod";

export const categoryListQuerySchema = z.object({
  tree: z
    .union([z.boolean(), z.string()])
    .transform((value) => {
      if (typeof value === "boolean") return value;
      return ["true", "1", "yes", "on"].includes(value.toLowerCase());
    })
    .optional(),
  parentId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
});

export const categoryCreateBodySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().max(500).optional().or(z.literal("").transform(() => undefined)),
  parentId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const categoryUpdateBodySchema = categoryCreateBodySchema.partial();

export const categoryParamsSchema = z.object({
  slug: z.string().min(1),
});

export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
export type CategoryCreateBody = z.infer<typeof categoryCreateBodySchema>;
export type CategoryUpdateBody = z.infer<typeof categoryUpdateBodySchema>;
export type CategoryParams = z.infer<typeof categoryParamsSchema>;
