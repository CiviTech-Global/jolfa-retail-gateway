import { prisma } from "../../shared/prisma.js";
import { ConflictError, NotFoundError } from "../../shared/app-error.js";
import { Prisma } from "@prisma/client";
import type { ProductCreateBody, ProductUpdateBody } from "./product.types.js";

export interface ProductListFilters {
  page: number;
  limit: number;
  categorySlug?: string;
  q?: string;
  sort: "price:asc" | "price:desc" | "createdAt:desc" | "createdAt:asc";
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
}

const publicProductSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  shortDescription: true,
  price: true,
  compareAtPrice: true,
  stockQuantity: true,
  weightGrams: true,
  sku: true,
  categoryId: true,
  isActive: true,
  isFeatured: true,
  metaTitle: true,
  metaDescription: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  images: {
    orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
    select: {
      id: true,
      url: true,
      altText: true,
      sortOrder: true,
      isPrimary: true,
    },
  },
} satisfies Prisma.ProductSelect;

export async function listProducts(filters: ProductListFilters) {
  const { page, limit, categorySlug, q, sort, minPrice, maxPrice, featured } = filters;
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {
    isActive: true,
  };

  if (categorySlug) {
    where.category = { slug: categorySlug, isActive: true };
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { shortDescription: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) where.price.gte = minPrice;
    if (maxPrice !== undefined) where.price.lte = maxPrice;
  }

  if (featured) {
    where.isFeatured = true;
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput = {};
  if (sort === "price:asc") orderBy.price = "asc";
  else if (sort === "price:desc") orderBy.price = "desc";
  else if (sort === "createdAt:asc") orderBy.createdAt = "asc";
  else orderBy.createdAt = "desc";

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: publicProductSelect,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug, isActive: true },
    select: publicProductSelect,
  });

  if (!product) {
    throw new NotFoundError("Product");
  }

  const relatedProducts = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      isActive: true,
      id: { not: product.id },
    },
    orderBy: { createdAt: "desc" as const },
    take: 4,
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      shortDescription: true,
      images: {
        where: { isPrimary: true },
        select: { id: true, url: true, altText: true },
        take: 1,
      },
    },
  });

  return { product, relatedProducts };
}

export async function createProduct(data: ProductCreateBody) {
  const slug = data.slug ?? slugify(data.title);

  const existing = await prisma.product.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("این اسلاگ محصول قبلاً استفاده شده است");
  }

  if (data.sku) {
    const existingSku = await prisma.product.findUnique({
      where: { sku: data.sku },
      select: { id: true },
    });
    if (existingSku) {
      throw new ConflictError("این شناسه SKU قبلاً استفاده شده است");
    }
  }

  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
    select: { id: true },
  });
  if (!category) {
    throw new NotFoundError("Category");
  }

  const images = normalizeImages(data.images);

  const product = await prisma.product.create({
    data: {
      ...data,
      slug,
      images: {
        create: images,
      },
    },
    select: publicProductSelect,
  });

  return { product };
}

export async function updateProduct(slug: string, data: ProductUpdateBody) {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!product) {
    throw new NotFoundError("Product");
  }

  const newSlug = data.slug ?? slug;
  if (newSlug !== slug) {
    const existing = await prisma.product.findUnique({
      where: { slug: newSlug },
      select: { id: true },
    });
    if (existing && existing.id !== product.id) {
      throw new ConflictError("این اسلاگ محصول قبلاً استفاده شده است");
    }
  }

  if (data.sku) {
    const existingSku = await prisma.product.findUnique({
      where: { sku: data.sku },
      select: { id: true },
    });
    if (existingSku && existingSku.id !== product.id) {
      throw new ConflictError("این شناسه SKU قبلاً استفاده شده است");
    }
  }

  if (data.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundError("Category");
    }
  }

  const { images: inputImages, ...restData } = data;
  const updateData: Prisma.ProductUpdateInput = {
    ...restData,
    slug: newSlug,
  };

  if (inputImages) {
    const images = normalizeImages(inputImages);
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    updateData.images = {
      create: images,
    };
  }

  const updated = await prisma.product.update({
    where: { slug },
    data: updateData,
    select: publicProductSelect,
  });

  return { product: updated };
}

export async function deleteProduct(slug: string): Promise<{ success: true }> {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!product) {
    throw new NotFoundError("Product");
  }

  await prisma.product.update({
    where: { slug },
    data: { isActive: false },
  });

  return { success: true };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .substring(0, 220);
}

function normalizeImages(images: ProductCreateBody["images"]): ProductCreateBody["images"] {
  const hasPrimary = images.some((image) => image.isPrimary);
  if (!hasPrimary && images.length > 0) {
    return images.map((image, index) => (index === 0 ? { ...image, isPrimary: true } : image));
  }
  return images;
}
