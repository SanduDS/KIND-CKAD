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
   * Get random 20 tasks for CKAD exam session
   * Weighted distribution: 25% easy, 40% medium, 35% hard
   */
  getRandomExamTasks(count = 20) {
    // Calculate task distribution
    const easyCount = Math.round(count * 0.25);    // 25% - 5 tasks
    const mediumCount = Math.round(count * 0.40);  // 40% - 8 tasks
    const hardCount = count - easyCount - mediumCount; // 35% - 7 tasks
    
    // Get available tasks for each difficulty
    const easyTasks = db.prepare('SELECT * FROM tasks WHERE difficulty = ? ORDER BY RANDOM() LIMIT ?')
      .all('easy', easyCount);
    const mediumTasks = db.prepare('SELECT * FROM tasks WHERE difficulty = ? ORDER BY RANDOM() LIMIT ?')
      .all('medium', mediumCount);
    const hardTasks = db.prepare('SELECT * FROM tasks WHERE difficulty = ? ORDER BY RANDOM() LIMIT ?')
      .all('hard', hardCount);
    
    // Combine all tasks
    const allTasks = [...easyTasks, ...mediumTasks, ...hardTasks];
    
    // Verify we have enough tasks
    if (allTasks.length < count) {
      throw new Error(
        `Insufficient tasks in database. Need ${count} (${easyCount} easy, ${mediumCount} medium, ${hardCount} hard), ` +
        `have ${allTasks.length} (${easyTasks.length} easy, ${mediumTasks.length} medium, ${hardTasks.length} hard)`
      );
    }
    
    // Shuffle the combined array to randomize order
    for (let i = allTasks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allTasks[i], allTasks[j]] = [allTasks[j], allTasks[i]];
    }
    
    return allTasks;
  },

  /**
   * Create a new task
   */
  create({ title, body, difficulty = 'medium', category = null, verificationConfig = null, maxScore = 10 }) {
    const stmt = db.prepare(`
      INSERT INTO tasks (title, body, difficulty, category, verification_config, max_score)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      title, 
      body, 
      difficulty, 
      category,
      verificationConfig ? JSON.stringify(verificationConfig) : null,
      maxScore
    );
    return this.findById(result.lastInsertRowid);
  },

  /**
   * Update task
   */
  update(id, { title, body, difficulty, category, verificationConfig, maxScore }) {
    const stmt = db.prepare(`
      UPDATE tasks 
      SET title = COALESCE(?, title),
          body = COALESCE(?, body),
          difficulty = COALESCE(?, difficulty),
          category = COALESCE(?, category),
          verification_config = COALESCE(?, verification_config),
          max_score = COALESCE(?, max_score)
      WHERE id = ?
    `);
    stmt.run(
      title, 
      body, 
      difficulty, 
      category,
      verificationConfig ? JSON.stringify(verificationConfig) : undefined,
      maxScore,
      id
    );
    return this.findById(id);
  },

  /**
   * Get verification config for a task
   */
  getVerificationConfig(id) {
    const task = this.findById(id);
    if (!task || !task.verification_config) {
      return null;
    }
    try {
      return JSON.parse(task.verification_config);
    } catch {
      return null;
    }
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



