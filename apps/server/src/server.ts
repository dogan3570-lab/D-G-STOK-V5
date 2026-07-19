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
import { ensureDefaultAdminUser, initializeEventSystem } from './bootstrap.ts';
import { ensureDatabaseReady } from './db/ensureDb.ts';
import { startScheduler } from './services/automationScheduler.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildServer() {
  const app = express();

  // ==================== GÜVENLİK KATMANI V1 ====================
  // Zero Trust Security Hardening
  // =============================================================

  // 1. HELMET - Güvenlik header'ları
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // React dev server için unsafe-inline gerekli
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    })
  );

  app.use(compression());

  // 2. CORS - Development'ta geniş, Production'da whitelist
  const corsWhitelist = process.env.CORS_ORIGIN
    ?.split(',')
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [];

  app.use(
    cors({
      origin: (origin, callback) => {
        // originsiz isteklere izin ver (sunucu->sunucu, mobile, aynı-origin)
        if (!origin) return callback(null, true);
        // Development'ta tüm localhost'lara izin ver
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return callback(null, true);
        // Production whitelist
        if (corsWhitelist.includes(origin)) return callback(null, true);
        console.warn(`[CORS] Blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'x-token', 'x-csrf-token'],
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // 3. MORGAN - Production'da detayli log kapali
  if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined', {
      skip: (req) => req.url === '/health' || req.url === '/api-status',
    }));
  } else {
    app.use(morgan('dev', {
      skip: (req) => req.url === '/health' || req.url === '/api-status',
    }));
  }

  // 4. RATE LIMIT - Çok katmanlı
  // Genel API rate limit (15 dk / 1000 istek)
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      standardHeaders: true,
      legacyHeaders: false,
      message: { ok: false, error: { code: 'RATE_LIMIT', message: 'too_many_requests' } },
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

  // Auth routes (sıkı rate limit ile - 15 dk / 20 deneme)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: { code: 'RATE_LIMIT', message: 'too_many_attempts' } },
  });

  app.post('/auth/login', authLimiter, async (req, res) => {
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

  // Serve frontend static files (both dev and production)
  const possiblePaths = [
    path.join(__dirname, '../../web/dist'),          // monorepo: compiled: apps/server/dist -> apps/web/dist
    path.join(__dirname, '../../../apps/web/dist'),  // fallback from compiled
    path.join(process.cwd(), 'apps/web/dist'),       // cwd based
    path.join(__dirname, '../../apps/web/dist'),     // tsx runtime: apps/server/src -> apps/web/dist
    path.join(__dirname, '../web/dist'),             // tsx runtime: apps/server/src -> apps/server/../web/dist
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
    console.warn('[server] Run: cd apps/web && npx vite build');
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
      // Event sistemini başlat (önce)
      initializeEventSystem();

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
