import { db } from '../db';
import * as schema from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { dockerService } from './docker.service';

export interface CreateScalingPolicyInput {
  name: string;
  targetType?: 'container' | 'stack';
  targetId: string;
  enabled?: boolean;
  minReplicas?: number;
  maxReplicas?: number;
  cpuThreshold?: number;
  memoryThreshold?: number;
  cooldownSeconds?: number;
}

export class AutoscalerService {
  private timer: NodeJS.Timeout | null = null;
  private isChecking = false;

  init() {
    if (this.timer) clearInterval(this.timer);
    // Poll metrics and evaluate autoscaling policies every 15 seconds
    this.timer = setInterval(() => {
      this.evaluatePolicies().catch((err) => {
        console.error('[Autoscaler] Evaluation error:', err.message);
      });
    }, 15000);
    console.log('[Autoscaler] Engine initialized with 15s evaluation cycle.');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  listPolicies() {
    return db
      .select()
      .from(schema.scalingPolicies)
      .orderBy(desc(schema.scalingPolicies.createdAt))
      .all();
  }

  getPolicy(id: string) {
    return db
      .select()
      .from(schema.scalingPolicies)
      .where(eq(schema.scalingPolicies.id, id))
      .get();
  }

  getPolicyForTarget(targetId: string) {
    return db
      .select()
      .from(schema.scalingPolicies)
      .where(eq(schema.scalingPolicies.targetId, targetId))
      .get();
  }

  createPolicy(data: CreateScalingPolicyInput, createdBy: string) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const minReplicas = Math.max(1, data.minReplicas || 1);
    const maxReplicas = Math.max(minReplicas, data.maxReplicas || 3);

    const record = {
      id,
      name: data.name.trim() || `Autoscale ${data.targetId}`,
      targetType: (data.targetType || 'container') as 'container' | 'stack',
      targetId: data.targetId.trim(),
      enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
      minReplicas,
      maxReplicas,
      currentReplicas: minReplicas,
      cpuThreshold: Math.min(100, Math.max(10, data.cpuThreshold ?? 80)),
      memoryThreshold: Math.min(100, Math.max(10, data.memoryThreshold ?? 85)),
      cooldownSeconds: Math.max(15, data.cooldownSeconds ?? 60),
      lastScaleAt: null,
      lastScaleAction: 'INITIAL',
      lastScaleReason: 'Policy created',
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(schema.scalingPolicies).values(record).run();
    return record;
  }

  updatePolicy(id: string, data: Partial<CreateScalingPolicyInput>) {
    const existing = this.getPolicy(id);
    if (!existing) throw new Error('Policy not found');

    const now = new Date().toISOString();
    const minReplicas = data.minReplicas !== undefined ? Math.max(1, data.minReplicas) : existing.minReplicas;
    const maxReplicas = data.maxReplicas !== undefined ? Math.max(minReplicas, data.maxReplicas) : existing.maxReplicas;

    const updates: any = {
      updatedAt: now,
    };

    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.targetId !== undefined) updates.targetId = data.targetId.trim();
    if (data.enabled !== undefined) updates.enabled = Boolean(data.enabled);
    if (data.minReplicas !== undefined) updates.minReplicas = minReplicas;
    if (data.maxReplicas !== undefined) updates.maxReplicas = maxReplicas;
    if (data.cpuThreshold !== undefined) updates.cpuThreshold = Math.min(100, Math.max(10, data.cpuThreshold));
    if (data.memoryThreshold !== undefined) updates.memoryThreshold = Math.min(100, Math.max(10, data.memoryThreshold));
    if (data.cooldownSeconds !== undefined) updates.cooldownSeconds = Math.max(15, data.cooldownSeconds);

    db.update(schema.scalingPolicies).set(updates).where(eq(schema.scalingPolicies.id, id)).run();
    return this.getPolicy(id);
  }

  togglePolicy(id: string) {
    const existing = this.getPolicy(id);
    if (!existing) throw new Error('Policy not found');

    const newEnabled = !existing.enabled;
    const now = new Date().toISOString();

    db.update(schema.scalingPolicies)
      .set({ enabled: newEnabled, updatedAt: now })
      .where(eq(schema.scalingPolicies.id, id))
      .run();

    return this.getPolicy(id);
  }

  deletePolicy(id: string) {
    const existing = this.getPolicy(id);
    if (!existing) throw new Error('Policy not found');

    db.delete(schema.scalingPolicies).where(eq(schema.scalingPolicies.id, id)).run();
    return { success: true, message: `Policy '${existing.name}' deleted.` };
  }

  async evaluatePolicies() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const policies = db
        .select()
        .from(schema.scalingPolicies)
        .where(eq(schema.scalingPolicies.enabled, true))
        .all();

