import { Response } from 'express';

export function ok(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function fail(
  res: Response,
  message: string,
  status = 400,
  errors?: Record<string, string[]>,
  code?: string
) {
  return res.status(status).json({
    success: false,
    message,
    code: code || 'ERROR',
    errors: errors || undefined,
  });
}
