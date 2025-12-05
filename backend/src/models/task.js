import db from '../db/index.js';

export const TaskModel = {
  /**
   * Find task by ID
   */
  findById(id) {
    const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    return stmt.get(id);
  },

  /**
   * Get all tasks (summary only - no body)
   */
  findAll() {
    const stmt = db.prepare(`
      SELECT id, title, difficulty, category, created_at 
      FROM tasks 
      ORDER BY difficulty, id
    `);
    return stmt.all();
  },

  /**
   * Get tasks by difficulty
   */
  findByDifficulty(difficulty) {
    const stmt = db.prepare(`
      SELECT id, title, difficulty, category, created_at 
      FROM tasks 
      WHERE difficulty = ?
      ORDER BY id
    `);
    return stmt.all(difficulty);
  },

  /**
   * Get tasks by category
   */
  findByCategory(category) {
    const stmt = db.prepare(`
      SELECT id, title, difficulty, category, created_at 
      FROM tasks 
      WHERE category = ?
      ORDER BY difficulty, id
    `);
    return stmt.all(category);
  },

  /**
   * Get all categories
   */
  getCategories() {
    const stmt = db.prepare(`
      SELECT DISTINCT category FROM tasks WHERE category IS NOT NULL ORDER BY category
    `);
    return stmt.all().map(row => row.category);
  },

  /**
   * Create a new task
   */
  create({ title, body, difficulty = 'medium', category = null }) {
    const stmt = db.prepare(`
      INSERT INTO tasks (title, body, difficulty, category)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(title, body, difficulty, category);
    return this.findById(result.lastInsertRowid);
  },

  /**
   * Update task
   */
  update(id, { title, body, difficulty, category }) {
    const stmt = db.prepare(`
      UPDATE tasks 
      SET title = COALESCE(?, title),
          body = COALESCE(?, body),
          difficulty = COALESCE(?, difficulty),
          category = COALESCE(?, category)
      WHERE id = ?
    `);
    stmt.run(title, body, difficulty, category, id);
    return this.findById(id);
  },

  /**
   * Delete task
   */
  delete(id) {
    const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
    return stmt.run(id);
  },

  /**
   * Get task count
   */
  count() {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM tasks');
    return stmt.get().count;
  },
};

export default TaskModel;



