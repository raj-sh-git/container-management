import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config';
import * as schema from './schema';
import { eq } from 'drizzle-orm';

const sqlite = new Database(config.dbPath);

// Enable WAL mode for high performance concurrent reads/writes
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });

export async function initDatabase() {
  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scan_reports (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_name TEXT NOT NULL,
      target_id TEXT,
      critical_count INTEGER NOT NULL DEFAULT 0,
      high_count INTEGER NOT NULL DEFAULT 0,
      medium_count INTEGER NOT NULL DEFAULT 0,
      low_count INTEGER NOT NULL DEFAULT 0,
      unknown_count INTEGER NOT NULL DEFAULT 0,
      json_report_path TEXT,
      html_report_path TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      duration_ms INTEGER,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cleanup_schedules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schedule_type TEXT NOT NULL DEFAULT 'recurring',
      frequency_preset TEXT NOT NULL DEFAULT 'daily',
      cron_expression TEXT,
      scheduled_at TEXT,
      clean_images INTEGER NOT NULL DEFAULT 1,
      clean_images_mode TEXT NOT NULL DEFAULT 'all',
      clean_volumes INTEGER NOT NULL DEFAULT 0,
      clean_networks INTEGER NOT NULL DEFAULT 1,
      clean_containers INTEGER NOT NULL DEFAULT 1,
      clean_build_cache INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      last_run_status TEXT,
      last_run_summary TEXT,
      next_run_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Ensure must_change_password column exists if DB was already created
  try {
    sqlite.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1;');
  } catch {}

  // Check if default admin exists; if not, seed admin
  const existingAdmin = db.select().from(schema.users).where(eq(schema.users.role, 'admin')).get();

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(config.defaultAdminPassword, 10);
    const now = new Date().toISOString();
    db.insert(schema.users).values({
      id: crypto.randomUUID(),
      username: config.defaultAdminUser,
      email: 'admin@local.docker',
      passwordHash,
      role: 'admin',
      isActive: true,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    }).run();
    console.log(`[DB] Created default admin user: '${config.defaultAdminUser}' with forced password reset on first login.`);
  }
}
