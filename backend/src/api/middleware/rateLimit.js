import rateLimit from 'express-rate-limit';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * General API rate limiter
 */
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'TooManyRequests',
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn('Rate limit exceeded', { 
      ip: req.ip, 
      path: req.path 
    });
    res.status(429).json(options.message);
  },
});

/**
 * Auth endpoints rate limiter (stricter)
 */
export const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  message: {
    error: 'TooManyRequests',
    message: 'Too many authentication attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use email if provided, otherwise IP
    return req.body?.email || req.ip;
  },
  handler: (req, res, next, options) => {
    logger.warn('Auth rate limit exceeded', { 
      ip: req.ip, 
      email: req.body?.email 
    });
    res.status(429).json(options.message);
  },
});

/**
 * Session start rate limiter (very strict)
 */
export const sessionStartLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: config.rateLimit.sessionStartMax,
  message: {
    error: 'TooManyRequests',
    message: 'Too many session creation attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID
    return req.userId || req.ip;
  },
  handler: (req, res, next, options) => {
    logger.warn('Session start rate limit exceeded', { 
      ip: req.ip, 
      userId: req.userId 
    });
    res.status(429).json(options.message);
  },
});

export default { generalLimiter, authLimiter, sessionStartLimiter };

