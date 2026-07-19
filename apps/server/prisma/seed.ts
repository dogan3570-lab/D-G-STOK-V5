import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Admin kullanıcı ekle
  await prisma.user.upsert({
    where: { email: "admin@dgstok.com" },
    update: {},
    create: {
      email: "admin@dgstok.com",
      password: await bcrypt.hash("admin123", 10),
      role: "admin"
    }
  });

  console.log("✅ Admin user seeded: admin@dgstok.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
