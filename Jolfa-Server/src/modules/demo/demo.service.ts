import { prisma } from "../../shared/prisma.js";
import { AppError } from "../../shared/app-error.js";
import { env } from "../../config/env.js";
import { ensureDefaultSettings } from "../settings/settings.service.js";

const DEMO_CATEGORY_PREFIX = "demo-";
const DEMO_PRODUCT_PREFIX = "demo-";

/** Locally-served demo asset (checked into assets/demo-images, no external network needed). */
function demoAsset(filename: string): string {
  return `${env.APP_URL}/demo-assets/${filename}`;
}

const demoCategories = [
  { name: "چای و دمنوش", slug: "demo-chai", imageUrl: demoAsset("category-01.jpg") },
  { name: "عسل و مربا", slug: "demo-asal", imageUrl: demoAsset("category-02.webp") },
  { name: "ادویه و چاشنی", slug: "demo-adviye", imageUrl: demoAsset("category-03.webp") },
  { name: "خشکبار و آجیل", slug: "demo-khoshkbar", imageUrl: demoAsset("category-04.webp") },
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
    images: [
      { url: demoAsset("product-01.jpg"), altText: "فنجان چای سیاه ارگانیک تازه دم شده" },
      { url: demoAsset("product-02.jpg"), altText: "برگ‌های خشک چای سیاه ارگانیک درجه یک" },
      { url: demoAsset("product-03.webp"), altText: "بسته‌بندی چای سیاه ارگانیک بازارچه جلفا" },
    ],
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
    images: [
      { url: demoAsset("product-04.webp"), altText: "ظرف عسل طبیعی کوهستان" },
      { url: demoAsset("product-05.webp"), altText: "قاشق عسل طبیعی خام در حال برداشت" },
      { url: demoAsset("product-06.jpg"), altText: "برچسب و بسته‌بندی عسل طبیعی کوهستان" },
    ],
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
    images: [
      { url: demoAsset("product-07.jpg"), altText: "رشته‌های زعفران سرگل درجه یک" },
      { url: demoAsset("product-08.webp"), altText: "زعفران سرگل در ظرف بلوری" },
      { url: demoAsset("product-09.jpg"), altText: "بسته‌بندی زعفران سرگل بازارچه جلفا" },
    ],
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
    images: [
      { url: demoAsset("product-10.jpg"), altText: "مغز گردوی خام و تازه" },
      { url: demoAsset("product-11.jpg"), altText: "گردو و آجیل خشکبار مخلوط" },
      { url: demoAsset("product-12.jpg"), altText: "بسته‌بندی مغز گردوی خام بازارچه جلفا" },
    ],
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
    images: [
      { url: demoAsset("product-13.jpg"), altText: "فنجان چای سبز تازه دم" },
      { url: demoAsset("product-14.jpg"), altText: "برگ‌های خشک چای سبز" },
      { url: demoAsset("product-15.webp"), altText: "بسته‌بندی چای سبز لاغری بازارچه جلفا" },
    ],
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
    images: [
      { url: demoAsset("product-16.webp"), altText: "مربای گل محمدی در ظرف شیشه‌ای" },
      { url: demoAsset("product-17.png"), altText: "شهد طبیعی مربای گل محمدی" },
      { url: demoAsset("product-18.jpg"), altText: "بسته‌بندی مربای سنتی گل محمدی" },
    ],
  },
];

const demoBanners = [
  {
    title: "تازگی محصولات محلی",
    subtitle: "از کوهستان تا سبد خرید شما",
    imageUrl: demoAsset("banner-01.jpg"),
    link: "/products",
    position: "hero",
    displayOrder: 0,
    isActive: true,
  },
  {
    title: "زعفران و ادویه‌جات اصیل",
    subtitle: "مستقیم از مزارع جلفا",
    imageUrl: demoAsset("banner-02.jpg"),
    link: "/categories/demo-adviye",
    position: "sidebar",
    displayOrder: 1,
    isActive: true,
  },
  {
    title: "خشکبار تازه، ارسال سریع",
    subtitle: "بدون واسطه از تولیدکننده",
    imageUrl: demoAsset("banner-03.jpg"),
    link: "/categories/demo-khoshkbar",
    position: "footer",
    displayOrder: 2,
    isActive: true,
  },
];

