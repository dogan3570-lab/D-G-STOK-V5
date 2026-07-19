// ==================== GÜVENLİK KATMANI V1 ====================
// DG STOK V5.0 - Security Middleware
// Zero Trust: Rate limit, CSRF, Input validation
// ============================================================

import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ==================== RATE LIMIT TIERS ====================

// Tier 1: Auth/Security (en sıkı)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMIT', message: 'too_many_attempts' } },
});

// Tier 2: Critical Operations (XML import, bulk operations)
export const criticalOpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMIT', message: 'too_many_requests' } },
});

// Tier 3: AI Operations
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMIT', message: 'too_many_ai_requests' } },
});

// Tier 4: Standard API
export const standardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMIT', message: 'too_many_requests' } },
});

// Tier 5: Dashboard/Read-only (daha rahat)
export const readOnlyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMIT', message: 'too_many_requests' } },
});

// ==================== CSRF KORUMASI ====================
// JWT tabanlı sistemde CSRF riski düşüktür çünkü:
// 1. Token Authorization header'da taşınır (cookie'deki sadece fallback)
// 2. x-auth-token header'ı ile de çalışır
// 3. State-changing işlemler cookie dışı kaynaklardan authenticate olur
//
// Yine de double-submit cookie pattern uygulanır:

const CSRF_COOKIE_NAME = 'x-csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// CSRF token oluştur ve cookie'ye yaz
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  try {
    // Sadece state-changing metodlar için kontrol
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // GET isteklerinde CSRF token'ı set et (eğer yoksa)
      if (!req.cookies?.[CSRF_COOKIE_NAME]) {
        const token = crypto.randomBytes(32).toString('hex');
        res.cookie(CSRF_COOKIE_NAME, token, {
          httpOnly: false,
          sameSite: 'strict',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 24 * 60 * 60 * 1000,
        });
      }
      next();
      return;
    }

    // POST/PUT/DELETE isteklerinde CSRF token doğrulama
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      console.warn(`[CSRF] Token mismatch: method=${req.method} path=${req.path}`);
      res.status(403).json({
        ok: false,
        error: { code: 'CSRF_ERROR', message: 'CSRF token validation failed' },
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

// ==================== INPUT VALIDATION HELPER ====================

import { z } from 'zod';

type ValidationSchemas = {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
};

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as any;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as any;
      }
      next();
    } catch (error: any) {
      const zodError = error instanceof z.ZodError ? error.errors : [{ message: 'Validation failed' }];
      res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details: zodError,
        },
      });
    }
  };
}

// ==================== COMMON VALIDATION SCHEMAS ====================

export const schemas = {
  id: z.string().min(1, 'ID is required'),
  pagination: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  }),
  productIds: z.object({
    productIds: z.array(z.string().min(1)).min(1, 'At least one productId required').max(500, 'Max 500 products'),
  }),
  email: z.string().email('Invalid email').transform(v => v.toLowerCase().trim()),
  password: z.string().min(6, 'Password must be at least 6 characters'),
};
