import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/api';
import { KeyRound, Lock, AlertCircle, LogOut, CheckCircle2 } from 'lucide-react';

interface ForcePasswordChangeModalProps {
  isOpen: boolean;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({ isOpen }) => {
  const { user, updateUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.changePassword({
        currentPassword,
        newPassword,
      });

      setSuccess('Password updated successfully!');
      if (res.user) {
        updateUser(res.user);
      } else if (user) {
        updateUser({ ...user, mustChangePassword: false });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 transition-colors">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 mb-1">
            <KeyRound className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
            Password Change Required
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            For security reasons, your account (<span className="font-bold text-zinc-700 dark:text-zinc-200">{user?.username}</span>) requires a password update before proceeding.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              Current Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current / temporary password"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 6 characters"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {loading ? 'Updating Password...' : 'Save & Continue'}
          </button>
        </form>

        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <button
            onClick={logout}
            className="text-xs text-zinc-500 hover:text-red-500 inline-flex items-center space-x-1 font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out instead</span>
          </button>
        </div>
      </div>
    </div>
  );
};
