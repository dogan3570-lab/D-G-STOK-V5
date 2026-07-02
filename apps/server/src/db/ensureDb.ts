import { prisma } from './prisma.ts';

export async function ensureDatabaseReady() {
  await prisma.$connect();
  await prisma.$executeRaw`SELECT 1`;
}
