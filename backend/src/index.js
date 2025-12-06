import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';

import config from './config/index.js';
import logger from './utils/logger.js';

// Import routes
import authRoutes from './api/routes/auth.js';
import sessionRoutes from './api/routes/session.js';
import taskRoutes from './api/routes/tasks.js';
import healthRoutes from './api/routes/health.js';

// Import middleware
import { generalLimiter } from './api/middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './api/middleware/errorHandler.js';

// Import WebSocket and cleanup
import { initializeWebSocket } from './websocket/terminal.js';
import { startCleanupScheduler, stopCleanupScheduler } from './services/cleanup.js';

// Initialize Express app
const app = express();

// Create HTTP server
const server = createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// CORS configuration
// Allow requests from frontend URL or same origin
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin)
    if (!origin) {
      return callback(null, true);
    }
    
    // Allow same-origin requests
    if (origin === config.frontendUrl || origin.startsWith(config.frontendUrl)) {
      return callback(null, true);
    }
    
    // Allow requests from configured frontend URL
    const allowedOrigins = [
      config.frontendUrl,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://kind-k8s.duckdns.org',
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Ensure all responses are JSON (unless explicitly set)
app.use((req, res, next) => {
  // Only set JSON header if not already set
  if (!res.getHeader('Content-Type')) {
    res.setHeader('Content-Type', 'application/json');
  }
  next();
});

// Rate limiting
app.use(generalLimiter);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug('Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// Health check routes (no auth required)
app.use('/', healthRoutes);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/tasks', taskRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize WebSocket server
const wss = initializeWebSocket(server);

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Stop cleanup scheduler
  stopCleanupScheduler();

  // Close all WebSocket connections
  wss.clients.forEach((client) => {
    client.send(JSON.stringify({ 
      type: 'server_shutdown', 
      message: 'Server is shutting down...' 
    }));
    client.close(1001, 'Server shutdown');
  });

  // Wait a bit for cleanup
  setTimeout(() => {
    logger.info('Shutdown complete');
    process.exit(0);
  }, 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const host = process.env.HOST || '0.0.0.0';
server.listen(config.port, host, () => {
  logger.info(`🚀 CKAD Practice Platform API started`, {
    host,
    port: config.port,
    environment: config.env,
    frontendUrl: config.frontendUrl,
  });

  // Start cleanup scheduler
  startCleanupScheduler();
});

// Handle server errors
server.on('error', (error) => {
  logger.error('Server error', { error: error.message, code: error.code });
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${config.port} is already in use`);
    process.exit(1);
  }
});

export default app;



