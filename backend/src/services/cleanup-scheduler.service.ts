import crypto from 'crypto';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { dockerService } from './docker.service';

export interface CreateScheduleInput {
  name: string;
  scheduleType: 'once' | 'recurring';
  frequencyPreset: 'hourly' | 'daily' | 'nightly' | 'weekly' | 'monthly' | 'custom' | 'once';
  cronExpression?: string;
  scheduledAt?: string;
  cleanImages: boolean;
  cleanImagesMode: 'all' | 'dangling';
  cleanVolumes: boolean;
  cleanNetworks: boolean;
  cleanContainers: boolean;
  cleanBuildCache: boolean;
  enabled?: boolean;
}

export class CleanupSchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private isChecking: boolean = false;

  public init() {
    // Run immediate check and start background poller every 30 seconds
    this.checkAndRunDueSchedules();
    this.timer = setInterval(() => {
      this.checkAndRunDueSchedules();
    }, 30000);
    console.log('[Scheduler] Auto Clean-Up Scheduler initialized (polling every 30s).');
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Calculate next run ISO string based on frequency preset and cron expression
   */
  public calculateNextRun(
    preset: string,
    cronExp?: string,
    scheduledAt?: string,
    fromDate: Date = new Date()
  ): string | null {
    if (preset === 'once') {
      if (scheduledAt) {
        const target = new Date(scheduledAt);
        return target.getTime() > fromDate.getTime() ? target.toISOString() : scheduledAt;
      }
      return fromDate.toISOString();
    }

    const next = new Date(fromDate.getTime());

    switch (preset) {
      case 'hourly':
        // Next full hour
        next.setHours(next.getHours() + 1, 0, 0, 0);
        return next.toISOString();

      case 'daily':
        // Next midnight (00:00:00)
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
        return next.toISOString();

      case 'nightly':
        // Next 03:00:00
        if (next.getHours() >= 3) {
          next.setDate(next.getDate() + 1);
        }
        next.setHours(3, 0, 0, 0);
        return next.toISOString();

      case 'weekly':
        // Next Sunday at 00:00:00
        const daysUntilSunday = (7 - next.getDay()) % 7 || 7;
        next.setDate(next.getDate() + daysUntilSunday);
        next.setHours(0, 0, 0, 0);
        return next.toISOString();

      case 'monthly':
        // 1st day of next month at 00:00:00
        next.setMonth(next.getMonth() + 1, 1);
        next.setHours(0, 0, 0, 0);
        return next.toISOString();

      case 'custom':
        // Fallback default: daily if no specific parser, or +24h
        next.setDate(next.getDate() + 1);
        return next.toISOString();

      default:
        next.setDate(next.getDate() + 1);
        return next.toISOString();
    }
  }

  /**
   * Poll and execute any due schedules
   */
  public async checkAndRunDueSchedules() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const now = new Date();
      const allSchedules = db.select().from(schema.cleanupSchedules).all();

      for (const schedule of allSchedules) {
        if (!schedule.enabled) continue;

        let isDue = false;

        if (schedule.scheduleType === 'once') {
          if (schedule.scheduledAt && new Date(schedule.scheduledAt).getTime() <= now.getTime()) {
            // If never run, or not marked completed
            if (schedule.lastRunStatus !== 'success') {
              isDue = true;
            }
          }
        } else if (schedule.scheduleType === 'recurring') {
          if (!schedule.nextRunAt) {
            // Missing nextRunAt, initialize it
            const nextRun = this.calculateNextRun(schedule.frequencyPreset, schedule.cronExpression || undefined, schedule.scheduledAt || undefined, now);
            db.update(schema.cleanupSchedules)
              .set({ nextRunAt: nextRun, updatedAt: now.toISOString() })
              .where(eq(schema.cleanupSchedules.id, schedule.id))
              .run();
          } else if (new Date(schedule.nextRunAt).getTime() <= now.getTime()) {
            isDue = true;
          }
        }

        if (isDue) {
          console.log(`[Scheduler] Triggering scheduled clean-up: '${schedule.name}' (${schedule.id})`);
          await this.executeSchedule(schedule.id, 'auto-scheduler');
        }
      }
    } catch (err: any) {
      console.error('[Scheduler] Error checking due clean-up schedules:', err);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Execute a clean-up schedule by ID
   */
  public async executeSchedule(scheduleId: string, triggeredBy: string = 'system') {
    const schedule = db
      .select()
      .from(schema.cleanupSchedules)
      .where(eq(schema.cleanupSchedules.id, scheduleId))
      .get();

    if (!schedule) {
      throw new Error(`Clean-up schedule with ID ${scheduleId} not found.`);
    }

    const now = new Date().toISOString();

    // Mark as running
    db.update(schema.cleanupSchedules)
      .set({ lastRunStatus: 'running', lastRunAt: now, updatedAt: now })
      .where(eq(schema.cleanupSchedules.id, scheduleId))
      .run();

    try {
      const pruneResults = await dockerService.executePrune({
        cleanImages: schedule.cleanImages,
        cleanImagesMode: schedule.cleanImagesMode as 'all' | 'dangling',
        cleanVolumes: schedule.cleanVolumes,
        cleanNetworks: schedule.cleanNetworks,
        cleanContainers: schedule.cleanContainers,
        cleanBuildCache: schedule.cleanBuildCache,
      });

      const summary = JSON.stringify({
        spaceReclaimed: pruneResults.spaceReclaimed,
        containersDeletedCount: pruneResults.containersDeleted.length,
        imagesDeletedCount: pruneResults.imagesDeleted.length,
        volumesDeletedCount: pruneResults.volumesDeleted.length,
        networksDeletedCount: pruneResults.networksDeleted.length,
        details: pruneResults.details,
      });

      const nextRun =
        schedule.scheduleType === 'recurring'
          ? this.calculateNextRun(schedule.frequencyPreset, schedule.cronExpression || undefined, schedule.scheduledAt || undefined, new Date())
          : null;

      db.update(schema.cleanupSchedules)
        .set({
          enabled: schedule.scheduleType === 'recurring' ? schedule.enabled : false, // disable once executed if one-time
          lastRunStatus: 'success',
          lastRunAt: now,
          lastRunSummary: summary,
          nextRunAt: nextRun,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.cleanupSchedules.id, scheduleId))
        .run();

      // Record audit log
      db.insert(schema.auditLogs)
        .values({
          id: crypto.randomUUID(),
          username: triggeredBy,
          action: 'CLEANUP_SCHEDULE_EXECUTED',
          resourceType: 'system',
          resourceId: scheduleId,
          details: `Schedule '${schedule.name}' executed. Reclaimed: ${pruneResults.spaceReclaimed} bytes. Details: ${pruneResults.details.join('; ')}`,
          createdAt: now,
        })
        .run();

      return {
        success: true,
        summary: pruneResults,
      };
    } catch (err: any) {
      console.error(`[Scheduler] Failed executing schedule ${schedule.id}:`, err);
      db.update(schema.cleanupSchedules)
        .set({
          lastRunStatus: 'failed',
          lastRunSummary: JSON.stringify({ error: err.message || 'Prune operation failed' }),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.cleanupSchedules.id, scheduleId))
        .run();

      throw err;
    }
  }

  public listSchedules() {
    return db
      .select()
      .from(schema.cleanupSchedules)
      .orderBy(desc(schema.cleanupSchedules.createdAt))
      .all();
  }

  public getSchedule(id: string) {
    return db
      .select()
      .from(schema.cleanupSchedules)
      .where(eq(schema.cleanupSchedules.id, id))
      .get();
  }

  public createSchedule(input: CreateScheduleInput, createdBy: string = 'admin') {
    const id = crypto.randomUUID();
    const now = new Date();
    const nextRun = input.enabled !== false
      ? this.calculateNextRun(input.frequencyPreset, input.cronExpression, input.scheduledAt, now)
      : null;

    db.insert(schema.cleanupSchedules)
      .values({
        id,
        name: input.name.trim(),
        scheduleType: input.scheduleType,
        frequencyPreset: input.frequencyPreset,
        cronExpression: input.cronExpression || null,
        scheduledAt: input.scheduledAt || null,
        cleanImages: input.cleanImages,
        cleanImagesMode: input.cleanImagesMode || 'all',
        cleanVolumes: input.cleanVolumes,
        cleanNetworks: input.cleanNetworks,
        cleanContainers: input.cleanContainers,
        cleanBuildCache: input.cleanBuildCache,
        enabled: input.enabled !== false,
        nextRunAt: nextRun,
        createdBy,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .run();

    return this.getSchedule(id);
  }

  public updateSchedule(id: string, input: Partial<CreateScheduleInput>) {
    const existing = this.getSchedule(id);
    if (!existing) {
      throw new Error(`Schedule ${id} not found`);
    }

    const now = new Date();
    const scheduleType = input.scheduleType || existing.scheduleType;
    const frequencyPreset = input.frequencyPreset || existing.frequencyPreset;
    const cronExpression = input.cronExpression !== undefined ? input.cronExpression : existing.cronExpression;
    const scheduledAt = input.scheduledAt !== undefined ? input.scheduledAt : existing.scheduledAt;
    const enabled = input.enabled !== undefined ? input.enabled : existing.enabled;

    const nextRun = enabled
      ? this.calculateNextRun(frequencyPreset, cronExpression || undefined, scheduledAt || undefined, now)
      : null;

    db.update(schema.cleanupSchedules)
      .set({
        name: input.name !== undefined ? input.name.trim() : existing.name,
        scheduleType: scheduleType as 'once' | 'recurring',
        frequencyPreset,
        cronExpression: cronExpression || null,
        scheduledAt: scheduledAt || null,
        cleanImages: input.cleanImages !== undefined ? input.cleanImages : existing.cleanImages,
        cleanImagesMode: (input.cleanImagesMode || existing.cleanImagesMode) as 'all' | 'dangling',
        cleanVolumes: input.cleanVolumes !== undefined ? input.cleanVolumes : existing.cleanVolumes,
        cleanNetworks: input.cleanNetworks !== undefined ? input.cleanNetworks : existing.cleanNetworks,
        cleanContainers: input.cleanContainers !== undefined ? input.cleanContainers : existing.cleanContainers,
        cleanBuildCache: input.cleanBuildCache !== undefined ? input.cleanBuildCache : existing.cleanBuildCache,
        enabled,
        nextRunAt: nextRun,
        updatedAt: now.toISOString(),
      })
      .where(eq(schema.cleanupSchedules.id, id))
      .run();

    return this.getSchedule(id);
  }

  public toggleSchedule(id: string) {
    const schedule = this.getSchedule(id);
    if (!schedule) {
      throw new Error(`Schedule ${id} not found`);
    }

    const newEnabled = !schedule.enabled;
    const now = new Date();
    const nextRun = newEnabled
      ? this.calculateNextRun(schedule.frequencyPreset, schedule.cronExpression || undefined, schedule.scheduledAt || undefined, now)
      : null;

    db.update(schema.cleanupSchedules)
      .set({
        enabled: newEnabled,
        nextRunAt: nextRun,
        updatedAt: now.toISOString(),
      })
      .where(eq(schema.cleanupSchedules.id, id))
      .run();

    return this.getSchedule(id);
  }

  public deleteSchedule(id: string) {
    const schedule = this.getSchedule(id);
    if (!schedule) {
      throw new Error(`Schedule ${id} not found`);
    }

    db.delete(schema.cleanupSchedules).where(eq(schema.cleanupSchedules.id, id)).run();
    return { success: true, message: `Schedule '${schedule.name}' deleted.` };
  }
}

export const cleanupSchedulerService = new CleanupSchedulerService();
