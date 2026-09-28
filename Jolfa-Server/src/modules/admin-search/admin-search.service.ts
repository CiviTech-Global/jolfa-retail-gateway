import { prisma } from "../../shared/prisma.js";
import { containsAnyVariant, isNumericQuery, normalizeSearchTerm } from "../../shared/search-text.js";

/**
 * One search box over the whole admin panel.
 *
 * The header's search input was markup only — no state, no handler, no request —
 * so typing in it did nothing at all. This is what it now calls.
 *
 * Every entity is queried in parallel and capped, because the point is to put
 * the right row one keystroke away, not to page through results. Anyone who
 * wants the full list is one click from the section itself, which is what the
 * `seeAllUrl` on each group is for.
 */

export type AdminSearchEntity =
  | "product"
  | "order"
  | "user"
  | "category"
  | "transaction"
  | "page";

export interface AdminSearchHit {
  id: string;
  /** The line the admin reads first. */
  title: string;
  /** Disambiguates two rows with the same title: a SKU, a phone, a category. */
  subtitle?: string;
  /** Short status word rendered as a badge. */
  badge?: string;
  /** Where selecting the hit navigates to, inside the admin panel. */
  url: string;
}

export interface AdminSearchGroup {
  entity: AdminSearchEntity;
  /** Total matches, which can exceed `hits.length`. */
  total: number;
  hits: AdminSearchHit[];
  seeAllUrl: string;
}

const PER_GROUP = 5;

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل شده",
  CANCELLED: "لغو شده",
};

const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار",
  COMPLETED: "موفق",
  FAILED: "ناموفق",
  REFUNDED: "مسترد",
};

function fullName(user: { firstName: string | null; lastName: string | null; phone: string }): string {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.phone;
}

async function searchProducts(q: string): Promise<AdminSearchGroup> {
  const where = {
    OR: [
      ...containsAnyVariant("title", q),
      ...containsAnyVariant("sku", q),
      ...containsAnyVariant("slug", q),
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      take: PER_GROUP,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        sku: true,
        isActive: true,
        stockQuantity: true,
        category: { select: { name: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    entity: "product",
    total,
    seeAllUrl: `/admin/products?q=${encodeURIComponent(q)}`,
    hits: rows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: [row.category?.name, row.sku].filter(Boolean).join(" · ") || undefined,
      badge: !row.isActive ? "غیرفعال" : row.stockQuantity === 0 ? "ناموجود" : undefined,
      url: `/admin/products/${row.slug}/edit`,
    })),
  };
}