      for (const policy of policies) {
        try {
          await this.evaluateSinglePolicy(policy);
        } catch (err: any) {
          console.error(`[Autoscaler] Error evaluating policy '${policy.name}':`, err.message);
        }
      }
    } finally {
      this.isChecking = false;
    }
  }

  private async evaluateSinglePolicy(policy: typeof schema.scalingPolicies.$inferSelect) {
    // 1. Get current scaling info and active replicas
    let info: any;
    try {
      info = await dockerService.getScalingEligibility(policy.targetId);
    } catch {
      // Container not found or stopped
      return;
    }

    const runningReplicas = info.replicas.filter((r: any) => r.state === 'running');
    if (runningReplicas.length === 0) return;

    // 2. Measure metrics across all active running replicas
    let totalCpu = 0;
    let totalMem = 0;
    let sampleCount = 0;

    for (const r of runningReplicas) {
      const metrics = await dockerService.getContainerMetricsQuick(r.id);
      totalCpu += metrics.cpuPercent;
      totalMem += metrics.memPercent;
      sampleCount++;
    }

    if (sampleCount === 0) return;

    const avgCpu = Math.round((totalCpu / sampleCount) * 10) / 10;
    const avgMem = Math.round((totalMem / sampleCount) * 10) / 10;
    const currentReplicas = info.currentReplicas;

    // Synchronize policy's current_replicas with actual Docker state if mismatched
    if (policy.currentReplicas !== currentReplicas) {
      db.update(schema.scalingPolicies)
        .set({ currentReplicas, updatedAt: new Date().toISOString() })
        .where(eq(schema.scalingPolicies.id, policy.id))
        .run();
    }

    // 3. Check cooldown
    const now = Date.now();
    const lastScaleTime = policy.lastScaleAt ? new Date(policy.lastScaleAt).getTime() : 0;
    const cooldownMs = (policy.cooldownSeconds || 60) * 1000;

    if (now - lastScaleTime < cooldownMs) {
      // Within cooldown period, skip scaling action
      return;
    }

    // 4. Evaluate Scale UP
    if (avgCpu >= policy.cpuThreshold || avgMem >= policy.memoryThreshold) {
      if (currentReplicas < policy.maxReplicas) {
        const nextReplicas = currentReplicas + 1;
        const triggerReason = avgCpu >= policy.cpuThreshold
          ? `High CPU load (${avgCpu}% >= threshold ${policy.cpuThreshold}%)`
          : `High Memory usage (${avgMem}% >= threshold ${policy.memoryThreshold}%)`;

        console.log(`[Autoscaler] Scale UP triggered for '${policy.targetId}': ${triggerReason}. Scaling from ${currentReplicas} -> ${nextReplicas}`);

        await dockerService.scaleContainer(policy.targetId, nextReplicas);

        const isoNow = new Date().toISOString();
        db.update(schema.scalingPolicies)
          .set({
            currentReplicas: nextReplicas,
            lastScaleAt: isoNow,
            lastScaleAction: 'SCALE_UP',
            lastScaleReason: triggerReason,
            updatedAt: isoNow,
          })
          .where(eq(schema.scalingPolicies.id, policy.id))
          .run();

        // Audit log
        db.insert(schema.auditLogs)
          .values({
            id: crypto.randomUUID(),
            username: 'AUTOSCALER',
            action: 'AUTOSCALE_UP',
            resourceType: 'container',
            resourceId: policy.targetId,
            details: `Autoscaled UP from ${currentReplicas} to ${nextReplicas} replicas. Reason: ${triggerReason}`,
            createdAt: isoNow,
          })
          .run();
      }
    }
    // 5. Evaluate Scale DOWN (CPU < threshold/2 and Mem < threshold/2)
    else if (avgCpu < (policy.cpuThreshold / 2) && avgMem < (policy.memoryThreshold / 2)) {
      if (currentReplicas > policy.minReplicas) {
        const nextReplicas = currentReplicas - 1;
        const triggerReason = `Low resource utilization (CPU: ${avgCpu}%, Mem: ${avgMem}%). Below half threshold.`;

        console.log(`[Autoscaler] Scale DOWN triggered for '${policy.targetId}': ${triggerReason}. Scaling from ${currentReplicas} -> ${nextReplicas}`);

        await dockerService.scaleContainer(policy.targetId, nextReplicas);

        const isoNow = new Date().toISOString();
        db.update(schema.scalingPolicies)
          .set({
            currentReplicas: nextReplicas,
            lastScaleAt: isoNow,
            lastScaleAction: 'SCALE_DOWN',
            lastScaleReason: triggerReason,
            updatedAt: isoNow,
          })
          .where(eq(schema.scalingPolicies.id, policy.id))
          .run();

        // Audit log
        db.insert(schema.auditLogs)
          .values({
            id: crypto.randomUUID(),
            username: 'AUTOSCALER',
            action: 'AUTOSCALE_DOWN',
            resourceType: 'container',
            resourceId: policy.targetId,
            details: `Autoscaled DOWN from ${currentReplicas} to ${nextReplicas} replicas. Reason: ${triggerReason}`,
            createdAt: isoNow,
          })
          .run();
      }
    }
  }
}

export const autoscalerService = new AutoscalerService();
