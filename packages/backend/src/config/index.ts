import 'dotenv/config';

export const config = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',

  database: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://opencoop:opencoop@localhost:5432/opencoop',
  },

  redis: {
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production',
    expiresIn: '24h',
  },

  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3001',

  stripe: {
    secretKey: process.env['STRIPE_SECRET_KEY'] ?? 'sk_test_placeholder',
    webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'] ?? 'whsec_placeholder',
  },
} as const;
