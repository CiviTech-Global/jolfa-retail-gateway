import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "admin123";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { phone: "09120000000" },
    update: {},
    create: {
      email: "admin@jolfa.local",
      phone: "09120000000",
      passwordHash,
      firstName: "مدیر",
      lastName: "سیستم",
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  console.log(`Admin user ensured: ${admin.email} / ${admin.phone}`);

  const categoriesData = [
    { name: "مواد غذایی", slug: "food", description: "محصولات غذایی تازه و باکیفیت" },
    { name: "نوشیدنی‌ها", slug: "beverages", description: "انواع نوشیدنی‌های سرد و گرم" },
    { name: "لوازم خانگی", slug: "home-appliances", description: "لوازم کاربردی منزل" },
    { name: "شیرینی و تنقلات", slug: "sweets-snacks", description: "شیرینی، شکلات و تنقلات" },
  ];

  for (const categoryData of categoriesData) {
    await prisma.category.upsert({
      where: { slug: categoryData.slug },
      update: {},
      create: {
        ...categoryData,
        displayOrder: 0,
        isActive: true,
      },
    });
  }

  console.log(`Seeded ${categoriesData.length} categories`);

  const foodCategory = await prisma.category.findUnique({ where: { slug: "food" } });
  const beveragesCategory = await prisma.category.findUnique({ where: { slug: "beverages" } });

  if (!foodCategory || !beveragesCategory) {
    throw new Error("Expected categories were not found after seeding");
  }

  const productsData = [
    {
      title: "برنج ایرانی طارم",
      slug: "iranian-tarem-rice",
      description: "برنج مرغوب ایرانی طارم، مناسب برای انواع پلو",
      shortDescription: "برنج طارم ۱۰ کیلویی",
      price: 2_500_000,
      stockQuantity: 50,
      weightGrams: 10_000,
      sku: "RICE-TARM-10KG",
      categoryId: foodCategory.id,
      isFeatured: true,
    },
    {
      title: "روغن زیتون فرابکر",
      slug: "extra-virgin-olive-oil",
      description: "روغن زیتون فرابکر با کیفیت بالا",
      shortDescription: "روغن زیتون ۱ لیتری",
      price: 850_000,
      stockQuantity: 40,
      weightGrams: 1_000,
      sku: "OIL-OLIVE-1L",
      categoryId: foodCategory.id,
      isFeatured: false,
    },
    {
      title: "چای سیاه شمال",
      slug: "north-black-tea",
      description: "چای سیاه مرغوب منطقه شمال ایران",
      shortDescription: "چای سیاه ۵۰۰ گرمی",
      price: 420_000,
      stockQuantity: 60,
      weightGrams: 500,
      sku: "TEA-BLK-500G",
      categoryId: beveragesCategory.id,
      isFeatured: true,
    },
    {
      title: "قهوه اسپرسو",
      slug: "espresso-coffee",
      description: "دانه قهوه اسپرسو با رست تیره",
      shortDescription: "قهوه اسپرسو ۲۵۰ گرمی",
      price: 680_000,
      stockQuantity: 30,
      weightGrams: 250,
      sku: "COF-ESP-250G",
      categoryId: beveragesCategory.id,
      isFeatured: false,
    },
  ];

  for (const productData of productsData) {
    await prisma.product.upsert({
      where: { slug: productData.slug },
      update: {},
      create: {
        ...productData,
        isActive: true,
        images: {
          create: [
            {
              url: `/uploads/products/${productData.slug}.jpg`,
              altText: productData.title,
              isPrimary: true,
              sortOrder: 0,
            },
          ],
        },
      },
    });
  }

  console.log(`Seeded ${productsData.length} products`);

  // Default settings
  const defaultSettings = [
    { key: "site_name", value: "بازارچه جلفا", group: "general", isPublic: true, description: "Site name shown in header and footer" },
    { key: "site_description", value: "فروشگاه محصولات محلی و سنتی بازارچه جلفا", group: "general", isPublic: true, description: "Meta description and hero subtitle" },
    { key: "currency", value: "تومان", group: "general", isPublic: true, description: "Currency label" },
    { key: "show_search", value: "true", group: "header", isPublic: true, description: "Show search input in header" },
    { key: "show_cart", value: "true", group: "header", isPublic: true, description: "Show cart icon in header" },
    { key: "show_user_menu", value: "true", group: "header", isPublic: true, description: "Show user account menu in header" },
    { key: "show_footer_links", value: "true", group: "footer", isPublic: true, description: "Show footer quick links" },
    { key: "show_hero", value: "true", group: "home_features", isPublic: true, description: "Show hero banner section" },
    { key: "show_categories", value: "true", group: "home_features", isPublic: true, description: "Show categories grid section" },
    { key: "show_featured_products", value: "true", group: "home_features", isPublic: true, description: "Show featured products section" },
    { key: "show_new_products", value: "true", group: "home_features", isPublic: true, description: "Show new products section" },
    { key: "show_discounted_products", value: "true", group: "home_features", isPublic: true, description: "Show discounted products section" },
    { key: "show_trust_badges", value: "true", group: "home_features", isPublic: true, description: "Show trust badges section" },
    { key: "show_newsletter", value: "true", group: "home_features", isPublic: true, description: "Show newsletter section" },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log(`Seeded ${defaultSettings.length} settings`);

  // Default homepage sections
  const defaultSections = [
    { key: "hero", title: "اسلایدر اصلی", type: "hero", config: { limit: 3 }, displayOrder: 1, isActive: true },
    { key: "categories", title: "دسته‌بندی‌ها", type: "categories", config: { limit: 8 }, displayOrder: 2, isActive: true },
    { key: "featured_products", title: "محصولات ویژه", type: "featured_products", config: { limit: 8 }, displayOrder: 3, isActive: true },
    { key: "promo_banner", title: "بنر تبلیغاتی", type: "promo_banner", config: {}, displayOrder: 4, isActive: true },
    { key: "new_products", title: "جدیدترین محصولات", type: "new_products", config: { limit: 8 }, displayOrder: 5, isActive: true },
    { key: "trust_badges", title: "-badgeهای اعتماد", type: "trust_badges", config: {}, displayOrder: 6, isActive: true },
    { key: "newsletter", title: "خبرنامه", type: "newsletter", config: {}, displayOrder: 7, isActive: false },
  ];

  for (const section of defaultSections) {
    await prisma.homepageSection.upsert({
      where: { key: section.key },
      update: {},
      create: section,
    });
  }

  console.log(`Seeded ${defaultSections.length} homepage sections`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
