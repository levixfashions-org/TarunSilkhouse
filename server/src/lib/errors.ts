import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { isProd } from '../env.ts';
import { log } from './log.ts';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'error',
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code = 'bad_request', details?: unknown) => new HttpError(400, msg, code, details);
export const notFound = (msg = 'Not found') => new HttpError(404, msg, 'not_found');
export const unauthorized = (msg = 'Please sign in') => new HttpError(401, msg, 'unauthorized');
export const forbidden = (msg = 'Not allowed') => new HttpError(403, msg, 'forbidden');
export const conflict = (msg: string, code = 'conflict', details?: unknown) => new HttpError(409, msg, code, details);

/** Wrap an async handler so rejected promises reach the error middleware. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw badRequest('Please check the highlighted fields', 'validation', r.error.flatten());
  return r.data;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { message: 'Invalid input', code: 'validation', details: err.flatten() } });
    return;
  }
  if (err && typeof err === 'object' && 'type' in err && (err as { type: string }).type === 'entity.too.large') {
    res.status(413).json({ error: { message: 'Request too large', code: 'too_large' } });
    return;
  }
  log.error('unhandled_error', { path: req.path, method: req.method, err: String(err?.stack || err) });
  res.status(500).json({
    error: { message: 'Something went wrong on our side. Please try again.', code: 'server_error', ...(isProd ? {} : { debug: String(err) }) },
  });
};
