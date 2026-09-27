import { Router, Response } from 'express';
import { authenticateToken, requireOperator, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';
import { dockerService } from '../services/docker.service';
import { autoscalerService } from '../services/autoscaler.service';

const router = Router();
router.use(authenticateToken);

// 1. Get scaling eligibility, port status and current replicas
router.get('/info/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const info = await dockerService.getScalingEligibility(id);
    const policy = autoscalerService.getPolicyForTarget(info.baseName);
    res.json({
      ...info,
      policy: policy || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to inspect container scaling eligibility' });
  }
});

// 2. Manual scaling endpoint (Operator only)
router.post('/scale', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetId, targetReplicas } = req.body;
    if (!targetId) {
      return res.status(400).json({ error: 'targetId is required.' });
    }
    const replicas = parseInt(targetReplicas, 10);
    if (isNaN(replicas) || replicas < 1 || replicas > 20) {
      return res.status(400).json({ error: 'targetReplicas must be an integer between 1 and 20.' });
    }

    const result = await dockerService.scaleContainer(targetId, replicas);

    await logAudit(
      req,
      'CONTAINER_SCALE_MANUAL',
      'container',
      targetId,
      `Scaled '${result.baseName}' to ${replicas} replicas (action: ${result.action})`
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to scale container' });
  }
});

// 3. List all autoscaling policies
router.get('/policies', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const policies = autoscalerService.listPolicies();
    res.json(policies);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list autoscaling policies' });
  }
});

// 4. Get policy for target container
router.get('/policies/target/:targetId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetId = req.params.targetId as string;
    const policy = autoscalerService.getPolicyForTarget(targetId);
    res.json(policy || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get policy' });
  }
});

// 5. Create autoscaling policy (Operator only)
router.post('/policies', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const policy = autoscalerService.createPolicy(req.body, req.user?.username || 'operator');
    await logAudit(
      req,
      'AUTOSCALE_POLICY_CREATE',
      'system',
      policy.id,
      `Created autoscaling policy '${policy.name}' for target '${policy.targetId}' (min: ${policy.minReplicas}, max: ${policy.maxReplicas}, CPU: ${policy.cpuThreshold}%, Mem: ${policy.memoryThreshold}%)`
    );
    res.status(201).json(policy);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create autoscaling policy' });
  }
});

// 6. Update autoscaling policy (Operator only)
router.put('/policies/:id', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const policy = autoscalerService.updatePolicy(id, req.body);
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    await logAudit(
      req,
      'AUTOSCALE_POLICY_UPDATE',
      'system',
      id,
      `Updated autoscaling policy '${policy.name}' (min: ${policy.minReplicas}, max: ${policy.maxReplicas}, CPU: ${policy.cpuThreshold}%)`
    );
    res.json(policy);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update autoscaling policy' });
  }
});

// 7. Toggle policy active status (Operator only)
router.patch('/policies/:id/toggle', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const policy = autoscalerService.togglePolicy(id);
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    await logAudit(
      req,
      'AUTOSCALE_POLICY_TOGGLE',
      'system',
      id,
      `${policy.enabled ? 'Enabled' : 'Disabled'} autoscaling policy '${policy.name}'`
    );
    res.json(policy);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to toggle autoscaling policy' });
  }
});

// 8. Delete autoscaling policy (Operator only)
router.delete('/policies/:id', requireOperator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = autoscalerService.deletePolicy(id);
    await logAudit(req, 'AUTOSCALE_POLICY_DELETE', 'system', id, `Deleted autoscaling policy`);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete autoscaling policy' });
  }
});

export default router;
