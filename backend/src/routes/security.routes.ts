import { Router, Response } from 'express';
import { scannerService } from '../services/scanner.service';
import { authenticateToken, requireOperator, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();
router.use(authenticateToken);

// List all historical scan reports
router.get('/reports', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reports = await scannerService.listReports();
    res.json(reports);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list reports' });
  }
});

// Get single report JSON data
router.get('/reports/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const report = await scannerService.getReport(id);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch report' });
  }
});

// Download / View generated HTML report
router.get('/reports/:id/html', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const sortBy = (req.query.sortBy as string) || 'severity';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const html = await scannerService.getReportHtml(id, sortBy, sortOrder);
    if (!html) {
      res.status(404).json({ error: 'HTML report not found' });
      return;
    }
    
    // Set content type for HTML preview or download
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (req.query.download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="trivy-report-${id}.html"`);
    }
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch HTML report' });
  }
});

// Trigger a new security scan
router.post('/scan', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { targetType, targetName, targetId } = req.body;

  if (!targetType || !targetName) {
    res.status(400).json({ error: 'targetType (image/container) and targetName are required.' });
    return;
  }

  try {
    const reportId = await scannerService.startScan(
      targetType,
      targetName,
      targetId,
      req.user?.username || 'admin'
    );

    await logAudit(
      req,
      'SECURITY_SCAN_TRIGGERED',
      targetType,
      targetId || targetName,
      `Triggered Trivy scan for ${targetType} '${targetName}'`
    );

    res.status(202).json({
      success: true,
      reportId,
      message: `Security scan initiated for ${targetName}.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to start scan' });
  }
});

// Delete a report
router.delete('/reports/:id', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const success = await scannerService.deleteReport(id);
    if (!success) {
      res.status(404).json({ error: 'Report not found or could not be deleted' });
      return;
    }
    await logAudit(req, 'REPORT_DELETE', 'report', id);
    res.json({ success: true, message: 'Report deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete report' });
  }
});

// Download multiple reports in a single ZIP archive
router.post('/reports/batch-download', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required.' });
      return;
    }
    const zipBuffer = await scannerService.createReportsZip(ids);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="trivy-reports-${Date.now()}.zip"`);
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate reports zip' });
  }
});

// Delete multiple reports in batch
router.post('/reports/batch-delete', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required.' });
      return;
    }
    let count = 0;
    for (const id of ids) {
      const success = await scannerService.deleteReport(id);
      if (success) {
        count++;
        await logAudit(req, 'REPORT_DELETE', 'report', id);
      }
    }
    res.json({ success: true, count, message: `Deleted ${count} reports` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete reports' });
  }
});

export default router;
