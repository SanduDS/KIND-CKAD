import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple .env locations
const envPaths = [
  join(__dirname, '../../.env'),
  join(process.cwd(), '.env'),
  '/opt/ckad-platform/.env',
];

for (const envPath of envPaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`Loaded .env from: ${envPath}`);
      break;
    }
  } catch (err) {
    // Continue to next path
  }
}

const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  domain: process.env.DOMAIN || 'localhost',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
  },

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
  },

  // Email
  email: {
    provider: process.env.EMAIL_PROVIDER || 'resend',
    resendApiKey: process.env.RESEND_API_KEY,
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    from: process.env.EMAIL_FROM || 'noreply@example.com',
  },

  // Session
  session: {
    ttlMinutes: parseInt(process.env.SESSION_TTL_MINUTES, 10) || 60,
    extensionMinutes: parseInt(process.env.SESSION_EXTENSION_MINUTES, 10) || 30,
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SESSIONS, 10) || 8,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 10,
    sessionStartMax: parseInt(process.env.SESSION_START_RATE_LIMIT_MAX, 10) || 1000, // test
  },

  // Database
  database: {
    path: process.env.DATABASE_PATH || './data/ckad.db',
  },

  // KIND Configuration
  kind: {
    portRange: {
      apiStart: parseInt(process.env.KIND_PORT_RANGE_API_START, 10) || 30000,
      apiEnd: parseInt(process.env.KIND_PORT_RANGE_API_END, 10) || 39999,
      ingressStart: parseInt(process.env.KIND_PORT_RANGE_INGRESS_START, 10) || 40000,
      ingressEnd: parseInt(process.env.KIND_PORT_RANGE_INGRESS_END, 10) || 44999,
      ingressHttpsStart: parseInt(process.env.KIND_PORT_RANGE_INGRESS_HTTPS_START, 10) || 45000,
      ingressHttpsEnd: parseInt(process.env.KIND_PORT_RANGE_INGRESS_HTTPS_END, 10) || 49999,
    },
  },

  // Terminal Container
  terminal: {
    image: process.env.TERMINAL_IMAGE || 'ckad-terminal:latest',
    memoryLimit: process.env.TERMINAL_MEMORY_LIMIT || '512m',
    cpuLimit: process.env.TERMINAL_CPU_LIMIT || '0.5',
  },
};

export default config;



