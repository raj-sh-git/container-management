import { Router, Response } from 'express';
import { dockerService } from '../services/docker.service';
import { authenticateToken, requireOperator, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();
router.use(authenticateToken);

// List networks
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const networks = await dockerService.listNetworks();
    res.json(networks);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list networks' });
  }
});

// Inspect network
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const network = await dockerService.inspectNetwork(id);
    res.json(network);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Network not found' });
  }
});

// Create network
router.post('/', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const network = await dockerService.createNetwork(req.body);
    await logAudit(req, 'NETWORK_CREATE', 'network', network.id, `Created network '${req.body.name}'`);
    res.status(201).json(network);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create network' });
  }
});

// Delete network
router.delete('/:id', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await dockerService.removeNetwork(id);
    await logAudit(req, 'NETWORK_DELETE', 'network', id);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete network' });
  }
});

// Connect container to network
router.post('/:id/connect', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { containerId } = req.body;
  if (!containerId) {
    res.status(400).json({ error: 'Container ID is required.' });
    return;
  }
  try {
    await dockerService.connectNetwork(id, containerId);
    await logAudit(req, 'NETWORK_CONNECT', 'network', id, `Connected container '${containerId}'`);
    res.json({ success: true, message: 'Connected container to network.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to connect container' });
  }
});

// Disconnect container from network
router.post('/:id/disconnect', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { containerId, force = false } = req.body;
  if (!containerId) {
    res.status(400).json({ error: 'Container ID is required.' });
    return;
  }
  try {
    await dockerService.disconnectNetwork(id, containerId, force);
    await logAudit(req, 'NETWORK_DISCONNECT', 'network', id, `Disconnected container '${containerId}'`);
    res.json({ success: true, message: 'Disconnected container from network.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to disconnect container' });
  }
});

export default router;