const demoHomepageSections = [
  {
    key: "hero",
    title: "اسلایدر بنر",
    type: "hero_carousel",
    config: {
      autoplayMs: 5000,
      banners: [
        {
          title: "بازارچه جلفا",
          subtitle: "محصولات محلی، سنتی و باکیفیت مستقیماً از تولیدکننده به دست شما",
          image: demoAsset("hero-01.jpg"),
          link: "/products",
          buttonText: "مشاهده محصولات",
        },
        {
          title: "زعفران سرگل درجه یک",
          subtitle: "خالص‌ترین زعفران ایران، برداشت تازه امسال",
          image: demoAsset("hero-02.jpg"),
          link: "/products/demo-saffron",
          buttonText: "خرید زعفران",
        },
        {
          title: "عسل طبیعی کوهستان",
          subtitle: "بدون افزودنی، مستقیم از کندوهای کوهستان",
          image: demoAsset("hero-03.jpg"),
          link: "/products/demo-mountain-honey",
          buttonText: "خرید عسل",
        },
      ],
    },
    displayOrder: 0,
    isActive: true,
  },
  {
    key: "flash_deals",
    title: "پیشنهادهای لحظه‌ای",
    type: "flash_deals",
    config: { filter: "discounted", limit: 8, endsAt: null },
    displayOrder: 1,
    isActive: true,
  },
  {
    key: "categories",
    title: "دسته‌بندی‌ها",
    type: "category_grid",
    config: { limit: 8 },
    displayOrder: 2,
    isActive: true,
  },
  {
    key: "featured_products",
    title: "محصولات ویژه",
    type: "product_carousel",
    config: { filter: "featured", limit: 8, layout: "carousel" },
    displayOrder: 3,
    isActive: true,
  },
  {
    key: "banner_grid",
    title: "بنرهای تبلیغاتی",
    type: "banner_grid",
    config: {
      banners: [
        {
          title: "چای و دمنوش",
          subtitle: "طعم‌های اصیل ایرانی",
          image: demoAsset("banner-01.jpg"),
          link: "/categories/demo-chai",
        },
        {
          title: "عسل و مربا",
          subtitle: "شیرینی طبیعت",
          image: demoAsset("banner-02.jpg"),
          link: "/categories/demo-asal",
        },
        {
          title: "ادویه و چاشنی",
          subtitle: "عطر و رنگ اصیل",
          image: demoAsset("banner-03.jpg"),
          link: "/categories/demo-adviye",
        },
        {
          title: "خشکبار و آجیل",
          subtitle: "تازه و مرغوب",
          image: demoAsset("hero-01.jpg"),
          link: "/categories/demo-khoshkbar",
        },
      ],
    },
    displayOrder: 4,
    isActive: true,
  },
  {
    key: "new_products",
    title: "جدیدترین محصولات",
    type: "product_carousel",
    config: { filter: "new", limit: 8, layout: "carousel" },
    displayOrder: 5,
    isActive: true,
  },
  {
    key: "brand_strip",
    title: "برندهای منتخب",
    type: "brand_strip",
    config: {
      brands: [
        { name: "بازارچه جلفا", logo: demoAsset("brand-01.png") },
        { name: "طبیعت آذربایجان", logo: demoAsset("brand-02.png") },
        { name: "کوهستان طلایی", logo: demoAsset("brand-03.png") },
        { name: "دهکده ارگانیک", logo: demoAsset("brand-04.png") },
        { name: "سرزمین زعفران", logo: demoAsset("brand-05.png") },
      ],
    },
    displayOrder: 6,
    isActive: true,
  },
  {
    key: "promo_banner",
    title: "تخفیف‌دارها",
    type: "product_carousel",
    config: { filter: "discounted", limit: 8, layout: "grid" },
    displayOrder: 7,
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
    displayOrder: 8,
    isActive: true,
  },
  {
    key: "blog_teaser",
    title: "مجله جولفا",
    type: "blog_teaser",
    config: {
      posts: [
        {
          title: "چگونه زعفران اصل را تشخیص دهیم؟",
          excerpt: "چند نکته ساده برای شناخت زعفران سرگل خالص از تقلبی.",
          image: demoAsset("blog-01.jpg"),
          link: "/products",
        },
        {
          title: "خواص شگفت‌انگیز عسل طبیعی",
          excerpt: "عسل طبیعی چه فوایدی برای سلامتی روزانه شما دارد؟",
          image: demoAsset("blog-02.jpg"),
          link: "/products",
        },
        {
          title: "راهنمای نگهداری چای و دمنوش",
          excerpt: "برای حفظ عطر و طعم چای، این نکات را رعایت کنید.",
          image: demoAsset("blog-03.jpg"),
          link: "/products",
        },
      ],
    },
    displayOrder: 9,
    isActive: true,
  },
  {
    key: "app_download",
    title: "دانلود اپلیکیشن",
    type: "app_download",
    config: {
      title: "اپلیکیشن بازارچه جلفا را نصب کنید",
      description: "خرید سریع‌تر، پیشنهادهای اختصاصی و پیگیری آسان سفارش‌ها؛ همه در یک اپلیکیشن.",
      androidLink: "#",
      iosLink: "#",
    },
    displayOrder: 10,
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
    displayOrder: 11,
    isActive: true,
  },
];


async function snapshotEntity(entityType: string, entityId: string) {
  await prisma.demoSnapshot.create({
    data: { entityType, entityId },
  });
}

