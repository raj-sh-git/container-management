import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Trash2, Key, Shield, UserCheck, UserX, X, RefreshCw, KeyRound, ShieldAlert } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('operator');
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(true);

  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [resetMustChangePassword, setResetMustChangePassword] = useState<boolean>(true);

  const activeAdminsCount = users.filter((u) => u.role === 'admin' && Boolean(u.isActive)).length;
  const totalAdminsCount = users.filter((u) => u.role === 'admin').length;

  const isSoleActiveAdmin = (u: User) => u.role === 'admin' && activeAdminsCount <= 1;
  const isSoleTotalAdmin = (u: User) => u.role === 'admin' && totalAdminsCount <= 1;

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      alert('Email address is required.');
      return;
    }
    try {
      await usersApi.create({
        username: username.trim(),
        email: email.trim(),
        password,
        role,
        mustChangePassword,
      });
      setIsAddModalOpen(false);
      setUsername('');
      setEmail('');
      setPassword('');
      setMustChangePassword(true);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleToggleActive = async (u: User) => {
    if (u.id === currentUser?.id) {
      alert('You cannot deactivate your own account.');
      return;
    }
    if (u.role === 'admin' && u.isActive && activeAdminsCount <= 1) {
      alert('Cannot deactivate the sole Administrator. The system must always have at least one active Administrator.');
      return;
    }
    try {
      await usersApi.update(u.id, { isActive: !u.isActive });
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user status');
    }
  };

  const handleUpdateRole = async (u: User, newRole: UserRole) => {
    if (u.id === currentUser?.id) {
      alert('You cannot change your own role.');
      return;
    }
    if (u.role === 'admin' && newRole !== 'admin' && activeAdminsCount <= 1) {
      alert('Cannot change the role of the sole Administrator. The system must always have at least one active Administrator.');
      return;
    }
    try {
      await usersApi.update(u.id, { role: newRole });
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user role');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser || !newPassword) return;
    try {
      await usersApi.update(resetUser.id, {
        password: newPassword,
        mustChangePassword: resetMustChangePassword,
      });
      setResetUser(null);
      setNewPassword('');
      alert('Password updated successfully.');
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const handleDelete = async (u: User) => {
    if (u.id === currentUser?.id) {
      alert('You cannot delete your own logged-in administrator account.');
      return;
    }
    if (u.role === 'admin' && totalAdminsCount <= 1) {
      alert('Cannot delete the sole Administrator. The system must always have at least one Administrator.');
      return;
    }
    if (confirm(`Delete user '${u.username}'?`)) {
      try {
        await usersApi.delete(u.id);
        loadUsers();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to delete user');
      }
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'admin':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'operator':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Role-Based Access Control (RBAC)</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Manage platform accounts, role permissions & credentials</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadUsers}
            className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors"
            title="Refresh users"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Permissions Matrix Info */}
      <div className="p-4 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm transition-colors">
        <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">Role Permissions Matrix</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-purple-500/20 rounded-xl">
            <span className="font-bold text-purple-600 dark:text-purple-400">Admin (Superuser)</span>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">Full control over containers, images, system prune, user management & RBAC.</p>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-blue-500/20 rounded-xl">
            <span className="font-bold text-blue-600 dark:text-blue-400">Operator</span>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">Can create, start, stop, restart, exec terminal & scan containers/images.</p>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-300 dark:border-zinc-700/40 rounded-xl">
            <span className="font-bold text-zinc-700 dark:text-zinc-300">Viewer (Read-Only)</span>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">Can view containers, logs, stats & security reports (no terminal or mutations).</p>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl transition-colors">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="py-3 px-4">Username</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Force PW Reset</th>
              <th className="py-3 px-4">Created Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              const isRoleDisabled = isSelf || isSoleActiveAdmin(u);
              const isStatusDisabled = isSelf || (isSoleActiveAdmin(u) && Boolean(u.isActive));
              const isDeleteDisabled = isSelf || isSoleTotalAdmin(u);

              return (
                <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-200 font-sans text-sm">
                    <div className="flex items-center space-x-2">
                      <span>{u.username}</span>
                      {isSelf && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-normal">
                          (You)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">{u.email || '-'}</td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      disabled={isRoleDisabled}
                      title={
                        isSelf
                          ? 'You cannot change your own role'
                          : isSoleActiveAdmin(u)
                          ? 'Cannot change role of the sole Administrator (at least one Administrator must remain)'
                          : undefined
                      }
                      onChange={(e) => handleUpdateRole(u, e.target.value as UserRole)}
                      className={`text-[11px] font-bold uppercase rounded px-2 py-0.5 border ${getRoleBadge(u.role)} bg-transparent focus:outline-none ${
                        isRoleDisabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                      }`}
                    >
                      <option value="admin" className="bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400">Admin</option>
                      <option value="operator" disabled={isRoleDisabled} className="bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400">Operator</option>
                      <option value="viewer" disabled={isRoleDisabled} className="bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400">Viewer</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleToggleActive(u)}
                      disabled={isStatusDisabled}
                      title={
                        isSelf
                          ? 'You cannot deactivate your own account'
                          : isSoleActiveAdmin(u) && Boolean(u.isActive)
                          ? 'Cannot deactivate the sole Administrator'
                          : undefined
                      }
                      className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        isStatusDisabled ? 'cursor-not-allowed opacity-75 ' : ''
                      }${
                        u.isActive
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                      }`}
                    >
                      {u.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                      <span>{u.isActive ? 'Active' : 'Disabled'}</span>
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    {u.mustChangePassword ? (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold inline-flex items-center space-x-1">
                        <KeyRound className="w-3 h-3" />
                        <span>Required</span>
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500 text-[11px]">Normal</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 font-sans">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setResetUser(u)}
                        title="Reset Password"
                        className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-amber-600 dark:text-yellow-400 transition-colors"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={isDeleteDisabled}
                        title={
                          isSelf
                            ? 'You cannot delete your own logged-in account'
                            : isSoleTotalAdmin(u)
                            ? 'Cannot delete the sole Administrator'
                            : 'Delete User'
                        }
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isDeleteDisabled
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 opacity-40 cursor-not-allowed'
                            : 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 transition-colors">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Create New User Account</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. dev_john"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Initial Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Role Permission
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                >
                  <option value="operator">Operator (Container & Terminal Access)</option>
                  <option value="viewer">Viewer (Read-Only Logs & Stats)</option>
                  <option value="admin">Admin (Full Control)</option>
                </select>
              </div>

              {/* Force Reset Checkbox */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={mustChangePassword}
                    onChange={(e) => setMustChangePassword(e.target.checked)}
                    className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                      Force password reset at first login
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                      User will be required to create a new password upon logging in.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/30"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 transition-colors">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Reset Password for {resetUser.username}</h3>
              <button onClick={() => setResetUser(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  New Temporary Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Force Reset on next login Checkbox */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={resetMustChangePassword}
                    onChange={(e) => setResetMustChangePassword(e.target.checked)}
                    className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                      Require password change on next login
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                      User will be forced to change this temporary password when they sign in.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setResetUser(null)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
