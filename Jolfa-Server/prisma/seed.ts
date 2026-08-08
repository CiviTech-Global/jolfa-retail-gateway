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
