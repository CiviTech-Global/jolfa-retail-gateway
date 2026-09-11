import { prisma } from "../../shared/prisma.js";
import { AppError, ConflictError, NotFoundError } from "../../shared/app-error.js";
import { logAudit, buildChangeMetadata } from "../../shared/audit/audit.service.js";
import { uniqueSlug } from "../../shared/slugify.js";
import type { CategoryCreateBody, CategoryUpdateBody } from "./category.types.js";

/**
 * The catalogue is exactly two levels deep: Category -> Subcategory -> Product.
 *
 * A category with `parentId === null` is a top-level category and holds no
 * products of its own; it exists to group subcategories. A category with a
 * parent is a subcategory and is the only thing a product may belong to.
 *
 * The depth is capped rather than left open because every consumer depends on
 * it: the storefront renders two levels of navigation, breadcrumbs assume at
 * most one ancestor, and product listings expand a top-level category into its
 * children with a single join instead of a recursive walk. An unnoticed third
 * level would not fail loudly — it would quietly render products that no
 * navigation path reaches.
 */
export const MAX_CATEGORY_DEPTH = 2;

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  children: CategoryTreeNode[];
  /**
   * Active products reachable from this node. For a subcategory that is its own
   * products; for a top-level category it is the sum across its subcategories,
   * since a top-level category never holds products directly.
   *
   * Counted server-side because the storefront shows it on cards that do not
   * load the products themselves, and the admin needs it to know whether a
   * category can be deleted.
   */
  productCount: number;
}

const publicCategorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  parentId: true,
  displayOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

/** As above, plus the active-product tally used by cards and the admin list. */
const categorySelectWithCount = {
  ...publicCategorySelect,
  _count: { select: { products: { where: { isActive: true } } } },
};

type CategoryRowWithCount = Omit<CategoryTreeNode, "children" | "productCount"> & {
  _count: { products: number };
};

function toNode(row: CategoryRowWithCount): CategoryTreeNode {
  const { _count, ...rest } = row;
  return { ...rest, children: [], productCount: _count.products };
}

export async function listCategories(
  tree?: boolean,
  parentId?: string
): Promise<{ categories: CategoryTreeNode[] | unknown[] }> {
  const where = {
    isActive: true,
    parentId: parentId ?? null,
  };

  if (tree) {
    const allCategories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: categorySelectWithCount,
    });

    const categoryMap = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    for (const category of allCategories) {
      categoryMap.set(category.id, toNode(category));
    }

    for (const category of allCategories) {
      const node = categoryMap.get(category.id);
      if (!node) continue;

      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children.push(node);
        }
        // A child whose parent is inactive is deliberately dropped rather than
        // promoted to a root: hiding a category must hide everything under it,
        // or deactivating a category would scatter its subcategories across the
        // top level of the storefront.
      } else {
        roots.push(node);
      }
    }

    // A top-level category holds no products itself, so its own tally is always
    // zero. Roll the children up so cards can show a meaningful number.
    for (const root of roots) {
      root.productCount = root.children.reduce((sum, child) => sum + child.productCount, 0);
    }

    return { categories: roots };
  }

  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: categorySelectWithCount,
  });

  return { categories: categories.map(toNode) };
}

/** Enough of the parent to render a breadcrumb and a link back up. */
export interface CategoryAncestor {
  id: string;
  name: string;
  slug: string;
}

export async function getCategoryBySlug(slug: string): Promise<{
  category: CategoryTreeNode & { parent: CategoryAncestor | null };
}> {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      ...categorySelectWithCount,
      children: {
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: categorySelectWithCount,
      },
      // Returned so the storefront can render
      // خانه / دسته‌بندی‌ها / <parent> / <subcategory> without a second request.
      parent: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!category) {
    throw new NotFoundError("Category");
  }

  const { children, parent, ...rest } = category;
  const node = toNode(rest);
  const childNodes = children.map(toNode);

  return {
    category: {
      ...node,
      children: childNodes,
      parent,
      // Same roll-up as the tree: a top-level category's own count is zero, so
      // report what is reachable beneath it instead.
      productCount: childNodes.length
        ? childNodes.reduce((sum, child) => sum + child.productCount, 0)
        : node.productCount,
    },
  };
}

const categorySlugTaken = async (slug: string): Promise<boolean> => {
  const found = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  return found !== null;
};

/**
 * The chosen parent must exist and must itself be top-level.
 *
 * This is what keeps the tree two deep. Without it the model silently accepts
 * a subcategory of a subcategory, which type-checks and saves cleanly and then
 * strands every product beneath it: the storefront renders two levels, so a
 * third is unreachable, and the products in it are invisible rather than
 * missing — the kind of fault that surfaces as "why is this product not on the
 * site" weeks later.
 */
async function assertUsableAsParent(parentId: string): Promise<void> {
  const parent = await prisma.category.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true, name: true },
  });

  if (!parent) {
    throw new NotFoundError("Parent category");
  }

  if (parent.parentId !== null) {
    throw new AppError(
      `«${parent.name}» خود یک زیردسته است و نمی‌تواند والد باشد. ساختار فروشگاه دو سطح دارد: دسته‌بندی و زیردسته.`,
      400,
      "CATEGORY_DEPTH_EXCEEDED",
    );
  }
}

/**
 * A category that already has children cannot be demoted to a subcategory:
 * doing so would push its children to depth three.
 */
