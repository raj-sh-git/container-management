import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { systemApi } from '../../services/api';
import { ChangelogModal } from './ChangelogModal';
import {
  Server,
  User as UserIcon,
  LogOut,
  RefreshCw,
  Sun,
  Moon,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';

const APP_VERSION = 'v0.2.0';

interface NavbarProps {
  onRefresh?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRefresh,
  onToggleMobileMenu,
  isMobileMenuOpen,
}) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [dockerConnected, setDockerConnected] = useState<boolean | null>(null);
  const [dockerVersion, setDockerVersion] = useState<string>('');
  const [isChangelogOpen, setIsChangelogOpen] = useState<boolean>(false);

  useEffect(() => {
    async function checkHealth() {
      try {
        const v = await systemApi.version();
        setDockerVersion(v.Version || 'Connected');
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
    <>
      <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] sticky top-0 z-40 px-3 sm:px-6 flex items-center justify-between transition-colors">
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Mobile Hamburger Menu Button */}
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              type="button"
              className="p-2 -ml-1 sm:ml-0 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}

          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Server className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm sm:text-base tracking-tight text-zinc-900 dark:text-white truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none">
                  Container Control
                </span>
                {/* App Version & Changelog Trigger Badge */}
                <button
                  type="button"
                  onClick={() => setIsChangelogOpen(true)}
                  className="flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-mono text-[9px] sm:text-[10px] font-bold transition-colors cursor-pointer"
                  title="View Changelog & Release Notes"
                >
                  <Sparkles className="w-2.5 h-2.5 hidden xs:inline" />
                  <span>{APP_VERSION}</span>
                </button>
              </div>
              <div className="flex items-center space-x-2 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center">
                  <span
                    className={`w-2 h-2 rounded-full mr-1.5 shrink-0 ${
                      dockerConnected === true
                        ? 'bg-emerald-500 animate-pulse'
                        : dockerConnected === false
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                    }`}
                  />
                  <span className="truncate max-w-[120px] sm:max-w-none">
                    {dockerConnected
                      ? `Engine v${dockerVersion}`
                      : dockerConnected === false
                      ? 'Disconnected'
                      : 'Connecting...'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-3">
          {/* Changelog Trigger Button (Desktop & Tablet) */}
          <button
            onClick={() => setIsChangelogOpen(true)}
            title="View Release Changelog"
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Changelog</span>
          </button>

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

          <div className="h-5 sm:h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

          {user && (
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[100px] sm:max-w-none">
                  {user.username}
                </span>
                <span className={`text-[9px] sm:text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded border ${getRoleBadge(user.role)}`}>
                  {user.role}
                </span>
              </div>

              <div
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0"
                title={`${user.username} (${user.role})`}
              >
                <UserIcon className="w-4 h-4" />
              </div>

              <button
                onClick={logout}
                title="Sign Out"
                className="p-1.5 sm:p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Changelog Modal */}
      <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
    </>
  );
};
