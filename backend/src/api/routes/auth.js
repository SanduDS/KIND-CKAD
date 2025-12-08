import { Router } from 'express';
import bcrypt from 'bcryptjs';
import config from '../../config/index.js';
import UserModel from '../../models/user.js';
import AuthModel from '../../models/auth.js';
import { generateTokens, verifyRefreshToken, authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';
import { sendOTPEmail } from '../../services/email.js';
import logger from '../../utils/logger.js';

const router = Router();



/**
 * POST /api/auth/email/otp
 * Send OTP to email for login
 */
router.post('/email/otp', authLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || !isValidEmail(email)) {
    throw new ValidationError('Valid email is required');
  }

  // Generate and store OTP
  const otp = await AuthModel.createOTP(email);

  // Send OTP via email
  await sendOTPEmail(email, otp);

  logger.info('OTP sent', { email });

  res.json({
    success: true,
    message: 'OTP sent to your email',
  });
}));

/**
 * POST /api/auth/login
 * Email/password login - disabled, use OTP authentication
 */
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  return res.status(403).json({
    error: 'AuthMethodDisabled',
    message: 'Password login is disabled. Please use email OTP authentication.',
  });

  // Find or create user
  const user = UserModel.findOrCreate({ 
    email, 
    name: email.split('@')[0] 
  });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id);

  // Store refresh token hash
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  AuthModel.createRefreshToken(user.id, refreshTokenHash, refreshExpiry);

  logger.info('User logged in via password', { userId: user.id, email });

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes in seconds
  });
}));

/**
 * POST /api/auth/email/verify
 * Verify OTP and login
 */
router.post('/email/verify', authLimiter, asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !isValidEmail(email)) {
    throw new ValidationError('Valid email is required');
  }

  if (!otp || otp.length !== 6) {
    throw new ValidationError('Valid 6-digit OTP is required');
  }

  // Verify OTP
  const isValid = await AuthModel.verifyOTP(email, otp);

  if (!isValid) {
    return res.status(401).json({
      error: 'InvalidOTP',
      message: 'Invalid or expired OTP',
    });
  }

  // Find or create user
  const user = UserModel.findOrCreate({ email, name: email.split('@')[0] });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id);

  // Store refresh token hash
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  AuthModel.createRefreshToken(user.id, refreshTokenHash, refreshExpiry);

  logger.info('User logged in via OTP', { userId: user.id, email });

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes in seconds
  });
}));

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', (req, res) => {
  if (!config.google.clientId) {
    return res.status(501).json({
      error: 'NotConfigured',
      message: 'Google OAuth is not configured',
    });
  }

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.callbackUrl,
    response_type: 'code',
    scope: 'email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    logger.warn('Google OAuth error', { error });
    return res.redirect(`${config.frontendUrl}/login?error=${error}`);
  }

  if (!code) {
    return res.redirect(`${config.frontendUrl}/login?error=no_code`);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      logger.error('Google token exchange error', { error: tokenData.error });
      return res.redirect(`${config.frontendUrl}/login?error=token_exchange_failed`);
    }

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userResponse.json();

    if (!userData.email) {
      return res.redirect(`${config.frontendUrl}/login?error=no_email`);
    }

    // Find or create user
    const user = UserModel.findOrCreate({
      email: userData.email,
      name: userData.name || userData.email.split('@')[0],
    });

    // Generate our tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token hash
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    AuthModel.createRefreshToken(user.id, refreshTokenHash, refreshExpiry);

    logger.info('User logged in via Google', { userId: user.id, email: user.email });

    // Redirect to frontend with tokens
    const params = new URLSearchParams({
      accessToken,
      refreshToken,
    });

    res.redirect(`${config.frontendUrl}/auth/callback?${params}`);
  } catch (error) {
    logger.error('Google OAuth callback error', { error: error.message });
    res.redirect(`${config.frontendUrl}/login?error=oauth_failed`);
  }
}));

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ValidationError('Refresh token is required');
  }

  // Verify refresh token
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    return res.status(401).json({
      error: 'InvalidToken',
      message: 'Invalid or expired refresh token',
    });
  }

  // Check if token exists in DB (not revoked)
  // Note: We can't directly compare because tokens are hashed
  // In production, you'd want to store a token ID instead
  const user = UserModel.findById(decoded.userId);
  if (!user) {
    return res.status(401).json({
      error: 'InvalidToken',
      message: 'User not found',
    });
  }

  // Generate new tokens
  const tokens = generateTokens(user.id);

  // Store new refresh token (optional: delete old one)
  const newRefreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  AuthModel.createRefreshToken(user.id, newRefreshTokenHash, refreshExpiry);

  res.json({
    success: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: 900,
  });
}));

/**
 * POST /api/auth/logout
 * Logout and invalidate refresh token
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  // Delete all refresh tokens for user (logout from all devices)
  AuthModel.deleteAllRefreshTokensForUser(req.userId);

  logger.info('User logged out', { userId: req.userId });

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
}));

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      createdAt: req.user.created_at,
    },
  });
});

// Helper function to validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default router;



