import React from 'react';
import { X, Sparkles, CheckCircle2, Calendar, Tag } from 'lucide-react';
import { ChangelogItem } from '../../types';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHANGELOG_DATA: ChangelogItem[] = [
  {
    version: '0.2.0',
    date: '2026-09-12',
    title: 'Automated Cleanup Scheduler & UI Enhancements',
    changes: [
      'Automated Clean-Up Scheduler: Schedule one-time or recurring pruning for unused/dangling images, volumes, networks, stopped containers, and build cache',
      'Unused Images Identification: Visual badge tagging unused Docker images across the Images catalog',
      'Login Page Theme Switcher: Dark and Light mode toggle accessible directly on the sign-in screen',
      'Credential Security: Removed default credentials prefill on the login screen',
      'Storage Reclaim Analytics: Real-time calculation and audit logging of reclaimed disk space',
      'Multi-Arch Support: Production Docker builds supporting both linux/amd64 and linux/arm64 architectures',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-09-10',
    title: 'Initial Enterprise Release',
    changes: [
      'Nginx Reverse Proxy Support: Dynamic base path routing for serving behind subpaths (e.g. /cce)',
      'Stack & Container Safety: Protection against stopping or restarting the management container from inside itself',
      'RBAC Safeguards: Sole admin protection and prevention of self-role-demotion or self-deletion',
      'Trivy Security Scanning: Container & image vulnerability analysis with severity breakdown and exportable reports',
      'Interactive Terminal & Real-Time Logs: Web-based container console and live log streaming',
      'Compose Stacks & Engine Overview: Full lifecycle management for Docker Compose stacks, volumes, and networks',
    ],
  },
];

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-white">Version Changelog</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Release history, new features & engine enhancements</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {CHANGELOG_DATA.map((item, idx) => (
            <div
              key={item.version}
              className={`p-5 rounded-2xl border transition-colors ${
                idx === 0
                  ? 'bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/30'
                  : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800/80'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center space-x-2">
                  <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-600 text-white font-mono text-xs font-bold shadow-sm shadow-blue-600/30">
                    <Tag className="w-3.5 h-3.5" />
                    <span>v{item.version}</span>
                  </span>
                  {idx === 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                      Current
                    </span>
                  )}
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{item.title}</h3>
                </div>

                <div className="flex items-center space-x-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{item.date}</span>
                </div>
              </div>

              <ul className="space-y-2 mt-3 text-xs text-zinc-700 dark:text-zinc-300">
                {item.changes.map((change, cIdx) => (
                  <li key={cIdx} className="flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Container Manager v0.2.0</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
