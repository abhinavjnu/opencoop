import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pino from 'pino';
import { config } from './config/index.js';
import { authRoutes } from './modules/customer/auth.routes.js';
import { orderRoutes } from './modules/order/order.routes.js';
import { workerRoutes } from './modules/worker/worker.routes.js';
import { restaurantRoutes } from './modules/restaurant/restaurant.routes.js';
import { governanceRoutes } from './modules/governance/governance.routes.js';
import { escrowRoutes } from './modules/escrow/escrow.routes.js';
import { eventRoutes } from './modules/events/event.routes.js';
import { reputationRoutes } from './modules/reputation/reputation.routes.js';
import { disputeRoutes } from './modules/reputation/dispute.routes.js';
import { initializeWebSocket } from './modules/realtime/socket.js';
import { authLimiter, writeLimiter, readLimiter } from './middleware/rate-limit.js';
import { requestContext } from './middleware/request-context.js';
import { idempotency } from './middleware/idempotency.js';

const logger = pino({ name: 'server' });
const app = express();
const httpServer = createServer(app);

app.use(helmet());
app.use(cors({
  origin: config.nodeEnv === 'production' ? config.corsOrigin : true,
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(requestContext(logger));

// Trust proxy for correct IP extraction behind reverse proxy
app.set('trust proxy', 1);

// Global read rate limiter — 200 req/min per IP
app.use(readLimiter);
app.use(idempotency);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    name: 'OpenFood',
    philosophy: 'No extraction. No coercion. No opacity.',
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/orders', writeLimiter, orderRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/governance', writeLimiter, governanceRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/reputation', writeLimiter, reputationRoutes);
app.use('/api/disputes', writeLimiter, disputeRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

const io = initializeWebSocket(httpServer);

httpServer.listen(config.port, () => {
  logger.info(`OpenFood server running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info('WebSocket: enabled');
  logger.info('API endpoints:');
  logger.info('  POST /api/auth/register    - Register user');
  logger.info('  POST /api/auth/login       - Login');
  logger.info('  POST /api/orders           - Create order (customer)');
  logger.info('  POST /api/orders/:id/accept - Accept order (restaurant)');
  logger.info('  POST /api/orders/:id/claim  - Claim delivery (worker)');
  logger.info('  POST /api/orders/:id/pickup - Mark pickup (worker)');
  logger.info('  POST /api/orders/:id/deliver - Confirm delivery (worker)');
  logger.info('  GET  /api/workers/jobs      - View job board (worker)');
  logger.info('  GET  /api/workers/earnings  - View earnings (worker)');
  logger.info('  GET  /api/restaurants       - Browse restaurants');
  logger.info('  GET  /api/escrow/pool       - View pool state');
  logger.info('  POST /api/governance/proposals - Create proposal');
  logger.info('  GET  /api/events/recent     - View audit log');
  logger.info('  POST /api/reputation/ratings - Submit rating');
  logger.info('  GET  /api/reputation/ratings/:targetRole/:targetId - View ratings');
  logger.info('  POST /api/disputes           - Raise dispute');
  logger.info('  POST /api/disputes/:id/resolve - Resolve dispute');
  logger.info('  WS   /socket.io             - Real-time events');
});

export { io };
export default app;
