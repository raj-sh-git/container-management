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

export const cleanupSchedules = sqliteTable('cleanup_schedules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  scheduleType: text('schedule_type', { enum: ['once', 'recurring'] }).notNull().default('recurring'),
  frequencyPreset: text('frequency_preset').notNull().default('daily'), // hourly, daily, weekly, monthly, custom, once
  cronExpression: text('cron_expression'),
  scheduledAt: text('scheduled_at'), // ISO timestamp for one-time runs
  cleanImages: integer('clean_images', { mode: 'boolean' }).notNull().default(true),
  cleanImagesMode: text('clean_images_mode', { enum: ['all', 'dangling'] }).notNull().default('all'),
  cleanVolumes: integer('clean_volumes', { mode: 'boolean' }).notNull().default(false),
  cleanNetworks: integer('clean_networks', { mode: 'boolean' }).notNull().default(true),
  cleanContainers: integer('clean_containers', { mode: 'boolean' }).notNull().default(true),
  cleanBuildCache: integer('clean_build_cache', { mode: 'boolean' }).notNull().default(true),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastRunAt: text('last_run_at'),
  lastRunStatus: text('last_run_status'), // success, failed, running
  lastRunSummary: text('last_run_summary'), // JSON string
  nextRunAt: text('next_run_at'),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const scalingPolicies = sqliteTable('scaling_policies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetType: text('target_type', { enum: ['container', 'stack'] }).notNull().default('container'),
  targetId: text('target_id').notNull(), // container name or service name
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  minReplicas: integer('min_replicas').notNull().default(1),
  maxReplicas: integer('max_replicas').notNull().default(3),
  currentReplicas: integer('current_replicas').notNull().default(1),
  cpuThreshold: integer('cpu_threshold').notNull().default(80), // % CPU (e.g. 80)
  memoryThreshold: integer('memory_threshold').notNull().default(85), // % Memory (e.g. 85)
  cooldownSeconds: integer('cooldown_seconds').notNull().default(60), // cooldown in seconds
  lastScaleAt: text('last_scale_at'),
  lastScaleAction: text('last_scale_action'), // 'SCALE_UP', 'SCALE_DOWN', 'MANUAL'
  lastScaleReason: text('last_scale_reason'),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const containerFlags = sqliteTable('container_flags', {
  containerId: text('container_id').primaryKey(),
  containerName: text('container_name'),
  isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
  isProtected: integer('is_protected', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by'),
});


