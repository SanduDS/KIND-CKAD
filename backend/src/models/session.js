import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

export const SessionModel = {
  /**
   * Find session by ID
   */
  findById(id) {
    const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(id);
  },

  /**
   * Find active session by user ID
   */
  findActiveByUserId(userId) {
    const stmt = db.prepare(`
      SELECT * FROM sessions 
      WHERE user_id = ? AND status = 'started'
      LIMIT 1
    `);
    return stmt.get(userId);
  },

  /**
   * Find session by cluster name
   */
  findByClusterName(clusterName) {
    const stmt = db.prepare('SELECT * FROM sessions WHERE cluster_name = ?');
    return stmt.get(clusterName);
  },

  /**
   * Get all active sessions
   */
  findAllActive() {
    const stmt = db.prepare(`SELECT * FROM sessions WHERE status = 'started'`);
    return stmt.all();
  },

  /**
   * Get count of active sessions
   */
  countActive() {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE status = 'started'`);
    return stmt.get().count;
  },

  /**
   * Get expired sessions (past TTL)
   */
  findExpired() {
    const stmt = db.prepare(`
      SELECT * FROM sessions 
      WHERE status = 'started' 
      AND datetime(start_time, '+' || ttl_minutes || ' minutes') < datetime('now')
    `);
    return stmt.all();
  },

  /**
   * Create a new session
   */
  create({ userId, clusterName, kubeconfigPath, terminalContainerId }) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO sessions (
        id, user_id, cluster_name, kubeconfig_path, 
        terminal_container_id, ttl_minutes, status
      )
      VALUES (?, ?, ?, ?, ?, ?, 'started')
    `);

    stmt.run(
      id,
      userId,
      clusterName,
      kubeconfigPath,
      terminalContainerId,
      config.session.ttlMinutes
    );

    logger.info('Created new session', { sessionId: id, userId, clusterName });
    return this.findById(id);
  },

  /**
   * Update session status
   */
  updateStatus(id, status, notes = null) {
    const stmt = db.prepare(`
      UPDATE sessions 
      SET status = ?, end_time = CURRENT_TIMESTAMP, notes = COALESCE(?, notes)
      WHERE id = ?
    `);
    stmt.run(status, notes, id);
    logger.info('Updated session status', { sessionId: id, status });
    return this.findById(id);
  },

  /**
   * Extend session TTL
   */
  extend(id) {
    const session = this.findById(id);
    if (!session) return null;
    if (session.extended) {
      throw new Error('Session already extended');
    }

    const newTtl = session.ttl_minutes + config.session.extensionMinutes;
    const stmt = db.prepare(`
      UPDATE sessions 
      SET ttl_minutes = ?, extended = 1
      WHERE id = ?
    `);
    stmt.run(newTtl, id);
    logger.info('Extended session TTL', { sessionId: id, newTtl });
    return this.findById(id);
  },

  /**
   * Add notes to session
   */
  addNotes(id, notes) {
    const stmt = db.prepare(`
      UPDATE sessions 
      SET notes = COALESCE(notes || '\n', '') || ?
      WHERE id = ?
    `);
    stmt.run(notes, id);
  },

  /**
   * Delete session (hard delete)
   */
  delete(id) {
    const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
    return stmt.run(id);
  },

  /**
   * Get session with remaining time info
   */
  getWithTimeInfo(id) {
    const stmt = db.prepare(`
      SELECT 
        *,
        ROUND((julianday(datetime(start_time, '+' || ttl_minutes || ' minutes')) - julianday('now')) * 24 * 60) as remaining_minutes
      FROM sessions 
      WHERE id = ?
    `);
    return stmt.get(id);
  },
};

export default SessionModel;

