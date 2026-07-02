import bcrypt from 'bcryptjs';
import { prisma } from './db/prisma.ts';

export async function ensureDefaultAdminUser() {
  const email = 'admin@dgstok.com';
  const password = 'admin123';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const hashed = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: {
      email,
      password: hashed,
      role: 'ADMIN',
    },
  });
}
