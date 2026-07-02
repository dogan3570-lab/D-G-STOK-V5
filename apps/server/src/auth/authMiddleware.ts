import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.ts';

export type AuthedRequest = Request & {
  actor?: {
    userId: string;
    role: string;
  };
};

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'unauthorized' },
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & { sub?: string; role?: string };
    if (!decoded?.sub) {
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'unauthorized' },
      });
    }

    req.actor = {
      userId: String(decoded.sub),
      role: String(decoded.role ?? 'OPERATOR'),
    };

    next();
  } catch {
    return res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'unauthorized' },
    });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const role = req.actor?.role;
    if (!role) {
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'unauthorized' },
      });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'forbidden' },
      });
    }
    next();
  };
}
