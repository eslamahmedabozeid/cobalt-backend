import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { fail } from '../utils/response';

export interface AuthRequest extends Request {
  admin?: { id: string; email: string };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return fail(res, 'Unauthorized', 401, undefined, 'UNAUTHORIZED');
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      id: string;
      email: string;
    };
    req.admin = payload;
    next();
  } catch {
    return fail(res, 'Invalid or expired token', 401, undefined, 'UNAUTHORIZED');
  }
}
