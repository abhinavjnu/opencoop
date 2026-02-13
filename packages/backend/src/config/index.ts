import 'dotenv/config';

export const config = {
  port: parseInt(process.env['PORT'] ?? '4000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',

  database: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://openfood:openfood@localhost:5432/openfood',
  },

  redis: {
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production',
    expiresIn: '24h',
  },

  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',

  stripe: {
    secretKey: process.env['STRIPE_SECRET_KEY'] ?? 'sk_test_placeholder',
    webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'] ?? 'whsec_placeholder',
  },
} as const;

if (config.nodeEnv === 'production') {
  if (config.jwt.secret === 'dev-secret-change-in-production') {
    throw new Error('JWT_SECRET must be set in production');
  }

  if (config.stripe.secretKey === 'sk_test_placeholder') {
    throw new Error('STRIPE_SECRET_KEY must be set in production');
  }

  if (config.stripe.webhookSecret === 'whsec_placeholder') {
    throw new Error('STRIPE_WEBHOOK_SECRET must be set in production');
  }
}
