import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ChangelogModal } from './ChangelogModal';
import {
  LayoutDashboard,
  Box,
  Boxes,
  Layers,
  HardDrive,
  Network,
  ShieldAlert,
  Users,
  ScrollText,
  Cpu,
  Sparkles,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'containers'
  | 'stacks'
  | 'images'
  | 'volumes'
  | 'networks'
  | 'security'
  | 'users'
  | 'audit'
  | 'host';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  counts?: {
    containers?: number;
    stacks?: number;
    images?: number;
    volumes?: number;
    networks?: number;
    reports?: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, counts }) => {
  const { isAdmin } = useAuth();
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode; count?: number; adminOnly?: boolean }> = [
    { id: 'dashboard', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'containers', label: 'Containers', icon: <Box className="w-4 h-4" />, count: counts?.containers },
    { id: 'stacks', label: 'Compose Stacks', icon: <Boxes className="w-4 h-4" />, count: counts?.stacks },
    { id: 'images', label: 'Images', icon: <Layers className="w-4 h-4" />, count: counts?.images },
    { id: 'volumes', label: 'Volumes', icon: <HardDrive className="w-4 h-4" />, count: counts?.volumes },
    { id: 'networks', label: 'Networks', icon: <Network className="w-4 h-4" />, count: counts?.networks },
    { id: 'security', label: 'Trivy Security', icon: <ShieldAlert className="w-4 h-4" />, count: counts?.reports },
    { id: 'host', label: 'Host & Engine', icon: <Cpu className="w-4 h-4" /> },
    { id: 'users', label: 'User RBAC', icon: <Users className="w-4 h-4" />, adminOnly: true },
    { id: 'audit', label: 'Audit Logs', icon: <ScrollText className="w-4 h-4" />, adminOnly: true },
  ];

  return (
    <>
      <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] flex flex-col justify-between p-4 shrink-0 min-h-[calc(100vh-4rem)] transition-colors">
        <div className="space-y-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-3 mb-2">
              Navigation
            </div>
            <nav className="space-y-1">
              {navItems
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/80'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {item.count !== undefined && item.count > 0 && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
            </nav>
          </div>
        </div>

        <div className="space-y-2">
          {/* Version & Changelog Trigger Card */}
          <button
            onClick={() => setIsChangelogOpen(true)}
            className="w-full flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/40 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 rounded-xl border border-zinc-200 dark:border-zinc-800 transition-colors text-left"
          >
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Manager v0.2.0</span>
            </div>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Changelog</span>
          </button>

          <div className="p-3 bg-zinc-100 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800/80">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Socket Connection</div>
            <div className="text-[11px] text-zinc-600 dark:text-zinc-500 font-mono mt-0.5 truncate" title="Active Docker socket">
              /var/run/docker.sock
            </div>
          </div>
        </div>
      </aside>

      {/* Changelog Modal */}
      <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
    </>
  );
};
