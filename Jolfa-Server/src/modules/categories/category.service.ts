import { prisma } from "../../shared/prisma.js";
import { AppError, ConflictError, NotFoundError } from "../../shared/app-error.js";
import type { CategoryCreateBody, CategoryUpdateBody } from "./category.types.js";

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
      select: publicCategorySelect,
    });

    const categoryMap = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    for (const category of allCategories) {
      categoryMap.set(category.id, { ...category, children: [] });
    }

    for (const category of allCategories) {
      const node = categoryMap.get(category.id);
      if (!node) continue;

      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return { categories: roots };
  }

  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: publicCategorySelect,
  });

  return { categories };
}

export async function getCategoryBySlug(slug: string): Promise<{
  category: CategoryTreeNode;
}> {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      ...publicCategorySelect,
      children: {
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: publicCategorySelect,
      },
    },
  });

  if (!category) {
    throw new NotFoundError("Category");
  }

  return {
    category: {
      ...category,
      children: category.children.map((child) => ({ ...child, children: [] })),
    },
  };
}

export async function createCategory(data: CategoryCreateBody) {
  const slug = data.slug ?? slugify(data.name);

  const existing = await prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("این اسلاگ دسته‌بندی قبلاً استفاده شده است");
  }

  if (data.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: data.parentId },
      select: { id: true },
    });
    if (!parent) {
      throw new NotFoundError("Parent category");
    }
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

export async function updateCategory(slug: string, data: CategoryUpdateBody) {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!category) {
    throw new NotFoundError("Category");
  }

  if (data.parentId) {
    if (data.parentId === category.id) {
      throw new AppError("دسته‌بندی نمی‌تواند والد خود باشد", 400, "BAD_REQUEST");
    }
    const parent = await prisma.category.findUnique({
      where: { id: data.parentId },
      select: { id: true },
    });
    if (!parent) {
      throw new NotFoundError("Parent category");
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

export async function deleteCategory(slug: string): Promise<{ success: true }> {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      products: { where: { isActive: true }, select: { id: true }, take: 1 },
      children: { where: { isActive: true }, select: { id: true }, take: 1 },
    },
  });

  if (!category) {
    throw new NotFoundError("Category");
  }

  if (category.products.length > 0) {
    throw new ConflictError("این دسته‌بندی دارای محصولات فعال است و نمی‌تواند حذف شود");
  }

  if (category.children.length > 0) {
    throw new ConflictError("این دسته‌بندی دارای زیردسته‌های فعال است و نمی‌تواند حذف شود");
  }

  await prisma.category.delete({ where: { slug } });

  return { success: true };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .substring(0, 120);
}
