import { z } from "zod";

export const demoActionSchema = z.object({
  action: z.enum(["seed", "clear"]),
});

export type DemoActionBody = z.infer<typeof demoActionSchema>;
