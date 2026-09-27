import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const usersList = db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      role: schema.users.role,
      isActive: schema.users.isActive,
      mustChangePassword: schema.users.mustChangePassword,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt))
    .all();

  res.json(usersList);
});

// Backup / export all users (Admin only)
router.get('/backup', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allUsers = db.select().from(schema.users).all();
    await logAudit(req, 'USER_BACKUP', 'system', 'users', `Exported backup of ${allUsers.length} users.`);
    res.json({
      platform: 'Container Manager',
      version: '0.3.0',
      exportedAt: new Date().toISOString(),
      count: allUsers.length,
      users: allUsers.map((u) => ({
        username: u.username,
        email: u.email,
        role: u.role,
        isActive: Boolean(u.isActive),
        mustChangePassword: Boolean(u.mustChangePassword),
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        passwordHash: u.passwordHash,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to export user backup' });
  }
});

// Bulk import users (Admin only)
router.post('/bulk', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { users = [], overwrite = false } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      res.status(400).json({ error: 'Request body must contain a non-empty array of users.' });
      return;
    }

    const createdUsers: any[] = [];
    const skippedUsers: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const username = (u.username || '').trim();
      const email = (u.email || '').trim() || null;
      let role = (u.role || 'operator').toLowerCase();
      if (!['admin', 'operator', 'viewer'].includes(role)) {
        role = 'operator';
      }

      if (!username) {
        errors.push(`Row ${i + 1}: Missing username.`);
        continue;
      }

      const existing = db.select().from(schema.users).where(eq(schema.users.username, username)).get();
      if (existing) {
        if (!overwrite) {
          skippedUsers.push(username);
          continue;
        }
      }

      let passwordHash = u.passwordHash;
      if (!passwordHash) {
        const rawPass = u.password || 'ChangeMe123!';
        passwordHash = await bcrypt.hash(rawPass, 10);
      }

      const now = new Date().toISOString();
      const userId = existing ? existing.id : crypto.randomUUID();
      const mustChangePassword = u.mustChangePassword !== undefined ? Boolean(u.mustChangePassword) : true;
      const isActive = u.isActive !== undefined ? Boolean(u.isActive) : true;

      if (existing) {
        db.update(schema.users)
          .set({
            email,
            role: role as 'admin' | 'operator' | 'viewer',
            passwordHash,
            isActive,
            mustChangePassword,
            updatedAt: now,
          })
          .where(eq(schema.users.id, existing.id))
          .run();
        createdUsers.push({ id: existing.id, username, role, updated: true });
      } else {
        db.insert(schema.users).values({
          id: userId,
          username,
          email,
          passwordHash,
          role: role as 'admin' | 'operator' | 'viewer',
          isActive,
          mustChangePassword,
          createdAt: now,
          updatedAt: now,
        }).run();
        createdUsers.push({ id: userId, username, role, updated: false });
      }
    }

    await logAudit(
      req,
      'USER_BULK_IMPORT',
      'user',
      'bulk',
      `Imported ${createdUsers.length} users, skipped ${skippedUsers.length}, errors: ${errors.length}`
    );

    res.json({
      success: true,
      importedCount: createdUsers.length,
      skippedCount: skippedUsers.length,
      skippedUsers,
      errors,
      users: createdUsers,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Bulk import failed' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { username, email, password, role = 'operator', mustChangePassword = true } = req.body;

  if (!username || !password || !email || !email.trim()) {
    res.status(400).json({ error: 'Username, email, and password are required.' });
    return;
  }

  const existing = db.select().from(schema.users).where(eq(schema.users.username, username)).get();
  if (existing) {
    res.status(400).json({ error: 'Username already exists.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();

  db.insert(schema.users).values({
    id: userId,
    username,
    email: email || null,
    passwordHash,
    role: role as 'admin' | 'operator' | 'viewer',
    isActive: true,
    mustChangePassword: Boolean(mustChangePassword),
    createdAt: now,
    updatedAt: now,
  }).run();

  await logAudit(req, 'USER_CREATE', 'user', userId, `Admin created user '${username}' with role '${role}'.`);

  res.status(201).json({
    id: userId,
    username,
    email,
    role,
    isActive: true,
    mustChangePassword: Boolean(mustChangePassword),
    createdAt: now,
  });
});

router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { email, role, isActive, password, mustChangePassword } = req.body;

  const user = db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  // 1. Prevent an administrator from changing their own role
  if (id === req.user!.id && role !== undefined && role !== user.role) {
    res.status(400).json({ error: 'You cannot change your own role.' });
    return;
  }

  // 2. Prevent an administrator from deactivating their own account
  if (id === req.user!.id && isActive !== undefined && isActive === false) {
    res.status(400).json({ error: 'You cannot deactivate your own account.' });
    return;
  }

  // 3. Prevent demoting or deactivating the sole active administrator
  const isDemotingAdmin = user.role === 'admin' && role !== undefined && role !== 'admin';
  const isDeactivatingAdmin = user.role === 'admin' && isActive !== undefined && isActive === false;

  if (isDemotingAdmin || isDeactivatingAdmin) {
    const otherActiveAdmins = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, 'admin'))
      .all()
      .filter((u) => Boolean(u.isActive) && u.id !== id);

    if (otherActiveAdmins.length === 0) {
      res.status(400).json({
        error: 'Cannot change the role or deactivate the sole Administrator. The system must always have at least one active Administrator.',
      });
      return;
    }
  }

  const updates: Partial<typeof schema.users.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if (email !== undefined) updates.email = email;
  if (role !== undefined) updates.role = role;
  if (isActive !== undefined) updates.isActive = isActive;
  if (mustChangePassword !== undefined) updates.mustChangePassword = Boolean(mustChangePassword);
  if (password) {
    updates.passwordHash = await bcrypt.hash(password, 10);
    if (mustChangePassword === undefined) {
      updates.mustChangePassword = true; // by default when admin resets password, require change
    }
  }

  db.update(schema.users).set(updates).where(eq(schema.users.id, id)).run();

  await logAudit(req, 'USER_UPDATE', 'user', id, `Updated user '${user.username}'.`);

  res.json({ success: true, message: 'User updated successfully.' });
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  if (id === req.user!.id) {
    res.status(400).json({ error: 'You cannot delete your own logged-in admin account.' });
    return;
  }

  const user = db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  if (user.role === 'admin') {
    const otherAdmins = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, 'admin'))
      .all()
      .filter((u) => u.id !== id);

    if (otherAdmins.length === 0) {
      res.status(400).json({
        error: 'Cannot delete the sole Administrator. The system must always have at least one Administrator.',
      });
      return;
    }
  }

  db.delete(schema.users).where(eq(schema.users.id, id)).run();

  await logAudit(req, 'USER_DELETE', 'user', id, `Deleted user '${user.username}'.`);

  res.json({ success: true, message: 'User deleted.' });
});

export default router;
