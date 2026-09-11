import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";
import type { UserRole, User, Category, Product } from "@prisma/client";
import { prisma } from "../../src/shared/prisma.js";
import { generateTokens } from "../../src/modules/auth/auth.service.js";

let counter = 0;
function uniquePhone(): string {
  counter += 1;
  // 11 digits total, well within the 10-15 char phone validation range.
  return `09${String(100000000 + counter).padStart(9, "0")}`;
}

function uniqueSlug(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}-${Date.now().toString(36)}`;
}

export interface CreateTestUserOptions {
  phone?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
  firstName?: string;
  lastName?: string;
}

export async function createTestUser(
  options: CreateTestUserOptions = {},
): Promise<{ user: User; password: string }> {
  const password = options.password ?? "password123";
  // Low bcrypt cost factor keeps the test suite fast; the hash format is
  // identical to production, so bcrypt.compare() behaves the same either way.
  const passwordHash = await bcrypt.hash(password, 4);

  const user = await prisma.user.create({
    data: {
      phone: options.phone ?? uniquePhone(),
      email: options.email,
      passwordHash,
      role: options.role ?? "CUSTOMER",
      isActive: options.isActive ?? true,
      firstName: options.firstName,
      lastName: options.lastName,
    },
  });

  return { user, password };
}

export function getAuthToken(app: FastifyInstance, user: User): string {
  return generateTokens(user, app).accessToken;
}

export async function createTestAdmin(
  options: Omit<CreateTestUserOptions, "role"> = {},
): Promise<{ user: User; password: string }> {
  return createTestUser({ ...options, role: "ADMIN" });
}

export interface CreateTestCategoryOptions {
  name?: string;
  slug?: string;
  isActive?: boolean;
  /** Set to make this a subcategory. The parent must itself be top-level. */
  parentId?: string | null;
}

/**
 * Creates a top-level category by default, or a subcategory when `parentId` is
 * given. Note that a product cannot be attached to whatever this returns unless
 * it is a subcategory — see `createTestSubcategory`.
 */
export async function createTestCategory(options: CreateTestCategoryOptions = {}): Promise<Category> {
  return prisma.category.create({
    data: {
      name: options.name ?? "دسته آزمایشی",
      slug: options.slug ?? uniqueSlug("cat"),
      isActive: options.isActive ?? true,
      parentId: options.parentId ?? null,
    },
  });
}

/**
 * A subcategory, creating its parent if one is not supplied.
 *
 * Products belong to subcategories only — enforced by the service layer and by
 * a database trigger — so this, not `createTestCategory`, is what a product
 * needs. Kept as its own helper so a test that wants the two-level shape says
 * so, rather than passing a `parentId` whose significance is easy to miss.
 */
export async function createTestSubcategory(
  options: Omit<CreateTestCategoryOptions, "parentId"> & { parentId?: string } = {},
): Promise<Category> {
  const parentId = options.parentId ?? (await createTestCategory()).id;
  return createTestCategory({ ...options, parentId });
}

export interface CreateTestProductOptions {
  title?: string;
  slug?: string;
  price?: number;
  stockQuantity?: number;
  isActive?: boolean;
  categoryId?: string;
  sku?: string;
}

export async function createTestProduct(options: CreateTestProductOptions = {}): Promise<Product> {
  // A subcategory, not a bare category: the products table rejects a top-level
  // category outright.
  const categoryId = options.categoryId ?? (await createTestSubcategory()).id;
  return prisma.product.create({
    data: {
      title: options.title ?? "محصول آزمایشی",
      slug: options.slug ?? uniqueSlug("product"),
      price: options.price ?? 100_000,
      stockQuantity: options.stockQuantity ?? 10,
      isActive: options.isActive ?? true,
      categoryId,
      sku: options.sku ?? uniqueSlug("sku"),
    },
  });
}

export function validShippingAddress(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    recipientName: "علی رضایی",
    phone: "09121234567",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان ولیعصر، پلاک ۱",
    ...overrides,
  };
}
