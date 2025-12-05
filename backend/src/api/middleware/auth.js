import jwt from 'jsonwebtoken';
import config from '../../config/index.js';
import UserModel from '../../models/user.js';
import logger from '../../utils/logger.js';

/**
 * Middleware to verify JWT access token
 */
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'No token provided' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Get user from database
    const user = UserModel.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'User not found' 
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'TokenExpired',
        message: 'Access token has expired' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'InvalidToken',
        message: 'Invalid access token' 
      });
    }

    logger.error('Auth middleware error', { error: error.message });
    return res.status(500).json({ 
      error: 'InternalError',
      message: 'Authentication failed' 
    });
  }
};

/**
 * Verify JWT token for WebSocket connections
 */
export const authenticateWebSocket = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = UserModel.findById(decoded.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    return { user, userId: user.id };
  } catch (error) {
    logger.warn('WebSocket auth failed', { error: error.message });
    throw error;
  }
};

/**
 * Generate JWT tokens
 */
export const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  return { accessToken, refreshToken };
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw error;
  }
};

export default { authenticate, authenticateWebSocket, generateTokens, verifyRefreshToken };



