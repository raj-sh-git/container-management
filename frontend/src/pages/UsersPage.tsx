import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, UserRole } from '../types';
import { usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Plus,
  Trash2,
  Key,
  Shield,
  UserCheck,
  UserX,
  X,
  RefreshCw,
  KeyRound,
  ShieldAlert,
  Download,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Maximize2,
  Minimize2,
  Loader2,
  Database,
  FileSpreadsheet,
} from 'lucide-react';

interface PreviewUser {
  id?: string;
  username: string;
  email: string;
  role: UserRole;
  password?: string;
  passwordHash?: string;
  mustChangePassword: boolean;
  status: 'valid' | 'duplicate' | 'error';
  statusMessage: string;
  selected: boolean;
}

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add Single User Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isAddMinimized, setIsAddMinimized] = useState<boolean>(false);
  const [isAddMaximized, setIsAddMaximized] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('operator');
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(true);

  // Password Reset Modal
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [isResetMinimized, setIsResetMinimized] = useState<boolean>(false);
  const [isResetMaximized, setIsResetMaximized] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [resetMustChangePassword, setResetMustChangePassword] = useState<boolean>(true);

  // Bulk Import Modal & Preview
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [isBulkMinimized, setIsBulkMinimized] = useState<boolean>(false);
  const [isBulkMaximized, setIsBulkMaximized] = useState<boolean>(false);
  const [previewUsers, setPreviewUsers] = useState<PreviewUser[]>([]);
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false);
  const [bulkImporting, setBulkImporting] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!resetUser) return;
    try {
      await usersApi.update(resetUser.id, {
        password: newPassword,
        mustChangePassword: resetMustChangePassword,
      });
      setResetUser(null);
      setNewPassword('');
      setResetMustChangePassword(true);
      alert(`Password successfully updated for ${resetUser.username}.`);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const handleDelete = async (u: User) => {
    if (u.id === currentUser?.id) {
      alert('You cannot delete your own account.');
      return;
    }
    if (u.role === 'admin' && totalAdminsCount <= 1) {
      alert('Cannot delete the sole Administrator. The system must always have at least one Administrator.');
      return;
    }
    if (confirm(`Are you sure you want to permanently delete user '${u.username}'?`)) {
      try {
        await usersApi.delete(u.id);
        loadUsers();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to delete user');
      }
    }
  };

  // Download template CSV
  const handleDownloadTemplate = () => {
    const csvContent =
      'username,email,role,password,mustChangePassword\n' +
      'operator_alex,alex@company.com,operator,ChangeMe123!,true\n' +
      'viewer_sarah,sarah@company.com,viewer,ChangeMe123!,true\n' +
      'admin_lead,lead@company.com,admin,ChangeMe123!,true\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'users_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Backup / Export all users
  const handleBackupUsers = async () => {
    try {
      const data = await usersApi.backup();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `container-manager-users-backup-${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to download user backup');
    }
  };

  // Parse CSV text
  const parseCSV = (text: string): Array<{ username: string; email: string; role: string; password?: string; mustChangePassword?: boolean }> => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^['"]|['"]$/g, ''));
      const row: any = {};
      header.forEach((h, idx) => {
        row[h] = parts[idx] || '';
      });
      if (row.username || row.email) {
        rows.push({
          username: row.username || '',
          email: row.email || '',
          role: (row.role || 'operator').toLowerCase(),
          password: row.password || '',
          mustChangePassword: row.mustchangepassword ? row.mustchangepassword.toLowerCase() === 'true' : true,
        });
      }
    }
    return rows;
  };

  // Handle file selection for bulk import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportSummary(null);
    const content = await file.text();
    let rawItems: any[] = [];

    if (file.name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(content);
        rawItems = Array.isArray(parsed) ? parsed : parsed.users || [];
      } catch {
        alert('Invalid JSON file format.');
        return;
      }
    } else {
      rawItems = parseCSV(content);
    }

    if (rawItems.length === 0) {
      alert('No user records found in the uploaded file.');
      return;
    }

    const existingUsernames = new Set(users.map((u) => u.username.toLowerCase()));
    const seenUsernames = new Set<string>();

    const validated: PreviewUser[] = rawItems.map((item, idx) => {
      const username = (item.username || '').trim();
      const email = (item.email || '').trim();
      let role = (item.role || 'operator').toLowerCase() as UserRole;
      if (!['admin', 'operator', 'viewer'].includes(role)) {
        role = 'operator';
      }
      const mustChangePassword = item.mustChangePassword !== undefined ? Boolean(item.mustChangePassword) : true;
      const password = item.password || '';
      const passwordHash = item.passwordHash;

      let status: 'valid' | 'duplicate' | 'error' = 'valid';
      let statusMessage = 'Ready to import';

      if (!username) {
        status = 'error';
        statusMessage = `Row ${idx + 1}: Username is missing.`;
      } else if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
        status = 'error';
        statusMessage = `Row ${idx + 1}: Invalid characters in username.`;
      } else if (seenUsernames.has(username.toLowerCase())) {
        status = 'duplicate';
        statusMessage = 'Duplicate username within file.';
      } else if (existingUsernames.has(username.toLowerCase())) {
        status = 'duplicate';
        statusMessage = 'Existing username in database.';
      }

      seenUsernames.add(username.toLowerCase());

      return {
        username,
        email,
        role,
        password,
        passwordHash,
        mustChangePassword,
        status,
        statusMessage,
        selected: status !== 'error',
      };
    });

    setPreviewUsers(validated);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleToggleSelectRow = (index: number) => {
    setPreviewUsers((prev) =>
      prev.map((u, i) => (i === index ? { ...u, selected: !u.selected } : u))
    );
  };

  const handleSelectAllValid = (selected: boolean) => {
    setPreviewUsers((prev) =>
      prev.map((u) => (u.status !== 'error' ? { ...u, selected } : u))
    );
  };

  const handleConfirmBulkImport = async () => {
    const toImport = previewUsers.filter((u) => u.selected && u.status !== 'error');
    if (toImport.length === 0) {
      alert('No valid users selected for import.');
      return;
    }

    setBulkImporting(true);
    setImportSummary(null);

    try {
      const payload = toImport.map((u) => ({
        username: u.username,
        email: u.email,
        role: u.role,
        password: u.password || 'ChangeMe123!',
        passwordHash: u.passwordHash,
        mustChangePassword: u.mustChangePassword,
      }));

      const res = await usersApi.bulkImport(payload, overwriteExisting);
      setImportSummary(`Successfully imported ${res.importedCount} users. Skipped: ${res.skippedCount}.`);
      await loadUsers();
      // Keep summary visible or close
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to complete bulk import.');
    } finally {
      setBulkImporting(false);
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

  const validCount = previewUsers.filter((u) => u.selected && u.status !== 'error').length;
  const duplicateCount = previewUsers.filter((u) => u.status === 'duplicate').length;
  const errorCount = previewUsers.filter((u) => u.status === 'error').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Role-Based Access Control (RBAC)</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Manage platform accounts, role permissions & credentials</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            onClick={loadUsers}
            className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors"
            title="Refresh users"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownloadTemplate}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold transition-colors"
            title="Download CSV template for bulk user creation"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Download CSV Template</span>
            <span className="md:hidden">Template</span>
          </button>

          <button
            onClick={handleBackupUsers}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold transition-colors"
            title="Export full user backup for archival or migration"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Backup Users</span>
            <span className="md:hidden">Backup</span>
          </button>

          <button
            onClick={() => {
              setPreviewUsers([]);
              setImportSummary(null);
              setIsBulkModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition-all"
            title="Bulk import users via CSV or backup JSON file"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Bulk Import</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
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
        <div className="overflow-x-auto">
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
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] uppercase font-bold">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{u.email || '-'}</td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleUpdateRole(u, e.target.value as UserRole)}
                        disabled={isRoleDisabled}
                        title={isRoleDisabled ? 'Cannot change the role of the sole active administrator or yourself' : 'Change role'}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg border focus:outline-none transition-colors ${getRoleBadge(
                          u.role
                        )} ${isRoleDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <option value="operator">Operator</option>
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={isStatusDisabled}
                        title={isStatusDisabled ? 'Cannot deactivate the sole active administrator or yourself' : 'Toggle account status'}
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase transition-all ${
                          u.isActive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                        } ${isStatusDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-80'}`}
                      >
                        {u.isActive ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                        <span>{u.isActive ? 'Active' : 'Disabled'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      {u.mustChangePassword ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20 uppercase">
                          <KeyRound className="w-3 h-3" />
                          <span>Pending</span>
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-[11px]">Completed</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setResetUser(u);
                            setNewPassword('');
                            setResetMustChangePassword(true);
                          }}
                          title="Reset Password"
                          className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={isDeleteDisabled}
                          title={isDeleteDisabled ? 'Cannot delete the sole administrator or your own account' : 'Delete user'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isDeleteDisabled
                              ? 'bg-zinc-100 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-600 cursor-not-allowed border border-zinc-200 dark:border-zinc-800'
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
      </div>

      {/* Add Single User Modal */}
      {isAddModalOpen && isAddMinimized && createPortal(
        <div className="fixed bottom-5 right-5 z-[100] bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-5">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg border border-blue-500/20">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-zinc-900 dark:text-white">Add User</p>
              <p className="text-[10px] text-zinc-400">{username || 'Configuring...'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 pl-2 border-l border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setIsAddMinimized(false)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Restore window"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                setIsAddMinimized(false);
                setIsAddMaximized(false);
              }}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>,
        document.body
      )}

      {isAddModalOpen && !isAddMinimized && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className={`bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in fade-in zoom-in-95 transition-all overflow-hidden flex flex-col ${
            isAddMaximized ? 'w-full h-full inset-0 rounded-none' : 'rounded-2xl max-w-md w-full'
          }`}>
            <div className="px-4 sm:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-w-0">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="p-2 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">Create New User</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Add an administrator, operator, or viewer account</p>
                </div>
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => setIsAddMinimized(true)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Minimize"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsAddMaximized(!isAddMaximized)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title={isAddMaximized ? "Restore size" : "Maximize"}
                >
                  {isAddMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsAddMinimized(false);
                    setIsAddMaximized(false);
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. devops_admin"
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
        </div>,
        document.body
      )}

      {/* Password Reset Modal */}
      {resetUser && isResetMinimized && createPortal(
        <div className="fixed bottom-5 right-5 z-[100] bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-5">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-zinc-900 dark:text-white">Reset Password</p>
              <p className="text-[10px] text-zinc-400">{resetUser.username}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 pl-2 border-l border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setIsResetMinimized(false)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Restore window"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setResetUser(null);
                setIsResetMinimized(false);
                setIsResetMaximized(false);
              }}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>,
        document.body
      )}

      {resetUser && !isResetMinimized && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className={`bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 transition-all flex flex-col ${
            isResetMaximized ? 'w-full h-full inset-0 rounded-none' : 'rounded-2xl max-w-md w-full p-6'
          }`}>
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 gap-3 min-w-0">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate min-w-0 flex-1">Reset Password for {resetUser.username}</h3>
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => setIsResetMinimized(true)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Minimize"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsResetMaximized(!isResetMaximized)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title={isResetMaximized ? "Restore size" : "Maximize"}
                >
                  {isResetMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    setResetUser(null);
                    setIsResetMinimized(false);
                    setIsResetMaximized(false);
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs flex-1">
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
        </div>,
        document.body
      )}

      {/* Bulk Import & Validation Preview Modal */}
      {isBulkModalOpen && isBulkMinimized && createPortal(
        <div className="fixed bottom-5 right-5 z-[100] bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-5">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-purple-500/10 text-purple-600 rounded-lg border border-purple-500/20">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-zinc-900 dark:text-white">Bulk User Import</p>
              <p className="text-[10px] text-zinc-400">{previewUsers.length} records parsed</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 pl-2 border-l border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setIsBulkMinimized(false)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Restore window"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setIsBulkModalOpen(false);
                setIsBulkMinimized(false);
                setIsBulkMaximized(false);
              }}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>,
        document.body
      )}

      {isBulkModalOpen && !isBulkMinimized && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className={`bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in fade-in zoom-in-95 transition-all flex flex-col ${
            isBulkMaximized ? 'w-full h-full inset-0 rounded-none' : 'rounded-3xl max-w-4xl w-full max-h-[92vh] sm:max-h-[90vh]'
          }`}>
            {/* Header */}
            <div className="p-4 sm:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-w-0">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/20 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">Bulk Create & Import Users</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    Upload CSV or JSON backup with automated client-side validation
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => setIsBulkMinimized(true)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Minimize"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsBulkMaximized(!isBulkMaximized)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title={isBulkMaximized ? "Restore size" : "Maximize"}
                >
                  {isBulkMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    setIsBulkModalOpen(false);
                    setIsBulkMinimized(false);
                    setIsBulkMaximized(false);
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* File Dropzone / Picker */}
              <div className="p-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/40 text-center space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.tsv,.json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="bulk-user-file-input"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <label
                      htmlFor="bulk-user-file-input"
                      className="cursor-pointer font-bold text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Choose CSV or JSON Backup File
                    </label>
                    <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">
                      Supports comma-separated CSV (`username,email,role,password`) or JSON export files.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center space-x-3 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Download Sample Template</span>
                  </button>
                </div>
              </div>

              {/* Status / Import Summary */}
              {importSummary && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 flex items-center space-x-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importSummary}</span>
                </div>
              )}

              {/* Validation Summary Cards */}
              {previewUsers.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center">
                    <span className="text-zinc-400 uppercase text-[10px] font-bold">Total Rows</span>
                    <div className="text-lg font-black text-zinc-900 dark:text-white mt-0.5">{previewUsers.length}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <span className="text-emerald-600 dark:text-emerald-400 uppercase text-[10px] font-bold">Ready</span>
                    <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{validCount}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-center">
                    <span className="text-amber-600 dark:text-amber-400 uppercase text-[10px] font-bold">Duplicates</span>
                    <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">{duplicateCount}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 text-center">
                    <span className="text-red-600 dark:text-red-400 uppercase text-[10px] font-bold">Errors</span>
                    <div className="text-lg font-black text-red-600 dark:text-red-400 mt-0.5">{errorCount}</div>
                  </div>
                </div>
              )}

              {/* Validation Preview Table */}
              {previewUsers.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="font-bold text-zinc-900 dark:text-white text-xs uppercase tracking-wider">
                      Validation Preview ({validCount} Selected for Import)
                    </h4>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleSelectAllValid(true)}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Select All Valid
                      </button>
                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                      <button
                        type="button"
                        onClick={() => handleSelectAllValid(false)}
                        className="text-[11px] font-semibold text-zinc-500 hover:underline"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] sticky top-0 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-3 w-8"></th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Username</th>
                          <th className="py-2.5 px-3">Email</th>
                          <th className="py-2.5 px-3">Role</th>
                          <th className="py-2.5 px-3">Password</th>
                          <th className="py-2.5 px-3">Force Reset</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-sans">
                        {previewUsers.map((u, idx) => (
                          <tr
                            key={idx}
                            className={`transition-colors ${
                              u.status === 'error'
                                ? 'bg-red-500/5'
                                : u.status === 'duplicate'
                                ? 'bg-amber-500/5'
                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                            }`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={u.selected}
                                disabled={u.status === 'error'}
                                onChange={() => handleToggleSelectRow(idx)}
                                className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
                              />
                            </td>
                            <td className="py-2 px-3">
                              {u.status === 'valid' ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Valid</span>
                                </span>
                              ) : u.status === 'duplicate' ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title={u.statusMessage}>
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Duplicate</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" title={u.statusMessage}>
                                  <X className="w-3 h-3" />
                                  <span>Error</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-zinc-900 dark:text-white">
                              {u.username || <span className="text-red-500 italic">Empty</span>}
                            </td>
                            <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400 font-mono">
                              {u.email || '-'}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getRoleBadge(u.role)}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-zinc-500">
                              {u.passwordHash ? 'Hash preserved' : u.password ? '••••••••' : 'Default'}
                            </td>
                            <td className="py-2 px-3 text-zinc-500 font-semibold">
                              {u.mustChangePassword ? 'Yes' : 'No'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Overwrite Toggle */}
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                    <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={overwriteExisting}
                        onChange={(e) => setOverwriteExisting(e.target.checked)}
                        className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-purple-600 focus:ring-0"
                      />
                      <div>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                          Overwrite existing matching usernames
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                          If checked, existing user records will have their email, role, and password updated from the import.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkModalOpen(false);
                    setPreviewUsers([]);
                    setImportSummary(null);
                  }}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-semibold transition-colors"
                >
                  Close
                </button>

                {previewUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleConfirmBulkImport}
                    disabled={bulkImporting || validCount === 0}
                    className="flex items-center space-x-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
                  >
                    {bulkImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Importing {validCount} Users...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm & Import ({validCount} Users)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
