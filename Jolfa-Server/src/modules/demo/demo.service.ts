import { prisma } from "../../shared/prisma.js";
import { AppError } from "../../shared/app-error.js";

const DEMO_CATEGORY_PREFIX = "demo-";
const DEMO_PRODUCT_PREFIX = "demo-";

const demoCategories = [
  { name: "چای و دمنوش", slug: "demo-chai", imageUrl: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=400" },
  { name: "عسل و مربا", slug: "demo-asal", imageUrl: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400" },
  { name: "ادویه و چاشنی", slug: "demo-adviye", imageUrl: "https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=400" },
  { name: "خشکبار و آجیل", slug: "demo-khoshkbar", imageUrl: "https://images.unsplash.com/photo-1606923829579-0cb981a83e2e?w=400" },
];

const demoProducts = [
  {
    title: "چای سیاه ارگانیک",
    slug: "demo-black-tea",
    description: "چای سیاه مرغوب با عطر و طعم اصیل ایرانی.",
    price: 185000,
    compareAtPrice: 220000,
    stockQuantity: 45,
    isActive: true,
    isFeatured: true,
    categorySlug: "demo-chai",
    imageUrl: "https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=600",
  },
  {
    title: "عسل طبیعی کوهستان",
    slug: "demo-mountain-honey",
    description: "عسل خام و طبیعی حاصل از کوهستان‌های سرسبز.",
    price: 340000,
    compareAtPrice: 380000,
    stockQuantity: 20,
    isActive: true,
    isFeatured: true,
    categorySlug: "demo-asal",
    imageUrl: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600",
  },
  {
    title: "زعفران سرگل درجه یک",
    slug: "demo-saffron",
    description: "زعفران سرگل خالص با رنگ و عطر فوق‌العاده.",
    price: 890000,
    compareAtPrice: 950000,
    stockQuantity: 12,
    isActive: true,
    isFeatured: true,
    categorySlug: "demo-adviye",
    imageUrl: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600",
  },
  {
    title: "مغز گردو خام",
    slug: "demo-walnut",
    description: "گردو تازه و مرغوب، مناسب مصرف روزانه.",
    price: 275000,
    compareAtPrice: null,
    stockQuantity: 60,
    isActive: true,
    isFeatured: false,
    categorySlug: "demo-khoshkbar",
    imageUrl: "https://images.unsplash.com/photo-1575481636764-7f8bc25b5d1f?w=600",
  },
  {
    title: "چای سبز لاغری",
    slug: "demo-green-tea",
    description: "چای سبز با آنتی‌اکسیدان بالا برای سلامتی.",
    price: 145000,
    compareAtPrice: 165000,
    stockQuantity: 35,
    isActive: true,
    isFeatured: false,
    categorySlug: "demo-chai",
    imageUrl: "https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=600",
  },
  {
    title: "مربای گل محمدی",
    slug: "demo-rose-jam",
    description: "مربای سنتی گل محمدی با شهد طبیعی.",
    price: 120000,
    compareAtPrice: 135000,
    stockQuantity: 28,
    isActive: true,
    isFeatured: true,
    categorySlug: "demo-asal",
    imageUrl: "https://images.unsplash.com/photo-1601000938259-9e9200199226?w=600",
  },
];

const demoHomepageSections = [
  {
    key: "hero",
    title: "اسلایدر بنر",
    type: "hero",
    config: {
      banners: [
        {
          id: "b1",
          title: "تازگی محصولات محلی",
          subtitle: "از کوهستان تا سبد خرید شما",
          image: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200",
          link: "/products",
          buttonText: "مشاهده محصولات",
        },
      ],
    },
    displayOrder: 0,
    isActive: true,
  },
  {
    key: "categories",
    title: "دسته‌بندی‌ها",
    type: "categories",
    config: { limit: 8 },
    displayOrder: 1,
    isActive: true,
  },
  {
    key: "featured_products",
    title: "محصولات ویژه",
    type: "featured_products",
    config: { filter: "featured", limit: 8 },
    displayOrder: 2,
    isActive: true,
  },
  {
    key: "new_products",
    title: "جدیدترین محصولات",
    type: "new_products",
    config: { filter: "new", limit: 8 },
    displayOrder: 3,
    isActive: true,
  },
  {
    key: "promo_banner",
    title: "تخفیف‌دارها",
    type: "promo_banner",
    config: { filter: "discounted", limit: 8 },
    displayOrder: 4,
    isActive: true,
  },
  {
    key: "trust_badges",
    title: "نمادهای اعتماد",
    type: "trust_badges",
    config: {
      badges: [
        { icon: "ShieldCheck", title: "ضمانت اصالت", description: "کالاهای ۱۰۰٪ اصل" },
        { icon: "Truck", title: "ارسال سریع", description: "تحویل به موقع" },
        { icon: "RefreshCcw", title: "بازگشت وجه", description: "در صورت نارضایتی" },
        { icon: "Headphones", title: "پشتیبانی", description: "۷ روز هفته" },
      ],
    },
    displayOrder: 5,
    isActive: true,
  },
  {
    key: "newsletter",
    title: "خبرنامه",
    type: "newsletter",
    config: {
      title: "از تخفیف‌ها جا نمانید",
      description: "ایمیل خود را وارد کنید تا از جدیدترین پیشنهادها مطلع شوید.",
      buttonText: "عضویت",
    },
    displayOrder: 6,
    isActive: true,
  },
];

const demoSettings = [
  { key: "show_hero", value: "true" },
  { key: "show_categories", value: "true" },
  { key: "show_featured_products", value: "true" },
  { key: "show_new_products", value: "true" },
  { key: "show_discounted_products", value: "true" },
  { key: "show_trust_badges", value: "true" },
  { key: "show_newsletter", value: "true" },
];

async function seedDemoCategories() {
  for (const cat of demoCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
}

async function seedDemoProducts() {
  const categories = await prisma.category.findMany({
    where: { slug: { startsWith: DEMO_CATEGORY_PREFIX } },
  });
  const categoryMap = new Map(categories.map((c) => [c.slug, c.id]));

  for (const product of demoProducts) {
    const categoryId = categoryMap.get(product.categorySlug);
    if (!categoryId) continue;

    const { categorySlug: _categorySlug, imageUrl, ...productData } = product;
    const upserted = await prisma.product.upsert({
      where: { slug: product.slug },
      update: { ...productData, categoryId },
      create: { ...productData, categoryId },
    });

    await prisma.productImage.deleteMany({ where: { productId: upserted.id } });
    await prisma.productImage.create({
      data: {
        productId: upserted.id,
        url: imageUrl,
        altText: product.title,
        isPrimary: true,
        sortOrder: 0,
      },
    });
  }
}

async function ensureAdminAddress(adminId: string) {
  const existing = await prisma.address.findFirst({
    where: { userId: adminId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.id;

  const address = await prisma.address.create({
    data: {
      userId: adminId,
      title: "آدرس دمو",
      recipientName: "مدیر سیستم",
      phone: "09120000000",
      province: "آذربایجان شرقی",
      city: "جلفا",
      addressLine: "جلفا، خیابان اصلی، فروشگاه نمونه",
      isDefault: true,
    },
  });
  return address.id;
}

function generateOrderNumber(index: number) {
  const now = Date.now().toString(36).toUpperCase();
  return `DEMO-${now}-${String(index + 1).padStart(3, "0")}`;
}

async function seedDemoOrders() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) return;

  const products = await prisma.product.findMany({
    where: { slug: { startsWith: DEMO_PRODUCT_PREFIX } },
    take: 4,
  });
  if (products.length === 0) return;

  const addressId = await ensureAdminAddress(admin.id);
  const statuses = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

  for (let i = 0; i < 6; i++) {
    const orderProducts = products.slice(0, (i % 3) + 1);
    const totalAmount = orderProducts.reduce(
      (sum, product) => sum + Number(product.price),
      0,
    );

    await prisma.order.create({
      data: {
        userId: admin.id,
        orderNumber: generateOrderNumber(i),
        status: statuses[i % statuses.length],
        totalAmount,
        shippingCost: 30000,
        discountAmount: 0,
        finalAmount: totalAmount + 30000,
        shippingAddressId: addressId,
        notes: "سفارش دمو",
        items: {
          create: orderProducts.map((product) => ({
            productId: product.id,
            productTitle: product.title,
            productSku: product.sku ?? undefined,
            unitPrice: product.price,
            quantity: 1,
            totalPrice: product.price,
          })),
        },
      },
    });
  }
}

async function seedDemoHomepageSections() {
  for (const section of demoHomepageSections) {
    await prisma.homepageSection.upsert({
      where: { key: section.key },
      update: {
        title: section.title,
        type: section.type,
        config: section.config as never,
        displayOrder: section.displayOrder,
        isActive: section.isActive,
      },
      create: {
        key: section.key,
        title: section.title,
        type: section.type,
        config: section.config as never,
        displayOrder: section.displayOrder,
        isActive: section.isActive,
      },
    });
  }
}

async function seedDemoSettings() {
  for (const setting of demoSettings) {
    await prisma.setting.updateMany({
      where: { key: setting.key },
      data: { value: setting.value },
    });
  }
}

export async function seedDemoData() {
  try {
    await seedDemoCategories();
    await seedDemoProducts();
    await seedDemoOrders();
    await seedDemoHomepageSections();
    await seedDemoSettings();
  } catch (error) {
    console.error("Seed demo data error:", error);
    throw new AppError("خطا در ایجاد داده‌های نمونه", 500, "DEMO_SEED_ERROR");
  }
}

export async function clearDemoData() {
  try {
    const demoCategoryIds = (
      await prisma.category.findMany({
        where: { slug: { startsWith: DEMO_CATEGORY_PREFIX } },
        select: { id: true },
      })
    ).map((c) => c.id);

    const demoProductIds = (
      await prisma.product.findMany({
        where: { slug: { startsWith: DEMO_PRODUCT_PREFIX } },
        select: { id: true },
      })
    ).map((p) => p.id);

    const demoOrderIds = (
      await prisma.order.findMany({
        where: { notes: { contains: "سفارش دمو" } },
        select: { id: true },
      })
    ).map((o) => o.id);

    await prisma.orderItem.deleteMany({
      where: { orderId: { in: demoOrderIds } },
    });

    await prisma.order.deleteMany({
      where: { id: { in: demoOrderIds } },
    });

    await prisma.cartItem.deleteMany({
      where: { productId: { in: demoProductIds } },
    });

    await prisma.productImage.deleteMany({
      where: { productId: { in: demoProductIds } },
    });

    await prisma.product.deleteMany({
      where: { id: { in: demoProductIds } },
    });

    await prisma.category.deleteMany({
      where: { id: { in: demoCategoryIds } },
    });

    await prisma.homepageSection.deleteMany({
      where: { key: { in: demoHomepageSections.map((s) => s.key) } },
    });

    for (const setting of demoSettings) {
      await prisma.setting.updateMany({
        where: { key: setting.key },
        data: { value: "false" },
      });
    }
  } catch (error) {
    console.error("Clear demo data error:", error);
    throw new AppError("خطا در حذف داده‌های نمونه", 500, "DEMO_CLEAR_ERROR");
  }
}
