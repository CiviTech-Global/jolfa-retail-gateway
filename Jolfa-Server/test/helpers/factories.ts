import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";
import type {
  UserRole,
  User,
  Category,
  Product,
  Order,
  OrderStatus,
  PaymentStatus,
} from "@prisma/client";
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
}

export async function createTestCategory(options: CreateTestCategoryOptions = {}): Promise<Category> {
  return prisma.category.create({
    data: {
      name: options.name ?? "دسته آزمایشی",
      slug: options.slug ?? uniqueSlug("cat"),
      isActive: options.isActive ?? true,
    },
  });
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
  const categoryId = options.categoryId ?? (await createTestCategory()).id;
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

export interface CreateTestOrderOptions {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  shippingCost?: number;
  items?: { product: Product; quantity: number }[];
}

/**
 * Creates an Address + Order (+ OrderItems) directly via Prisma, bypassing the
 * HTTP layer. Used by tests whose subject is something OTHER than order
 * creation (payments, refunds, dashboard), so they don't depend on the order
 * endpoint's own behaviour.
 */
export async function createTestOrder(
  userId: string,
  options: CreateTestOrderOptions = {},
): Promise<Order> {
  const address = await prisma.address.create({
    data: {
      userId,
      recipientName: "علی رضایی",
      phone: "09121234567",
      province: "تهران",
      city: "تهران",
      addressLine: "خیابان ولیعصر، پلاک ۱",
    },
  });

  const items = options.items ?? [{ product: await createTestProduct(), quantity: 1 }];
  const totalAmount = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const shippingCost = options.shippingCost ?? 0;

  counter += 1;
  return prisma.order.create({
    data: {
      userId,
      orderNumber: `ORD-TEST-${counter}-${Date.now().toString(36)}`,
      status: options.status ?? "PENDING",
      paymentStatus: options.paymentStatus ?? "PENDING",
      totalAmount,
      shippingCost,
      finalAmount: totalAmount + shippingCost,
      shippingAddressId: address.id,
      items: {
        create: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.product.price,
          totalPrice: i.product.price * i.quantity,
          productTitle: i.product.title,
          productSku: i.product.sku,
        })),
      },
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