async function seedDemoCategories() {
  for (const cat of demoCategories) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    await snapshotEntity("CATEGORY", created.id);
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

    const { categorySlug: _categorySlug, images, ...productData } = product;
    const upserted = await prisma.product.upsert({
      where: { slug: product.slug },
      update: { ...productData, categoryId },
      create: { ...productData, categoryId },
    });

    await snapshotEntity("PRODUCT", upserted.id);

    await prisma.productImage.deleteMany({ where: { productId: upserted.id } });
    await prisma.productImage.createMany({
      data: images.map((image, index) => ({
        productId: upserted.id,
        url: image.url,
        altText: image.altText,
        isPrimary: index === 0,
        sortOrder: index,
      })),
    });
  }
}

async function seedDemoBanners() {
  for (const banner of demoBanners) {
    const created = await prisma.banner.create({ data: banner });
    await snapshotEntity("BANNER", created.id);
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

    const status = statuses[i % statuses.length];
    const isPaid = i % 2 === 0;

    const order = await prisma.order.create({
      data: {
        userId: admin.id,
        orderNumber: generateOrderNumber(i),
        status,
        paymentStatus: isPaid ? "COMPLETED" : "PENDING",
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

    await snapshotEntity("ORDER", order.id);

    if (isPaid) {
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          gateway: "ZARINPAL",
          amount: order.finalAmount,
          status: "COMPLETED",
          authority: `demo-auth-${i}`,
          refId: `demo-ref-${i}`,
          paidAt: new Date(),
        },
      });
      await snapshotEntity("PAYMENT", payment.id);

      const transaction = await prisma.transaction.create({
        data: {
          orderId: order.id,
          paymentId: payment.id,
          type: "PAYMENT",
          amount: order.finalAmount,
          status: "COMPLETED",
          gateway: "ZARINPAL",
          authority: payment.authority,
          refId: payment.refId,
        },
      });
      await snapshotEntity("TRANSACTION", transaction.id);
    }
  }
}

async function seedDemoHomepageSections() {
  for (const section of demoHomepageSections) {
    const upserted = await prisma.homepageSection.upsert({
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
    await snapshotEntity("HOMEPAGE_SECTION", upserted.id);
  }
}

/**
 * Settings are core configuration, not demo content: they now hold the site
 * name, title and logo. So demo seeding only fills in keys that are missing
 * and never snapshots them — clearing demo data must not wipe an admin's
 * branding along with the sample products.
 */
async function seedDemoSettings() {
  await ensureDefaultSettings();
}

export async function seedDemoData() {
  try {
    await seedDemoCategories();
    await seedDemoProducts();
    await seedDemoBanners();
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
    const snapshots = await prisma.demoSnapshot.findMany();

    const orderIds = snapshots.filter((s) => s.entityType === "ORDER").map((s) => s.entityId);
    const categoryIds = snapshots.filter((s) => s.entityType === "CATEGORY").map((s) => s.entityId);
    const bannerIds = snapshots.filter((s) => s.entityType === "BANNER").map((s) => s.entityId);
    const homepageSectionIds = snapshots
      .filter((s) => s.entityType === "HOMEPAGE_SECTION")
      .map((s) => s.entityId);
    const transactionIds = snapshots
      .filter((s) => s.entityType === "TRANSACTION")
      .map((s) => s.entityId);

    await prisma.$transaction(async (tx) => {
      // Remove demo financial records first.
      await tx.transaction.deleteMany({
        where: { id: { in: transactionIds } },
      });

      // Remove demo orders and their items (payments cascade with orders).
      await tx.orderItem.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await tx.order.deleteMany({
        where: { id: { in: orderIds } },
      });

      // Remove any products that belong to demo categories, plus their related rows.
      // This also cleans up user-created products that were placed under demo categories.
      await tx.cartItem.deleteMany({
        where: { product: { categoryId: { in: categoryIds } } },
      });
      await tx.productImage.deleteMany({
        where: { product: { categoryId: { in: categoryIds } } },
      });
      await tx.orderItem.deleteMany({
        where: { product: { categoryId: { in: categoryIds } } },
      });
      await tx.product.deleteMany({
        where: { categoryId: { in: categoryIds } },
      });

      // Delete child demo categories before parent ones (if any).
      await tx.category.deleteMany({
        where: { id: { in: categoryIds }, parentId: { in: categoryIds } },
      });
      await tx.category.deleteMany({
        where: { id: { in: categoryIds } },
      });

      await tx.banner.deleteMany({
        where: { id: { in: bannerIds } },
      });

      await tx.homepageSection.deleteMany({
        where: { id: { in: homepageSectionIds } },
      });

      // Settings are intentionally left alone: they carry the site name, title
      // and logo, which are not demo content.

      await tx.demoSnapshot.deleteMany();
    });
  } catch (error) {
    console.error("Clear demo data error:", error);
    throw new AppError("خطا در حذف داده‌های نمونه", 500, "DEMO_CLEAR_ERROR");
  }
}
