import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  canAccessSsh?: boolean;
  canAccessExec?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : (req.query.token as string);

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Token missing.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUser;
    
    // Check if user is still active in DB
    const user = db.select().from(schema.users).where(eq(schema.users.id, decoded.id)).get();
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User account is inactive or not found.' });
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role as 'admin' | 'operator' | 'viewer',
      canAccessSsh: user.role === 'admin' ? true : Boolean(user.canAccessSsh),
      canAccessExec: user.role === 'admin' ? true : Boolean(user.canAccessExec),
    };
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

export function requireRole(...allowedRoles: Array<'admin' | 'operator' | 'viewer'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    if (allowedRoles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ 
        error: `Permission denied. Role '${req.user.role}' is not authorized for this operation.` 
      });
    }
  };
}

export const requireAdmin = requireRole('admin');
export const requireOperator = requireRole('admin', 'operator');
export const requireViewer = requireRole('admin', 'operator', 'viewer');
