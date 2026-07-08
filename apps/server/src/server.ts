import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './db/prisma.ts';
import { env } from './env.ts';
import { attachSseEndpoint } from './sse/events.ts';
import { attachRoutes } from './routes/index.ts';
import { startWorkers } from './workers/index.ts';
import { ensureDefaultAdminUser } from './bootstrap.ts';
import { ensureDatabaseReady } from './db/ensureDb.ts';
import { startScheduler } from './services/automationScheduler.ts';

export function buildServer() {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(',')?.map((s) => s.trim()).filter(Boolean) ?? true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(morgan('dev'));

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'dg-stok-integrator-server' });
  });

  app.get('/api-status', (_req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
    });
  });

  app.post('/auth/login', async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'email_password_required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ ok: false, error: 'invalid_credentials' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ ok: false, error: 'invalid_credentials' });

    const token = jwt.sign(
      { role: user.role, sub: user.id },
      env.JWT_SECRET,
      env.JWT_EXPIRES_IN ? ({ expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions) : undefined
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });

    return res.json({
      ok: true,
      user: { id: user.id, email: user.email, role: user.role },
    });
  });

  // Seed admin user (development only)
  app.post('/debug/seed-admin', async (req, res) => {
    const existing = await prisma.user.count({ where: { email: 'admin@dgstok.com' } });
    if (existing > 0) {
      return res.json({ ok: true, skipped: true, message: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@dgstok.com',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });

    return res.json({ ok: true, created: admin });
  });

  attachSseEndpoint(app);
  attachRoutes(app);

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT ?? 4000);
  const app = buildServer();

  const workersEnabled = String(process.env.ENABLE_WORKERS ?? 'false').toLowerCase() === 'true';
  if (workersEnabled) {
    startWorkers();
  }

  app.listen(port, async () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on :${port}`);
    if (!workersEnabled) {
      // eslint-disable-next-line no-console
      console.log('[server] workers disabled (set ENABLE_WORKERS=true to enable BullMQ workers)');
    }

    try {
      await ensureDatabaseReady();
      // eslint-disable-next-line no-console
      console.log('[server] database ready');
      await ensureDefaultAdminUser();
      
      // Otomasyon scheduler'ını başlat (her 30 saniyede bir kontrol)
      const schedulerEnabled = String(process.env.ENABLE_SCHEDULER ?? 'true').toLowerCase() === 'true';
      if (schedulerEnabled) {
        startScheduler(30);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[server] database bootstrap failed', error);
    }
  });
}
