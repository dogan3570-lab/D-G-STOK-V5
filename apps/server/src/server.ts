import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { prisma } from './db/prisma.ts';
import { env } from './env.ts';
import { attachSseEndpoint } from './sse/events.ts';
import { setupWebSocketServer, broadcast, getClientCount, getActiveSubscriptions } from './sse/websocket.ts';
import { attachRoutes } from './routes/index.ts';
import { startWorkers } from './workers/index.ts';
import { ensureDefaultAdminUser } from './bootstrap.ts';
import { ensureDatabaseReady } from './db/ensureDb.ts';
import { startScheduler } from './services/automationScheduler.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildServer() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(',')?.map((s) => s.trim()).filter(Boolean) ?? true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use(morgan('dev'));

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'dg-stok-integrator-server' });
  });

  app.get('/api-status', (_req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
    });
  });

  // Auth routes
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
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  });

  app.get('/auth/me', async (req, res) => {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } });
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & { sub?: string; role?: string };
      if (!decoded?.sub) {
        return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } });
      }

      const user = await prisma.user.findUnique({
        where: { id: String(decoded.sub) },
        select: { id: true, email: true, role: true, name: true },
      });

      if (!user) {
        return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      }

      return res.json(user);
    } catch {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'invalid token' } });
    }
  });

  // Seed admin user (development only) - routes/index.ts'deki ile çakışmaması için burada
  app.post('/debug/seed-admin', async (_req, res) => {
    try {
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
    } catch (error) {
      return res.status(500).json({ ok: false, error: String(error) });
     }
  });

  // WebSocket status endpoint
  app.get('/ws-status', (_req, res) => {
    res.json({
      connectedClients: getClientCount(),
      subscriptions: getActiveSubscriptions(),
    });
  });

  // Attach SSE and all routes
  attachSseEndpoint(app);
  attachRoutes(app);

  // Production: Serve frontend static files
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    // Try multiple possible locations for the built frontend
    const possiblePaths = [
      path.join(__dirname, '../../web/dist'),          // monorepo: apps/server/dist -> apps/web/dist
      path.join(__dirname, '../../../apps/web/dist'),  // fallback
      path.join(process.cwd(), 'apps/web/dist'),       // cwd based
    ];

    let webDistPath = '';
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
          webDistPath = p;
          break;
        }
      } catch { /* ignore */ }
    }

    if (webDistPath) {
      console.log(`[server] Serving frontend from: ${webDistPath}`);
      app.use(express.static(webDistPath));
      
      // SPA fallback: serve index.html for all non-API routes
      app.get('*', (_req, res) => {
        res.sendFile(path.join(webDistPath, 'index.html'));
      });
    } else {
      console.warn('[server] Frontend dist not found, API-only mode');
    }
  }

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT ?? 4000);
  const app = buildServer();
  const server = http.createServer(app);

  // WebSocket sunucusunu başlat
  const wss = setupWebSocketServer(server);

  const workersEnabled = String(process.env.ENABLE_WORKERS ?? 'false').toLowerCase() === 'true';
  if (workersEnabled) {
    startWorkers();
  }

  server.listen(port, async () => {
    console.log(`[server] listening on :${port}`);
    console.log(`[server] WebSocket available at ws://localhost:${port}/ws`);
    
    if (!workersEnabled) {
      console.log('[server] workers disabled (set ENABLE_WORKERS=true to enable BullMQ workers)');
    }

    try {
      await ensureDatabaseReady();
      console.log('[server] database ready');
      await ensureDefaultAdminUser();
      console.log('[server] admin user ready (admin@dgstok.com / admin123)');
      
      const schedulerEnabled = String(process.env.ENABLE_SCHEDULER ?? 'true').toLowerCase() === 'true';
      if (schedulerEnabled) {
        startScheduler(30);
      }
    } catch (error) {
      console.error('[server] database bootstrap failed', error);
    }
  });
}
