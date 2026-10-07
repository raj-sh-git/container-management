import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SshProfile } from '../types';
import { SshConnectionForm, SshSessionConfig } from '../components/ssh/SshConnectionForm';
import { SshTerminalInstance } from '../components/ssh/SshTerminalInstance';
import { 
  Terminal as TermIcon, 
  ShieldAlert, 
  Plus, 
  Power, 
  X
} from 'lucide-react';

export const SshPage: React.FC = () => {
  const { canAccessSsh } = useAuth();
  const [sessions, setSessions] = useState<SshSessionConfig[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionStatuses, setSessionStatuses] = useState<Record<string, 'connecting' | 'connected' | 'disconnected' | 'error'>>({});
  const [isConnectingNew, setIsConnectingNew] = useState<boolean>(false);

  if (!canAccessSsh) {
    return (
      <div className="p-8 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
        <ShieldAlert className="w-12 h-12 text-amber-500" />
        <h3 className="text-base font-bold text-zinc-900 dark:text-white">SSH Terminal Restricted</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
          Interactive SSH remote terminal access requires Administrator privileges or delegated Operator SSH permissions.
        </p>
      </div>
    );
  }

  const handleConnect = (config: SshSessionConfig, remember: boolean) => {
    if (remember) {
      try {
        const saved = localStorage.getItem('sshProfiles');
        let profiles: SshProfile[] = saved ? JSON.parse(saved) : [];
        const existingIdx = profiles.findIndex((p) => p.host === config.host && p.username === config.username);
        
        const newProfile: SshProfile = {
          id: existingIdx >= 0 ? profiles[existingIdx].id : Date.now().toString(),
          host: config.host,
          port: config.port,
          username: config.username,
          authMethod: config.authMethod,
          lastConnected: new Date().toISOString()
        };
        
        if (existingIdx >= 0) {
          profiles[existingIdx] = newProfile;
        } else {
          profiles.push(newProfile);
        }
        localStorage.setItem('sshProfiles', JSON.stringify(profiles));
      } catch (err) {
        console.error('Failed to save SSH profile:', err);
      }
    }
    
    setSessions(prev => [...prev, config]);
    setActiveSessionId(config.id);
    setIsConnectingNew(false);
  };

  const handleClose = (id: string) => {
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== id);
      if (activeSessionId === id) {
        const nextActive = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        setActiveSessionId(nextActive ? nextActive.id : null);
        if (!nextActive) {
          setIsConnectingNew(false);
        }
      }
      return remaining;
    });

    setSessionStatuses(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleCloseAll = () => {
    // Unmounting all sessions triggers their WebSocket disconnect cleanup and terminates remote sessions
    setSessions([]);
    setActiveSessionId(null);
    setSessionStatuses({});
    setIsConnectingNew(false);
  };

  const handleStatusChange = (id: string, status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
    setSessionStatuses(prev => ({ ...prev, [id]: status }));
  };

  const showConnectionForm = isConnectingNew || sessions.length === 0;

  return (
    <div className="select-text h-full flex flex-col min-h-0 space-y-3">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-2xl border border-sky-500/20 shrink-0">
            <TermIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                SSH Terminal
              </h1>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Encrypted terminal access to the host machine or any remote server via Password or Key File
            </p>
          </div>
        </div>

        {/* Close All Sessions button */}
        {sessions.length > 0 && (
          <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleCloseAll}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-sm"
              title="Disconnect all connected hosts and close all tabs"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Close All Sessions</span>
            </button>
          </div>
        )}
      </div>

      {/* Session Tabs Bar (when there are active sessions) */}
      {sessions.length > 0 && (
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 shrink-0 border-b border-zinc-200 dark:border-zinc-800/80">
          {sessions.map(s => {
            const isActive = activeSessionId === s.id && !showConnectionForm;
            const status = sessionStatuses[s.id] || 'connecting';
            return (
              <div
                key={s.id}
                onClick={() => {
                  setActiveSessionId(s.id);
                  setIsConnectingNew(false);
                }}
                className={`group flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all border shrink-0 ${
                  isActive
                    ? 'bg-white dark:bg-zinc-900 text-sky-600 dark:text-sky-400 border-sky-500/30 shadow-sm font-semibold'
                    : 'bg-zinc-100/70 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    status === 'connected'
                      ? 'bg-emerald-500 animate-pulse'
                      : status === 'connecting'
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-rose-500'
                  }`}
                />
                <span className="font-mono truncate max-w-[150px] sm:max-w-[200px]">
                  {s.username}@{s.host}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose(s.id);
                  }}
                  className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-rose-500 transition-colors ml-1"
                  title="Close session"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setIsConnectingNew(true)}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border shrink-0 ${
              showConnectionForm
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-dashed border-zinc-300 dark:border-zinc-700'
            }`}
            title="Open new SSH connection"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Another Host</span>
          </button>
        </div>
      )}

      {/* Main Content Workspace directly below SSH Terminal heading / tabs */}
      <div className="flex-1 min-h-0 flex flex-col relative">
        {/* Connection Form View */}
        {showConnectionForm ? (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 pb-6">
            <SshConnectionForm onConnect={handleConnect} />
          </div>
        ) : null}

        {/* Active Terminal Instances (Rendered in place below header, kept alive when switching tabs) */}
        {sessions.map(s => (
          <SshTerminalInstance
            key={s.id}
            config={s}
            isVisible={!showConnectionForm && activeSessionId === s.id}
            onClose={handleClose}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>
    </div>
  );
};
