import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
const dbDir = dirname(config.database.path);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(config.database.path);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const initSchema = () => {
  logger.info('Initializing database schema...');

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Refresh tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // OTP codes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Allocated ports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS allocated_ports (
      port INTEGER PRIMARY KEY,
      session_id TEXT NOT NULL,
      port_type TEXT NOT NULL,
      allocated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT DEFAULT 'started' CHECK(status IN ('started', 'ended', 'timeout')),
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      ttl_minutes INTEGER DEFAULT 60,
      cluster_name TEXT UNIQUE,
      kubeconfig_path TEXT,
      terminal_container_id TEXT,
      extended INTEGER DEFAULT 0,
      current_task_id INTEGER DEFAULT 1,
      completed_tasks TEXT DEFAULT '[]',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
      category TEXT,
      verification_config TEXT,
      max_score INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Task results table - stores verification results for each task attempt
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_results (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      task_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      passed INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      max_score INTEGER DEFAULT 10,
      checks_passed INTEGER DEFAULT 0,
      checks_total INTEGER DEFAULT 0,
      verification_output TEXT,
      verification_details TEXT,
      verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_cluster_name ON sessions(cluster_name);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
    CREATE INDEX IF NOT EXISTS idx_allocated_ports_session_id ON allocated_ports(session_id);
    CREATE INDEX IF NOT EXISTS idx_task_results_session_id ON task_results(session_id);
    CREATE INDEX IF NOT EXISTS idx_task_results_task_id ON task_results(task_id);
  `);

  logger.info('Database schema initialized successfully');
};

// Run initialization
initSchema();

export default db;



