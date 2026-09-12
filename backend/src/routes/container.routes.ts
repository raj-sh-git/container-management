import { Router, Response } from 'express';
import { dockerService } from '../services/docker.service';
import { authenticateToken, requireOperator, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();
router.use(authenticateToken);

// List containers
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const all = req.query.all !== 'false';
    const containers = await dockerService.listContainers(all);
    res.json(containers);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list containers' });
  }
});

// List compose stacks
router.get('/stacks', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stacks = await dockerService.listStacks();
    res.json(stacks);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list stacks' });
  }
});

// Stack control: Start
router.post('/stacks/:name/start', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = req.params.name as string;
    const result = await dockerService.startStack(name);
    await logAudit(req, 'STACK_START', 'stack', name);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to start stack' });
  }
});

// Stack control: Stop
router.post('/stacks/:name/stop', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = req.params.name as string;
    const result = await dockerService.stopStack(name);
    await logAudit(req, 'STACK_STOP', 'stack', name);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to stop stack' });
  }
});

// Stack control: Restart
router.post('/stacks/:name/restart', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = req.params.name as string;
    const result = await dockerService.restartStack(name);
    await logAudit(req, 'STACK_RESTART', 'stack', name);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to restart stack' });
  }
});

// Inspect container
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const container = await dockerService.getContainer(id);
    res.json(container);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Container not found' });
  }
});

// Container logs snapshot
router.get('/:id/logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const tail = req.query.tail ? parseInt(req.query.tail as string, 10) : 200;
    const timestamps = req.query.timestamps !== 'false';
    const logs = await dockerService.getContainerLogs(id, tail, timestamps);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch logs' });
  }
});

// Container filesystem changes
router.get('/:id/changes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const changes = await dockerService.getContainerChanges(id);
    res.json(changes);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch container changes' });
  }
});

// Create & run container
router.post('/', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const container = await dockerService.createContainer(req.body);
    await logAudit(req, 'CONTAINER_CREATE', 'container', container.Id, `Created container '${container.Name}'`);
    res.status(201).json(container);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create container' });
  }
});

// Start container
router.post('/:id/start', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await dockerService.startContainer(id);
    await logAudit(req, 'CONTAINER_START', 'container', id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to start container' });
  }
});

// Stop container (Protected against self)
router.post('/:id/stop', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const timeout = req.body.timeout ? parseInt(req.body.timeout, 10) : 10;
    const allowSelf = req.body.allowSelf === true;
    const result = await dockerService.stopContainer(id, timeout, allowSelf);
    await logAudit(req, 'CONTAINER_STOP', 'container', id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to stop container' });
  }
});

// Restart container (Protected against self)
router.post('/:id/restart', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const timeout = req.body.timeout ? parseInt(req.body.timeout, 10) : 10;
    const allowSelf = req.body.allowSelf === true;
    const result = await dockerService.restartContainer(id, timeout, allowSelf);
    await logAudit(req, 'CONTAINER_RESTART', 'container', id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to restart container' });
  }
});

// Pause container
router.post('/:id/pause', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const result = await dockerService.pauseContainer(id);
    await logAudit(req, 'CONTAINER_PAUSE', 'container', id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to pause container' });
  }
});

// Unpause container
router.post('/:id/unpause', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await dockerService.unpauseContainer(id);
    await logAudit(req, 'CONTAINER_UNPAUSE', 'container', id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to unpause container' });
  }
});

// Kill container
router.post('/:id/kill', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const result = await dockerService.killContainer(id);
    await logAudit(req, 'CONTAINER_KILL', 'container', id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to kill container' });
  }
});

// Rename container
router.post('/:id/rename', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'New name is required.' });
      return;
    }
    const result = await dockerService.renameContainer(id, name);
    await logAudit(req, 'CONTAINER_RENAME', 'container', id, `Renamed to ${name}`);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to rename container' });
  }
});

// Delete container (Protected against self)
router.delete('/:id', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const force = req.query.force === 'true';
    const removeVolumes = req.query.v === 'true';
    const result = await dockerService.removeContainer(id, force, removeVolumes);
    await logAudit(req, 'CONTAINER_DELETE', 'container', id, `Force: ${force}, Volumes: ${removeVolumes}`);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to remove container' });
  }
});

export default router;
