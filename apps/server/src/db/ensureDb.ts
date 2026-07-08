import { prisma } from './prisma.ts';

export async function ensureDatabaseReady() {
  await prisma.$connect();
  // SQLite için uygun bir test sorgusu
  await prisma.$queryRaw`SELECT 1 as ok`;
}
