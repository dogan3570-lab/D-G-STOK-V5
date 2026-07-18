// ==================== MERKEZİ HATA YÖNETİMİ V5.0 ====================
// DG STOK V5.0 - Global Error Handler
// Tüm hatalar tek merkezden yönetilir
// ================================================================

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.ts';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Bilinmeyen hata';

  // Audit log (500 hataları için)
  if (statusCode >= 500) {
    prisma.auditLog.create({
      data: {
        action: 'system.error',
        entity: 'api',
        details: JSON.stringify({
          url: req.originalUrl,
          method: req.method,
          statusCode,
          message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        }),
      },
    }).catch(() => {});
  }

  res.status(statusCode).json({
    ok: false,
    error: { code, message },
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    ok: false,
    error: { code: 'NOT_FOUND', message: `${req.method} ${req.originalUrl} bulunamadı` },
  });
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
