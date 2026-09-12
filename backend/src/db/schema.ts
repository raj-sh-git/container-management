import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email'),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'operator', 'viewer'] }).notNull().default('operator'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  username: text('username').notNull(),
  action: text('action').notNull(), // e.g., CONTAINER_START, CONTAINER_STOP, EXEC_SESSION, IMAGE_PULL, SCAN_TRIGGERED
  resourceType: text('resource_type').notNull(), // container, image, volume, network, user, system
  resourceId: text('resource_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull(),
});

export const scanReports = sqliteTable('scan_reports', {
  id: text('id').primaryKey(),
  targetType: text('target_type', { enum: ['image', 'container'] }).notNull(),
  targetName: text('target_name').notNull(),
  targetId: text('target_id'),
  criticalCount: integer('critical_count').notNull().default(0),
  highCount: integer('high_count').notNull().default(0),
  mediumCount: integer('medium_count').notNull().default(0),
  lowCount: integer('low_count').notNull().default(0),
  unknownCount: integer('unknown_count').notNull().default(0),
  jsonReportPath: text('json_report_path'),
  htmlReportPath: text('html_report_path'),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull().default('pending'),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});
