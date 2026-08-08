import { z } from "zod";

export const homepageSectionCreateSchema = z.object({
  key: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  type: z.string().min(1).max(50),
  config: z.record(z.unknown()).optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const homepageSectionUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.string().min(1).max(50).optional(),
  config: z.record(z.unknown()).optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const homepageSectionParamsSchema = z.object({
  id: z.string().uuid(),
});

export type HomepageSectionCreateBody = z.infer<typeof homepageSectionCreateSchema>;
export type HomepageSectionUpdateBody = z.infer<typeof homepageSectionUpdateSchema>;
export type HomepageSectionParams = z.infer<typeof homepageSectionParamsSchema>;
