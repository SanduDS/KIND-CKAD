import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import logger from '../utils/logger.js';

export const TaskResultModel = {
  /**
   * Find task result by ID
   */
  findById(id) {
    const stmt = db.prepare('SELECT * FROM task_results WHERE id = ?');
    return stmt.get(id);
  },

  /**
   * Find all task results for a session
   */
  findBySession(sessionId) {
    const stmt = db.prepare(`
      SELECT tr.*, t.title, t.difficulty, t.category
      FROM task_results tr
      JOIN tasks t ON tr.task_id = t.id
      WHERE tr.session_id = ?
      ORDER BY tr.verified_at DESC
    `);
    return stmt.all(sessionId);
  },

  /**
   * Find task result for a specific task in a session
   */
  findBySessionAndTask(sessionId, taskId) {
    const stmt = db.prepare(`
      SELECT * FROM task_results 
      WHERE session_id = ? AND task_id = ?
      ORDER BY verified_at DESC
      LIMIT 1
    `);
    return stmt.get(sessionId, taskId);
  },

  /**
   * Create a new task result
   */
  create({
    sessionId,
    taskId,
    userId,
    passed,
    score,
    maxScore,
    checksPassed,
    checksTotal,
    verificationOutput,
    verificationDetails,
  }) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO task_results (
        id, session_id, task_id, user_id, passed, score, max_score,
        checks_passed, checks_total, verification_output, verification_details
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      sessionId,
      taskId,
      userId,
      passed ? 1 : 0,
      score,
      maxScore,
      checksPassed,
      checksTotal,
      verificationOutput,
      JSON.stringify(verificationDetails)
    );

    logger.info('Created task result', { id, sessionId, taskId, passed, score });
    return this.findById(id);
  },

  /**
   * Get session statistics
   */
  getSessionStats(sessionId) {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_attempts,
        SUM(passed) as tasks_passed,
        SUM(score) as total_score,
        SUM(max_score) as max_possible_score,
        AVG(score * 100.0 / max_score) as avg_percentage
      FROM task_results
      WHERE session_id = ?
    `);
    return stmt.get(sessionId);
  },

  /**
   * Get detailed breakdown for a session
   */
  getSessionBreakdown(sessionId) {
    const stmt = db.prepare(`
      SELECT 
        t.id as task_id,
        t.title,
        t.difficulty,
        t.category,
        tr.passed,
        tr.score,
        tr.max_score,
        tr.checks_passed,
        tr.checks_total,
        tr.verified_at
      FROM task_results tr
      JOIN tasks t ON tr.task_id = t.id
      WHERE tr.session_id = ?
      ORDER BY tr.verified_at ASC
    `);
    return stmt.all(sessionId);
  },

  /**
   * Delete all results for a session
   */
  deleteBySession(sessionId) {
    const stmt = db.prepare('DELETE FROM task_results WHERE session_id = ?');
    const result = stmt.run(sessionId);
    logger.info('Deleted task results', { sessionId, deleted: result.changes });
    return result.changes;
  },
};

export default TaskResultModel;
