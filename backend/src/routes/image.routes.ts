import { Router, Response } from 'express';
import { dockerService } from '../services/docker.service';
import { authenticateToken, requireOperator, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();
router.use(authenticateToken);

// List images
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const all = req.query.all === 'true';
    const images = await dockerService.listImages(all);
    res.json(images);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list images' });
  }
});

// Inspect image
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const image = await dockerService.inspectImage(id);
    res.json(image);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Image not found' });
  }
});

// Image history layers
router.get('/:id/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const history = await dockerService.getImageHistory(id);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get image history' });
  }
});

// Pull image (supports public & private registries)
router.post('/pull', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { image, auth } = req.body;
  if (!image) {
    res.status(400).json({ error: 'Image name is required.' });
    return;
  }

  try {
    await dockerService.pullImage(image, auth);
    await logAudit(req, 'IMAGE_PULL', 'image', undefined, `Pulled image '${image}' ${auth?.username ? `(Auth: ${auth.username})` : ''}`);
    res.json({ success: true, message: `Successfully pulled ${image}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to pull image' });
  }
});

// Tag image
router.post('/:id/tag', requireOperator, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { repo, tag = 'latest' } = req.body;
  if (!repo) {
    res.status(400).json({ error: 'Repository name is required.' });
    return;
  }

  try {
    const result = await dockerService.tagImage(id, repo, tag);
    await logAudit(req, 'IMAGE_TAG', 'image', id, `Tagged as ${repo}:${tag}`);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to tag image' });
  }
});

// Remove image
router.delete('/:id', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const force = req.query.force === 'true';
    const result = await dockerService.removeImage(id, force);
    await logAudit(req, 'IMAGE_DELETE', 'image', id, `Force: ${force}`);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete image' });
  }
});

export default router;
