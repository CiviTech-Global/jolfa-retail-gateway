import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "admin123";
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { phone: "09120000000" },
    update: {},
    create: {
      phone: "09120000000",
      passwordHash: hashedPassword,
      role: UserRole.ADMIN,
      firstName: "مدیر",
      lastName: "سیستم",
      email: "admin@jolfa.local",
      isActive: true,
    },
  });

  console.log("✅ Admin user seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
