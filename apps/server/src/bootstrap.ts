import bcrypt from 'bcryptjs';
import { prisma } from './db/prisma.ts';
import { registerWorkflowEventListeners } from './services/workflow/EventListeners.ts';

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

/**
 * Uygulama başlangıcında tüm event listener'ları kaydeder.
 * Bu sayede her route isteğinde EventBus hazır olur.
 */
export function initializeEventSystem(): void {
  console.log('[Bootstrap] Event sistemi başlatılıyor...');
  registerWorkflowEventListeners();
  console.log('[Bootstrap] Event sistemi hazır.');
}
