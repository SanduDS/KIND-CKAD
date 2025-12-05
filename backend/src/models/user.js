import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import logger from '../utils/logger.js';

export const UserModel = {
  /**
   * Find user by ID
   */
  findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  },

  /**
   * Find user by email
   */
  findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  },

  /**
   * Create a new user
   */
  create({ email, name }) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO users (id, email, name)
      VALUES (?, ?, ?)
    `);
    
    try {
      stmt.run(id, email, name);
      logger.info('Created new user', { userId: id, email });
      return this.findById(id);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        // User already exists, return existing user
        return this.findByEmail(email);
      }
      throw error;
    }
  },

  /**
   * Find or create user by email
   */
  findOrCreate({ email, name }) {
    let user = this.findByEmail(email);
    if (!user) {
      user = this.create({ email, name });
    }
    return user;
  },

  /**
   * Update user
   */
  update(id, { name }) {
    const stmt = db.prepare(`
      UPDATE users 
      SET name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(name, id);
    return this.findById(id);
  },

  /**
   * Delete user
   */
  delete(id) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    return stmt.run(id);
  },
};

export default UserModel;

