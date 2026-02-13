import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import type { Logger } from 'pino';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestContext(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id']?.toString() ?? randomUUID();
    const start = Date.now();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      logger.info(
        {
          requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs,
          userId: req.user?.userId,
          role: req.user?.role,
        },
        'HTTP request completed',
      );
    });

    next();
  };
}
