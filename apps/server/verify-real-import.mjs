import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const rows = await prisma.product.findMany({
    where: { xmlKey: { in: ['REAL-001', 'REAL-002'] } },
    select: { xmlKey: true, title: true, sku: true, stock: true, minStock: true, status: true },
  });

  console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
} finally {
  await prisma.$disconnect();
}
