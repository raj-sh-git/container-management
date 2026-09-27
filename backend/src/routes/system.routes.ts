import { Router, Response } from 'express';
import { dockerService } from '../services/docker.service';
import { cleanupSchedulerService } from '../services/cleanup-scheduler.service';
import { db } from '../db';
import * as schema from '../db/schema';
import { desc } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';


const router = Router();
router.use(authenticateToken);

// System info
router.get('/info', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const info = await dockerService.getInfo();
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get Docker info' });
  }
});

// Host metrics (CPU & Memory)
router.get('/host-metrics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const metrics = await dockerService.getHostMetrics();
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get host metrics' });
  }
});

// System version
router.get('/version', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const version = await dockerService.getVersion();
    res.json(version);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get Docker version' });
  }
});

// Disk usage
router.get('/df', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const df = await dockerService.getDiskUsage();
    res.json(df);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get disk usage' });
  }
});

// System prune (Admin only)
router.post('/prune', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { all = false, volumes = false } = req.body;
    const results = await dockerService.systemPrune({ all, volumes });
    await logAudit(req, 'SYSTEM_PRUNE', 'system', undefined, `All: ${all}, Volumes: ${volumes}`);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to prune system' });
  }
});

// Audit logs (Admin only)
router.get('/audit', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 1000;
    const logs = db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit)
      .all();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch audit logs' });
  }
});

// Clear audit logs (Admin only)
router.delete('/audit', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    db.delete(schema.auditLogs).run();
    await logAudit(req, 'AUDIT_LOGS_CLEAR', 'system', 'audit', 'Permanently cleared all audit logs');
    res.json({ success: true, message: 'Audit logs cleared successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear audit logs' });
  }
});

// ==================== CLEAN-UP SCHEDULES ====================

// List schedules
router.get('/cleanup-schedules', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schedules = cleanupSchedulerService.listSchedules();
    res.json(schedules);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list cleanup schedules' });
  }
});

// Create schedule (Admin only)
router.post('/cleanup-schedules', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schedule = cleanupSchedulerService.createSchedule(req.body, req.user?.username || 'admin');
    await logAudit(req, 'CLEANUP_SCHEDULE_CREATE', 'system', schedule?.id, `Created schedule '${schedule?.name}'`);
    res.status(201).json(schedule);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create cleanup schedule' });
  }
});

// Update schedule (Admin only)
router.put('/cleanup-schedules/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const schedule = cleanupSchedulerService.updateSchedule(id, req.body);
    await logAudit(req, 'CLEANUP_SCHEDULE_UPDATE', 'system', schedule?.id, `Updated schedule '${schedule?.name}'`);
    res.json(schedule);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update cleanup schedule' });
  }
});

// Toggle schedule enabled (Admin only)
router.patch('/cleanup-schedules/:id/toggle', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const schedule = cleanupSchedulerService.toggleSchedule(id);
    await logAudit(
      req,
      'CLEANUP_SCHEDULE_TOGGLE',
      'system',
      schedule?.id,
      `${schedule?.enabled ? 'Enabled' : 'Disabled'} schedule '${schedule?.name}'`
    );
    res.json(schedule);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to toggle cleanup schedule' });
  }
});

// Trigger immediate run of schedule (Admin only)
router.post('/cleanup-schedules/:id/run', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await cleanupSchedulerService.executeSchedule(id, req.user?.username || 'admin');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to run cleanup schedule' });
  }
});

// Delete schedule (Admin only)
router.delete('/cleanup-schedules/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = cleanupSchedulerService.deleteSchedule(id);
    await logAudit(req, 'CLEANUP_SCHEDULE_DELETE', 'system', id, `Deleted clean-up schedule`);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete cleanup schedule' });
  }
});

// Execute immediate granular prune (Admin only)
router.post('/cleanup-now', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const results = await dockerService.executePrune(req.body);
    await logAudit(
      req,
      'CLEANUP_IMMEDIATE_EXECUTE',
      'system',
      undefined,
      `Reclaimed: ${results.spaceReclaimed} bytes. ${results.details.join('; ')}`
    );
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to execute clean-up' });
  }
});

export default router;

