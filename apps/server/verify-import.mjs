import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const found = await prisma.product.findUnique({ where: { xmlKey: 'TEST-001' } });
console.log(JSON.stringify(found));
await prisma.$disconnect();
