import { Router } from 'express';
import db from '../../db/index.js';
import SessionModel from '../../models/session.js';
import config from '../../config/index.js';

const router = Router();

/**
 * GET /healthz
 * Basic health check - is the server running?
 */
router.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /readyz
 * Readiness check - is the server ready to accept traffic?
 */
router.get('/readyz', (req, res) => {
  try {
    // Check database connection
    const dbCheck = db.prepare('SELECT 1 as ok').get();
    
    if (!dbCheck || dbCheck.ok !== 1) {
      throw new Error('Database check failed');
    }

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'failed',
      },
      error: error.message,
    });
  }
});

/**
 * GET /api/status
 * Get platform status (authenticated endpoint in production)
 */
router.get('/api/status', (req, res) => {
  const activeSessions = SessionModel.countActive();
  
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    environment: config.env,
    version: '1.0.0',
    capacity: {
      maxConcurrentSessions: config.session.maxConcurrent,
      activeSessions,
      availableSlots: Math.max(0, config.session.maxConcurrent - activeSessions),
    },
    sessionConfig: {
      defaultTTLMinutes: config.session.ttlMinutes,
      extensionMinutes: config.session.extensionMinutes,
    },
  });
});

export default router;

