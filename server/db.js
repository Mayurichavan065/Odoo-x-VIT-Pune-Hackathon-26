const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'reimburseflow.db');

let db;

function getDB() {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDB() {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_currency TEXT DEFAULT 'INR',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','manager','employee')),
      company_id TEXT NOT NULL,
      manager_id TEXT,
      avatar_color TEXT DEFAULT '#6366F1',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (manager_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      total_amount REAL NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      converted_amount REAL,
      category TEXT NOT NULL,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','pending','in_review','approved','rejected','paid')),
      submitted_by TEXT NOT NULL,
      company_id TEXT NOT NULL,
      receipt_path TEXT,
      receipt_ocr_data TEXT,
      submitted_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (submitted_by) REFERENCES users(id),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS expense_lines (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      date TEXT,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS approval_steps (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      approver_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','skipped')),
      comment TEXT,
      decided_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (approver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS approval_rules (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      rule_type TEXT NOT NULL CHECK(rule_type IN ('percentage','auto_approve','hybrid')),
      condition_field TEXT,
      condition_operator TEXT,
      condition_value REAL,
      auto_approve_below REAL,
      approver_id TEXT,
      percentage_threshold REAL,
      is_active INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS currencies (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      rate_to_usd REAL NOT NULL DEFAULT 1.0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Seed currencies if empty
    INSERT OR IGNORE INTO currencies (code, name, symbol, rate_to_usd) VALUES
      ('USD', 'US Dollar', '$', 1.0),
      ('EUR', 'Euro', '€', 0.92),
      ('GBP', 'British Pound', '£', 0.79),
      ('INR', 'Indian Rupee', '₹', 83.12),
      ('JPY', 'Japanese Yen', '¥', 149.50),
      ('CAD', 'Canadian Dollar', 'C$', 1.36),
      ('AUD', 'Australian Dollar', 'A$', 1.53),
      ('CHF', 'Swiss Franc', 'CHF', 0.88),
      ('CNY', 'Chinese Yuan', '¥', 7.24),
      ('SGD', 'Singapore Dollar', 'S$', 1.34);
  `);

  console.log('  ✅ Database initialized');
}

module.exports = { getDB, initDB };
