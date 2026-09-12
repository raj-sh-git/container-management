import crypto from 'crypto';
import { db } from '../db';
import * as schema from '../db/schema';
import { AuthenticatedRequest } from './auth';

export async function logAudit(
  req: AuthenticatedRequest,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: string
) {
  try {
    const userId = req.user?.id || 'system';
    const username = req.user?.username || 'anonymous';
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

    db.insert(schema.auditLogs).values({
      id: crypto.randomUUID(),
      userId,
      username,
      action,
      resourceType,
      resourceId: resourceId || null,
      details: details || null,
      ipAddress: ipAddress || null,
      createdAt: new Date().toISOString(),
    }).run();
  } catch (err) {
    console.error('[Audit] Failed to record audit log:', err);
  }
}
