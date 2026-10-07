import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  const user = db.select().from(schema.users).where(eq(schema.users.username, username)).get();

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid credentials or account is disabled.' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      canAccessSsh: user.role === 'admin' ? true : Boolean(user.canAccessSsh),
      canAccessExec: user.role === 'admin' ? true : Boolean(user.canAccessExec),
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  await logAudit(
    { user: { id: user.id, username: user.username, role: user.role as any }, ip: req.ip, headers: req.headers, socket: req.socket } as any,
    'USER_LOGIN',
    'user',
    user.id,
    `User ${user.username} logged in successfully.`
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      canAccessSsh: user.role === 'admin' ? true : Boolean(user.canAccessSsh),
      canAccessExec: user.role === 'admin' ? true : Boolean(user.canAccessExec),
      mustChangePassword: Boolean(user.mustChangePassword),
    },
  });
});

router.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.user!.id)).get();
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    canAccessSsh: user.role === 'admin' ? true : Boolean(user.canAccessSsh),
    canAccessExec: user.role === 'admin' ? true : Boolean(user.canAccessExec),
    mustChangePassword: Boolean(user.mustChangePassword),
  });
});

router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current and new passwords are required.' });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    return;
  }

  const user = db.select().from(schema.users).where(eq(schema.users.id, req.user!.id)).get();
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: 'Incorrect current password.' });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  db.update(schema.users)
    .set({
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.users.id, user.id))
    .run();

  await logAudit(req, 'PASSWORD_CHANGE', 'user', user.id, 'User changed password and cleared force change flag.');

  res.json({
    success: true,
    message: 'Password updated successfully.',
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      mustChangePassword: false,
    },
  });
});

export default router;
