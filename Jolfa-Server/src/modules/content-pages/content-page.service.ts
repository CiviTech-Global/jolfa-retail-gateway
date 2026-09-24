import type { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { NotFoundError } from "../../shared/app-error.js";
import { logAudit, buildChangeMetadata } from "../../shared/audit/audit.service.js";
import { contentBlockSchema } from "./content-page.types.js";
import type { ContentBlock, ContentPageUpdateBody } from "./content-page.types.js";
import { DEFAULT_CONTENT_PAGES } from "./content-page.defaults.js";

export interface ContentPageDto {
  slug: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  blocks: ContentBlock[];
  updatedAt: Date;
}

/**
 * Blocks come back from a JSONB column typed as `unknown`. They were validated
 * on the way in, but a row can also predate a block type being renamed, or have
 * been edited straight in psql, so each one is re-checked on the way out and a
 * block that no longer parses is dropped.
 *
 * Dropping rather than throwing is the deliberate choice: one stale block must
 * not turn the whole About page into an error screen for every visitor.
 */
function parseBlocks(raw: Prisma.JsonValue | null): ContentBlock[] {
  if (!Array.isArray(raw)) return [];
  const blocks: ContentBlock[] = [];
  for (const candidate of raw) {
    const result = contentBlockSchema.safeParse(candidate);
    if (result.success) blocks.push(result.data);
  }
  return blocks;
}

function toDto(page: {
  slug: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  blocks: Prisma.JsonValue;
  updatedAt: Date;
}): ContentPageDto {
  return {
    slug: page.slug,
    title: page.title,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    blocks: parseBlocks(page.blocks),
    updatedAt: page.updatedAt,
  };
}

/**
 * Creates any content page that does not exist yet, using the copy that used to
 * be hardcoded in the React bundle.
 *
 * Runs on boot beside the other seeding. `create`-only: an existing row is left
 * completely alone, so an admin's edits are never overwritten by a deploy —
 * the same trap that `ensureDefaultSettings` avoids by excluding `value` from
 * its upsert.
 */
export async function ensureDefaultContentPages(): Promise<void> {
  for (const page of DEFAULT_CONTENT_PAGES) {
    const existing = await prisma.contentPage.findUnique({
      where: { slug: page.slug },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.contentPage.create({
      data: {
        slug: page.slug,
        title: page.title,
        metaTitle: page.metaTitle ?? null,
        metaDescription: page.metaDescription ?? null,
        blocks: page.blocks as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

export async function getContentPage(slug: string): Promise<{ page: ContentPageDto }> {
  const page = await prisma.contentPage.findUnique({ where: { slug } });
  if (!page) {
    throw new NotFoundError("Content page");
  }
  return { page: toDto(page) };
}

export async function listContentPages(): Promise<{ pages: ContentPageDto[] }> {
  const pages = await prisma.contentPage.findMany({ orderBy: { slug: "asc" } });
  return { pages: pages.map(toDto) };
}

export async function updateContentPage(
  slug: string,
  data: ContentPageUpdateBody,
  actorId?: string,
): Promise<{ page: ContentPageDto }> {
  const existing = await prisma.contentPage.findUnique({ where: { slug } });
  if (!existing) {
    throw new NotFoundError("Content page");
  }

  const updated = await prisma.contentPage.update({
    where: { slug },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.metaTitle !== undefined ? { metaTitle: data.metaTitle } : {}),
      ...(data.metaDescription !== undefined ? { metaDescription: data.metaDescription } : {}),
      ...(data.blocks !== undefined
        ? { blocks: data.blocks as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "UPDATE",
      entityType: "ContentPage",
      entityId: updated.id,
      // The blocks themselves are far too large for an audit row; the count is
      // what makes an accidental "deleted everything" visible in the log.
      metadata: buildChangeMetadata(
        { title: existing.title, blockCount: parseBlocks(existing.blocks).length },
        { title: updated.title, blockCount: parseBlocks(updated.blocks).length },
      ),
    });
  }

  return { page: toDto(updated) };
}
