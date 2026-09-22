require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

const config = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/digital_heroes',
  jwtSecret: process.env.JWT_SECRET || (isProd ? '' : 'dev-only-insecure-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Comma separated list of allowed browser origins
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  paymentProvider: process.env.PAYMENT_PROVIDER || 'demo',
};

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = config;
