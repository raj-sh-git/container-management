import React, { useState } from 'react';
import { ComposeStack, Container } from '../types';
import { containersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Boxes,
  Play,
  Square,
  RefreshCw,
  Box,
  Terminal,
  Activity,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  FolderGit2,
} from 'lucide-react';

interface StacksPageProps {
  stacks: ComposeStack[];
  onRefresh: () => void;
  onSelectContainer: (container: Container, tab?: string) => void;
}

export const StacksPage: React.FC<StacksPageProps> = ({
  stacks,
  onRefresh,
  onSelectContainer,
}) => {
  const { isOperator } = useAuth();
  const [expandedStacks, setExpandedStacks] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const toggleStack = (name: string) => {
    setExpandedStacks((prev) => ({
      ...prev,
      [name]: prev[name] === undefined ? false : !prev[name],
    }));
  };

  const isExpanded = (name: string) => expandedStacks[name] !== false; // expanded by default

  const handleStackAction = async (action: 'start' | 'stop' | 'restart', name: string) => {
    setActionLoading(`${action}-${name}`);
    try {
      if (action === 'start') await containersApi.startStack(name);
      else if (action === 'stop') await containersApi.stopStack(name);
      else if (action === 'restart') await containersApi.restartStack(name);
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Stack action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'running':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'paused':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      default:
        return 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-2xl border border-blue-500/20">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                Docker Compose Stacks
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Multi-container environments grouped by Compose project & stack definitions
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors"
          title="Refresh stacks"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stacks List */}
      {stacks.length === 0 ? (
        <div className="p-16 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-center space-y-3">
          <FolderGit2 className="w-12 h-12 text-zinc-400 dark:text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">No Compose Stacks Found</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Deploy multi-container services with <code className="bg-zinc-100 dark:bg-zinc-950 px-1 py-0.5 rounded font-mono">docker compose up</code> to see them grouped into managed stacks here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {stacks.map((stack) => {
            const open = isExpanded(stack.name);
            const isAllRunning = stack.runningCount === stack.totalCount && stack.totalCount > 0;
            const isSelfStack = stack.isSelf || stack.containers.some((c) => c.isSelf);

            return (
              <div
                key={stack.name}
                className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-lg transition-colors"
              >
                {/* Stack Header Bar */}
                <div className="p-5 flex flex-wrap items-center justify-between gap-4 bg-zinc-50/70 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800">
                  <div
                    onClick={() => toggleStack(stack.name)}
                    className="flex items-center space-x-3 cursor-pointer select-none"
                  >
                    <button className="p-1 text-zinc-400 hover:text-zinc-200">
                      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-base text-zinc-900 dark:text-white font-sans">
                          {stack.name}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${isAllRunning ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                          {stack.runningCount} / {stack.totalCount} Running
                        </span>
                        {isSelfStack && (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Self Protected</span>
                          </span>
                        )}
                      </div>
                      {stack.workingDir && (
                        <div className="text-[11px] text-zinc-500 font-mono mt-0.5 truncate max-w-lg">
                          Path: {stack.workingDir}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stack Control Actions - Removed for container management self stack */}
                  {isSelfStack ? (
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-xl text-xs font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Protected Platform Stack</span>
                      </span>
                    </div>
                  ) : isOperator ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleStackAction('start', stack.name)}
                        disabled={actionLoading === `start-${stack.name}`}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Stack</span>
                      </button>
                      <button
                        onClick={() => handleStackAction('stop', stack.name)}
                        disabled={actionLoading === `stop-${stack.name}`}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Stop Stack</span>
                      </button>
                      <button
                        onClick={() => handleStackAction('restart', stack.name)}
                        disabled={actionLoading === `restart-${stack.name}`}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Restart Stack</span>
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Stack Containers Table */}
                {open && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-100/50 dark:bg-zinc-950 text-zinc-500 uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-4">Service</th>
                          <th className="py-2.5 px-4">Container Name</th>
                          <th className="py-2.5 px-4">Image</th>
                          <th className="py-2.5 px-4">State</th>
                          <th className="py-2.5 px-4">Port Bindings</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
                        {stack.containers.map((c) => (
                          <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                            <td className="py-3 px-4 font-bold text-zinc-700 dark:text-zinc-300 font-sans">
                              {c.composeService || 'service'}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => onSelectContainer(c, 'overview')}
                                  className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-blue-500 text-left font-sans text-sm"
                                >
                                  {c.name}
                                </button>
                                {c.isSelf && (
                                  <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Self</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 truncate max-w-xs" title={c.image}>
                              {c.image}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStateBadge(c.state)}`}>
                                {c.state}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">
                              {c.ports && c.ports.length > 0
                                ? c.ports
                                    .map((p) => (p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : `${p.PrivatePort}`))
                                    .join(', ')
                                : '-'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                {c.state === 'running' && isOperator && (
                                  <button
                                    onClick={() => onSelectContainer(c, 'terminal')}
                                    title="Open Terminal"
                                    className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-blue-500"
                                  >
                                    <Terminal className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => onSelectContainer(c, 'logs')}
                                  title="View Logs"
                                  className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                                >
                                  <Activity className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
