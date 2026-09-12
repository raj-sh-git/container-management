import { Router, Response } from 'express';
import { dockerService } from '../services/docker.service';
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
    await logAudit(req, 'AUDIT_CLEAR', 'audit', undefined, 'Admin cleared the audit log history.');
    res.json({ success: true, message: 'Audit logs cleared successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear audit logs' });
  }
});

export default router;
