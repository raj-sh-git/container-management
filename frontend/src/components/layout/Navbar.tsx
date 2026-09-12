import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { systemApi } from '../../services/api';
import {
  Server,
  User as UserIcon,
  LogOut,
  RefreshCw,
  Sun,
  Moon,
} from 'lucide-react';

export const Navbar: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [dockerConnected, setDockerConnected] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    async function checkHealth() {
      try {
        const v = await systemApi.version();
        setVersion(v.Version || 'Connected');
        setDockerConnected(true);
      } catch {
        setDockerConnected(false);
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
      case 'operator':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      default:
        return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30';
    }
  };

  return (
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] sticky top-0 z-40 px-6 flex items-center justify-between transition-colors">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-white">
                Container Control Center
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center">
                <span
                  className={`w-2 h-2 rounded-full mr-1.5 ${
                    dockerConnected === true
                      ? 'bg-emerald-500 animate-pulse'
                      : dockerConnected === false
                      ? 'bg-red-500'
                      : 'bg-yellow-500'
                  }`}
                />
                {dockerConnected ? `Engine v${version}` : dockerConnected === false ? 'Socket Disconnected' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Dark / Light Mode Toggle */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
        </button>

        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refresh engine state"
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

        {user && (
          <div className="flex items-center space-x-3">
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{user.username}</span>
              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded border ${getRoleBadge(user.role)}`}>
                {user.role}
              </span>
            </div>

            <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
              <UserIcon className="w-4 h-4" />
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