async function searchOrders(q: string): Promise<AdminSearchGroup> {
  // An order is usually looked up by its number, but an admin on the phone with
  // a customer has only their name or mobile, so the customer is searched too.
  const where = {
    OR: [
      ...containsAnyVariant("orderNumber", q),
      ...containsAnyVariant("trackingNumber", q),
      { user: { OR: [...containsAnyVariant("firstName", q), ...containsAnyVariant("lastName", q), ...containsAnyVariant("phone", q)] } },
      { shippingAddress: { OR: [...containsAnyVariant("recipientName", q), ...containsAnyVariant("phone", q)] } },
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      take: PER_GROUP,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        finalAmount: true,
        user: { select: { firstName: true, lastName: true, phone: true } },
        shippingAddress: { select: { recipientName: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    entity: "order",
    total,
    seeAllUrl: `/admin/orders?q=${encodeURIComponent(q)}`,
    hits: rows.map((row) => ({
      id: row.id,
      title: row.orderNumber,
      subtitle: row.user ? fullName(row.user) : row.shippingAddress.recipientName,
      badge: ORDER_STATUS_LABELS[row.status],
      url: `/admin/orders/${row.id}`,
    })),
  };
}

async function searchUsers(q: string): Promise<AdminSearchGroup> {
  const where = {
    OR: [
      ...containsAnyVariant("firstName", q),
      ...containsAnyVariant("lastName", q),
      ...containsAnyVariant("phone", q),
      ...containsAnyVariant("email", q),
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take: PER_GROUP,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    entity: "user",
    total,
    seeAllUrl: `/admin/users?q=${encodeURIComponent(q)}`,
    hits: rows.map((row) => ({
      id: row.id,
      title: fullName(row),
      subtitle: row.phone,
      badge: !row.isActive ? "غیرفعال" : row.role === "ADMIN" ? "مدیر" : undefined,
      url: `/admin/users?q=${encodeURIComponent(row.phone)}`,
    })),
  };
}

async function searchCategories(q: string): Promise<AdminSearchGroup> {
  const where = {
    OR: [...containsAnyVariant("name", q), ...containsAnyVariant("slug", q)],
  };

  const [rows, total] = await Promise.all([
    prisma.category.findMany({
      where,
      take: PER_GROUP,
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        name: true,
        isActive: true,
        parent: { select: { name: true } },
        _count: { select: { products: true } },
      },
    }),
    prisma.category.count({ where }),
  ]);

  return {
    entity: "category",
    total,
    seeAllUrl: "/admin/categories",
    hits: rows.map((row) => ({
      id: row.id,
      title: row.name,
      subtitle: row.parent ? `زیردسته «${row.parent.name}»` : "دسته‌بندی اصلی",
      badge: !row.isActive ? "غیرفعال" : undefined,
      url: "/admin/categories",
    })),
  };
}

async function searchTransactions(q: string): Promise<AdminSearchGroup> {
  // Reference numbers are the whole point here: a customer disputing a payment
  // quotes a ref number, and nothing else in the panel finds it.
  const where = {
    OR: [
      ...containsAnyVariant("refId", q),
      ...containsAnyVariant("authority", q),
      { order: { OR: containsAnyVariant("orderNumber", q) } },
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      take: PER_GROUP,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        refId: true,
        authority: true,
        status: true,
        amount: true,
        order: { select: { id: true, orderNumber: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    entity: "transaction",
    total,
    seeAllUrl: "/admin/transactions",
    hits: rows.map((row) => ({
      id: row.id,
      title: row.refId ?? row.authority ?? row.id.slice(0, 8),
      subtitle: row.order?.orderNumber,
      badge: TRANSACTION_STATUS_LABELS[row.status],
      // Transactions are only meaningful beside their order.
      url: row.order ? `/admin/orders/${row.order.id}` : "/admin/transactions",
    })),
  };
}

async function searchPages(q: string): Promise<AdminSearchGroup> {
  const where = { OR: [...containsAnyVariant("title", q), ...containsAnyVariant("slug", q)] };

  const [rows, total] = await Promise.all([
    prisma.contentPage.findMany({
      where,
      take: PER_GROUP,
      orderBy: { slug: "asc" },
      select: { id: true, slug: true, title: true },
    }),
    prisma.contentPage.count({ where }),
  ]);

  return {
    entity: "page",
    total,
    seeAllUrl: "/admin/pages",
    hits: rows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: `/${row.slug}`,
      url: `/admin/pages/${row.slug}`,
    })),
  };
}

export interface AdminSearchResult {
  query: string;
  groups: AdminSearchGroup[];
  tookMs: number;
}

export async function searchAdmin(rawQuery: string): Promise<AdminSearchResult> {
  const query = normalizeSearchTerm(rawQuery);
  const started = Date.now();

  if (query.length === 0) {
    return { query, groups: [], tookMs: 0 };
  }

  // A digits-only query is a phone, an order number or a reference: searching
  // category and page titles for it can only produce noise.
  const numeric = isNumericQuery(query);

  const searches = numeric
    ? [searchOrders(query), searchUsers(query), searchTransactions(query), searchProducts(query)]
    : [
        searchProducts(query),
        searchOrders(query),
        searchUsers(query),
        searchCategories(query),
        searchTransactions(query),
        searchPages(query),
      ];

  // In parallel: the slowest query sets the response time rather than the sum,
  // which is what keeps the palette usable while typing.
  const groups = await Promise.all(searches);

  return {
    query,
    // Empty groups are dropped so the UI never renders a heading with nothing
    // under it, and the order above is preserved as relevance order.
    groups: groups.filter((group) => group.hits.length > 0),
    tookMs: Date.now() - started,
  };
}
