import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import logger from '../utils/logger.js';

export const AuthModel = {
  // ==================== REFRESH TOKENS ====================

  /**
   * Create refresh token record
   */
  createRefreshToken(userId, tokenHash, expiresAt) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, userId, tokenHash, expiresAt);
    logger.debug('Created refresh token', { userId });
    return id;
  },

  /**
   * Find refresh token by hash
   */
  findRefreshToken(tokenHash) {
    const stmt = db.prepare(`
      SELECT * FROM refresh_tokens 
      WHERE token_hash = ? AND expires_at > datetime('now')
    `);
    return stmt.get(tokenHash);
  },

  /**
   * Delete refresh token
   */
  deleteRefreshToken(tokenHash) {
    const stmt = db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?');
    return stmt.run(tokenHash);
  },

  /**
   * Delete all refresh tokens for user
   */
  deleteAllRefreshTokensForUser(userId) {
    const stmt = db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?');
    return stmt.run(userId);
  },

  /**
   * Clean up expired refresh tokens
   */
  cleanupExpiredRefreshTokens() {
    const stmt = db.prepare(`DELETE FROM refresh_tokens WHERE expires_at < datetime('now')`);
    const result = stmt.run();
    if (result.changes > 0) {
      logger.info('Cleaned up expired refresh tokens', { count: result.changes });
    }
    return result.changes;
  },

  // ==================== OTP CODES ====================

  /**
   * Create OTP code
   */
  async createOTP(email) {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const id = uuidv4();
    
    // Expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete any existing OTPs for this email
    const deleteStmt = db.prepare('DELETE FROM otp_codes WHERE email = ?');
    deleteStmt.run(email);

    // Insert new OTP
    const insertStmt = db.prepare(`
      INSERT INTO otp_codes (id, email, code_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    insertStmt.run(id, email, codeHash, expiresAt);

    logger.info('Created OTP code', { email });
    return code; // Return plain code for sending via email
  },

  /**
   * Verify OTP code
   */
  async verifyOTP(email, code) {
    const stmt = db.prepare(`
      SELECT * FROM otp_codes 
      WHERE email = ? AND used = 0 AND expires_at > datetime('now')
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const otpRecord = stmt.get(email);

    if (!otpRecord) {
      logger.warn('OTP not found or expired', { email });
      return false;
    }

    const isValid = await bcrypt.compare(code, otpRecord.code_hash);
    
    if (isValid) {
      // Mark OTP as used
      const updateStmt = db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?');
      updateStmt.run(otpRecord.id);
      logger.info('OTP verified successfully', { email });
      return true;
    }

    logger.warn('Invalid OTP code', { email });
    return false;
  },

  /**
   * Clean up expired/used OTPs
   */
  cleanupOTPs() {
    const stmt = db.prepare(`
      DELETE FROM otp_codes 
      WHERE used = 1 OR expires_at < datetime('now')
    `);
    const result = stmt.run();
    if (result.changes > 0) {
      logger.debug('Cleaned up OTP codes', { count: result.changes });
    }
    return result.changes;
  },
};

export default AuthModel;

