import { Router, Response } from 'express';
import { dockerService } from '../services/docker.service';
import { authenticateToken, requireOperator, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();
router.use(authenticateToken);

// List volumes
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const volumes = await dockerService.listVolumes();
    const visibleVolumes = req.user?.role === 'admin'
      ? volumes
      : volumes.filter((v: any) => !v.isSelf);
    res.json(visibleVolumes);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list volumes' });
  }
});

// Inspect volume
router.get('/:name', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = req.params.name as string;
    const volume = await dockerService.inspectVolume(name);
    res.json(volume);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Volume not found' });
  }
});

// Create volume
router.post('/', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const volume = await dockerService.createVolume(req.body);
    await logAudit(req, 'VOLUME_CREATE', 'volume', volume.Name);
    res.status(201).json(volume);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create volume' });
  }
});

// Delete volume
router.delete('/:name', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = req.params.name as string;
    const force = req.query.force === 'true';
    const result = await dockerService.removeVolume(name, force);
    await logAudit(req, 'VOLUME_DELETE', 'volume', name);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to remove volume' });
  }
});

export default router;
