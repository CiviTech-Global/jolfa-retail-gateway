import { z } from "zod";

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 200;
/** Past any real catalogue, and low enough that the row offset stays valid. */
const MAX_PAGE = 1_000_000;

/**
 * Forgiving on purpose. A machine is on the other end, and an odd value should
 * still get a usable page rather than an error that stops the whole crawl.
 */
export const emallsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
  item_per_page: z.coerce
    .number()
    .int()
    .min(1)
    .catch(DEFAULT_PER_PAGE)
    .transform((value) => Math.min(value, MAX_PER_PAGE)),
});

export type EmallsQuery = z.infer<typeof emallsQuerySchema>;