async function assertHasNoChildren(categoryId: string, name: string): Promise<void> {
  const child = await prisma.category.findFirst({
    where: { parentId: categoryId },
    select: { id: true },
  });

  if (child) {
    throw new AppError(
      `«${name}» دارای زیردسته است و نمی‌تواند خودش زیردسته شود. ابتدا زیردسته‌های آن را جابه‌جا کنید.`,
      400,
      "CATEGORY_HAS_CHILDREN",
    );
  }
}

export async function createCategory(data: CategoryCreateBody) {
  // An explicit slug is the admin's choice, so a clash is an error worth
  // reporting. A derived one is ours to make unique — Persian names slugify to
  // nothing, so otherwise every category after the first would collide.
  const slug =
    data.slug ??
    (await uniqueSlug(data.name, {
      prefix: "category",
      isTaken: categorySlugTaken,
      maxLength: 120,
    }));

  const existing = data.slug ? await prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  }) : null;
  if (existing) {
    throw new ConflictError("این اسلاگ دسته‌بندی قبلاً استفاده شده است");
  }

  if (data.parentId) {
    await assertUsableAsParent(data.parentId);
  }

  const category = await prisma.category.create({
    data: {
      ...data,
      slug,
    },
    select: publicCategorySelect,
  });

  return { category };
}

export async function createCategoryWithAudit(data: CategoryCreateBody, actorId?: string) {
  const result = await createCategory(data);
  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "CREATE",
      entityType: "Category",
      entityId: result.category.id,
      metadata: { slug: result.category.slug, name: result.category.name },
    });
  }
  return result;
}

export async function updateCategory(slug: string, data: CategoryUpdateBody) {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, parentId: true },
  });
  if (!category) {
    throw new NotFoundError("Category");
  }

  if (data.parentId) {
    if (data.parentId === category.id) {
      throw new AppError("دسته‌بندی نمی‌تواند والد خود باشد", 400, "BAD_REQUEST");
    }
    // Both directions have to be checked. `assertUsableAsParent` stops this
    // category being attached under a subcategory; `assertHasNoChildren` stops
    // it being demoted while it still has children of its own. Either alone
    // leaves a way to build a three-level tree.
    //
    // Together they also make a cycle unreachable: the only edge that can be
    // created runs from a childless node to a root, and a root has no parent to
    // loop back through. The previous code compared against `category.id` only,
    // which caught A -> A but not A -> B -> A.
    await assertUsableAsParent(data.parentId);
    await assertHasNoChildren(category.id, category.name);
  }

  // Promoting a subcategory to top level is allowed, but not while it still
  // holds products — products belong to subcategories only.
  if (data.parentId === null && category.parentId !== null) {
    const product = await prisma.product.findFirst({
      where: { categoryId: category.id },
      select: { id: true },
    });
    if (product) {
      throw new AppError(
        `«${category.name}» دارای محصول است و نمی‌تواند به دسته‌بندی اصلی تبدیل شود. محصولات فقط در زیردسته‌ها قرار می‌گیرند.`,
        400,
        "CATEGORY_HAS_PRODUCTS",
      );
    }
  }

  const newSlug = data.slug ?? slug;
  if (newSlug !== slug) {
    const existing = await prisma.category.findUnique({
      where: { slug: newSlug },
      select: { id: true },
    });
    if (existing && existing.id !== category.id) {
      throw new ConflictError("این اسلاگ دسته‌بندی قبلاً استفاده شده است");
    }
  }

  const updated = await prisma.category.update({
    where: { slug },
    data: {
      ...data,
      slug: newSlug,
    },
    select: publicCategorySelect,
  });

  return { category: updated };
}

export async function updateCategoryWithAudit(
  slug: string,
  data: CategoryUpdateBody,
  actorId?: string,
) {
  const existing = await prisma.category.findUnique({ where: { slug } });
  const before = existing
    ? { name: existing.name, isActive: existing.isActive, parentId: existing.parentId }
    : {};

  const result = await updateCategory(slug, data);

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "UPDATE",
      entityType: "Category",
      entityId: result.category.id,
      metadata: buildChangeMetadata(before, {
        name: result.category.name,
        isActive: result.category.isActive,
        parentId: result.category.parentId,
      }),
    });
  }

  return result;
}

export async function deleteCategory(slug: string, actorId?: string): Promise<{ success: true }> {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      // Deliberately NOT filtered to active rows. The foreign keys are
      // Restrict/NoAction, so an inactive product or a hidden subcategory blocks
      // the delete at the database anyway — and surfaces as a raw constraint
      // violation instead of a sentence the admin can act on. Checking every
      // row means the message always names the real reason.
      products: { select: { id: true }, take: 1 },
      children: { select: { id: true }, take: 1 },
    },
  });

  if (!category) {
    throw new NotFoundError("Category");
  }

  if (category.products.length > 0) {
    throw new ConflictError(
      "این زیردسته دارای محصول است و نمی‌تواند حذف شود. ابتدا محصولات آن را به زیردسته دیگری منتقل یا حذف کنید.",
    );
  }

  if (category.children.length > 0) {
    throw new ConflictError(
      "این دسته‌بندی دارای زیردسته است و نمی‌تواند حذف شود. ابتدا زیردسته‌های آن را حذف کنید.",
    );
  }

  await prisma.category.delete({ where: { slug } });

  if (actorId) {
    await logAudit({
      userId: actorId,
      action: "DELETE",
      entityType: "Category",
      entityId: category.id,
      metadata: { slug, name: category.name },
    });
  }

  return { success: true };
}

