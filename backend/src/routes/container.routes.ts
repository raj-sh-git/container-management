import { Router, Response } from 'express';
import { dockerService } from '../services/docker.service';
import { authenticateToken, requireOperator, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, or } from 'drizzle-orm';

const router = Router();
router.use(authenticateToken);

// Helper to check if container is protected or self
async function checkContainerProtection(id: string): Promise<{ isSelf: boolean; isProtected: boolean; isHidden: boolean; name: string }> {
  try {
    const container = await dockerService.getContainer(id);
    const flag = db.select().from(schema.containerFlags).where(
      or(
        eq(schema.containerFlags.containerId, container.Id),
        eq(schema.containerFlags.containerId, container.Id.substring(0, 12)),
        eq(schema.containerFlags.containerName, container.Name.replace(/^\//, ''))
      )
    ).get();

    return {
      isSelf: Boolean(container.isSelf),
      isProtected: Boolean(flag?.isProtected),
      isHidden: Boolean(flag?.isHidden),
      name: container.Name?.replace(/^\//, '') || id,
    };
  } catch {
    return { isSelf: false, isProtected: false, isHidden: false, name: id };
  }
}

// List containers
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const all = req.query.all !== 'false';
    const containers = await dockerService.listContainers(all);

    // Fetch flags from DB
    const flagsList = db.select().from(schema.containerFlags).all();
    const flagMap = new Map<string, { isHidden: boolean; isProtected: boolean }>();
    for (const f of flagsList) {
      if (f.containerId) flagMap.set(f.containerId, f);
      if (f.containerName) flagMap.set(f.containerName, f);
    }

    const isAdmin = req.user?.role === 'admin';
    const enriched = containers.map((c) => {
      const flag = flagMap.get(c.id) || flagMap.get(c.shortId) || flagMap.get(c.name);
      return {
        ...c,
        isHidden: flag ? Boolean(flag.isHidden) : false,
        isProtected: flag ? Boolean(flag.isProtected) : false,
      };
    });

    if (isAdmin) {
      res.json(enriched);
    } else {
      // Non-admin: hide self container and any containers marked hidden
      res.json(enriched.filter((c) => !c.isSelf && !c.isHidden));
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list containers' });
  }
});

// List compose stacks
router.get('/stacks', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stacks = await dockerService.listStacks();

    // Fetch flags from DB
    const flagsList = db.select().from(schema.containerFlags).all();
    const flagMap = new Map<string, { isHidden: boolean; isProtected: boolean }>();
    for (const f of flagsList) {
      if (f.containerId) flagMap.set(f.containerId, f);
      if (f.containerName) flagMap.set(f.containerName, f);
    }

    const isAdmin = req.user?.role === 'admin';
    const enrichedStacks = stacks.map((st) => {
      const enrichedContainers = st.containers.map((c) => {
        const flag = flagMap.get(c.id) || flagMap.get(c.shortId) || flagMap.get(c.name);
        return {
          ...c,
          isHidden: flag ? Boolean(flag.isHidden) : false,
          isProtected: flag ? Boolean(flag.isProtected) : false,
        };
      });
      return {
        ...st,
        containers: enrichedContainers,
      };
    });

    if (isAdmin) {
      res.json(enrichedStacks);
    } else {
      // Filter out self stacks or stacks where all containers are hidden
      const filtered = enrichedStacks
        .filter((st) => !st.isSelf)
        .map((st) => {
          const visibleContainers = st.containers.filter((c) => !c.isSelf && !c.isHidden);
          return {
            ...st,
            containers: visibleContainers,
            runningCount: visibleContainers.filter((c) => c.state === 'running').length,
            totalCount: visibleContainers.length,
          };
        })
        .filter((st) => st.containers.length > 0);

      res.json(filtered);
    }
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
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const container = await dockerService.getContainer(id);
    const flag = db.select().from(schema.containerFlags).where(
      or(
        eq(schema.containerFlags.containerId, container.Id),
        eq(schema.containerFlags.containerId, container.Id.substring(0, 12)),
        eq(schema.containerFlags.containerName, container.Name.replace(/^\//, ''))
      )
    ).get();

    const isHidden = flag ? Boolean(flag.isHidden) : false;
    const isProtected = flag ? Boolean(flag.isProtected) : false;

    if (req.user?.role !== 'admin' && (container.isSelf || isHidden)) {
      res.status(404).json({ error: 'Container not found' });
      return;
    }

    res.json({
      ...container,
      isHidden,
      isProtected,
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Container not found' });
  }
});

// Update container flags (Hidden / Protected) - Admin only
router.patch('/:id/flags', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { isHidden, isProtected } = req.body;

    const container = await dockerService.getContainer(id).catch(() => null);
    const containerId = container?.Id || id;
    const containerName = container?.Name?.replace(/^\//, '') || id;

    const existing = db.select().from(schema.containerFlags).where(
      or(
        eq(schema.containerFlags.containerId, containerId),
        eq(schema.containerFlags.containerId, containerId.substring(0, 12)),
        eq(schema.containerFlags.containerName, containerName)
      )
    ).get();

    const now = new Date().toISOString();
    const newHidden = typeof isHidden === 'boolean' ? isHidden : (existing ? Boolean(existing.isHidden) : false);
    const newProtected = typeof isProtected === 'boolean' ? isProtected : (existing ? Boolean(existing.isProtected) : false);

    if (existing) {
      db.update(schema.containerFlags)
        .set({
          isHidden: newHidden,
          isProtected: newProtected,
          updatedAt: now,
          updatedBy: req.user?.username || 'admin',
        })
        .where(eq(schema.containerFlags.containerId, existing.containerId))
        .run();
    } else {
      db.insert(schema.containerFlags).values({
        containerId,
        containerName,
        isHidden: newHidden,
        isProtected: newProtected,
        updatedAt: now,
        updatedBy: req.user?.username || 'admin',
      }).run();
    }

    await logAudit(
      req,
      'CONTAINER_FLAGS_UPDATE',
      'container',
      id,
      `Updated flags for '${containerName}': isHidden=${newHidden}, isProtected=${newProtected}`
    );

    res.json({
      success: true,
      containerId,
      isHidden: newHidden,
      isProtected: newProtected,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update container flags' });
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
router.post('/:id/start', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (req.user?.role !== 'admin') {
      const { isSelf, isHidden } = await checkContainerProtection(id);
      if (isSelf || isHidden) {
        res.status(403).json({ error: 'Permission denied for this container.' });
        return;
      }
    }
    const result = await dockerService.startContainer(id);
    await logAudit(req, 'CONTAINER_START', 'container', id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to start container' });
  }
});

// Stop container (Protected against self & protected containers)
router.post('/:id/stop', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const timeout = req.body.timeout ? parseInt(req.body.timeout, 10) : 10;
    const allowSelf = req.body.allowSelf === true;

    if (req.user?.role !== 'admin') {
      const { isSelf, isProtected } = await checkContainerProtection(id);
      if (isSelf || isProtected) {
        res.status(403).json({ error: 'This container is protected against modification or termination.' });
        return;
      }
    }

    const result = await dockerService.stopContainer(id, timeout, allowSelf);
    await logAudit(req, 'CONTAINER_STOP', 'container', id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to stop container' });
  }
});

// Restart container (Protected against self & protected containers)
router.post('/:id/restart', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const timeout = req.body.timeout ? parseInt(req.body.timeout, 10) : 10;
    const allowSelf = req.body.allowSelf === true;

    if (req.user?.role !== 'admin') {
      const { isSelf, isProtected } = await checkContainerProtection(id);
      if (isSelf || isProtected) {
        res.status(403).json({ error: 'This container is protected against modification or termination.' });
        return;
      }
    }

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
    if (req.user?.role !== 'admin') {
      const { isSelf, isProtected } = await checkContainerProtection(id);
      if (isSelf || isProtected) {
        res.status(403).json({ error: 'This container is protected against modification or termination.' });
        return;
      }
    }
    const result = await dockerService.pauseContainer(id);
    await logAudit(req, 'CONTAINER_PAUSE', 'container', id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to pause container' });
  }
});

// Unpause container
router.post('/:id/unpause', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (req.user?.role !== 'admin') {
      const { isSelf, isProtected } = await checkContainerProtection(id);
      if (isSelf || isProtected) {
        res.status(403).json({ error: 'This container is protected against modification or termination.' });
        return;
      }
    }
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
    if (req.user?.role !== 'admin') {
      const { isSelf, isProtected } = await checkContainerProtection(id);
      if (isSelf || isProtected) {
        res.status(403).json({ error: 'This container is protected against modification or termination.' });
        return;
      }
    }
    const result = await dockerService.killContainer(id);
    await logAudit(req, 'CONTAINER_KILL', 'container', id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to kill container' });
  }
});

// Rename container
router.post('/:id/rename', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (req.user?.role !== 'admin') {
      const { isSelf, isProtected } = await checkContainerProtection(id);
      if (isSelf || isProtected) {
        res.status(403).json({ error: 'This container is protected against modification or termination.' });
        return;
      }
    }
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

// Delete container (Protected against self & protected containers)
router.delete('/:id', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (req.user?.role !== 'admin') {
      const { isSelf, isProtected } = await checkContainerProtection(id);
      if (isSelf || isProtected) {
        res.status(403).json({ error: 'This container is protected against deletion.' });
        return;
      }
    }
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
