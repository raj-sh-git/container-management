import React from 'react';
import { Container, DockerImage, DockerVolume, DockerNetwork, SystemInfo, ScanReport } from '../types';
import {
  Box,
  Layers,
  HardDrive,
  Network,
  ShieldAlert,
  Play,
  Square,
  RefreshCw,
  Cpu,
  Database,
  Server,
  Plus,
  Terminal,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import { NavTab } from '../components/layout/Sidebar';

interface DashboardPageProps {
  systemInfo: SystemInfo | null;
  containers: Container[];
  images: DockerImage[];
  volumes: DockerVolume[];
  networks: DockerNetwork[];
  reports: ScanReport[];
  onSelectTab: (tab: NavTab) => void;
  onOpenCreateContainer: () => void;
  onOpenScanModal: () => void;
  onSelectContainer: (container: Container, tab?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  systemInfo,
  containers,
  images,
  volumes,
  networks,
  reports,
  onSelectTab,
  onOpenCreateContainer,
  onOpenScanModal,
  onSelectContainer,
}) => {
  const runningContainers = containers.filter((c) => c.state === 'running');
  const stoppedContainers = containers.filter((c) => c.state !== 'running');

  const totalCritical = reports.reduce((acc, r) => acc + r.criticalCount, 0);
  const totalHigh = reports.reduce((acc, r) => acc + r.highCount, 0);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
            Infrastructure Dashboard
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Real-time status of host daemon, containers, images, storage, and Trivy security
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <button
            onClick={onOpenScanModal}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-3 sm:px-3.5 py-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            <span>Trivy Scan</span>
          </button>

          <button
            onClick={onOpenCreateContainer}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-3.5 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Deploy Container</span>
          </button>
        </div>
      </div>

      {/* Metric Counters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Containers Tile */}
        <div
          onClick={() => onSelectTab('containers')}
          className="p-5 bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl cursor-pointer transition-all hover:scale-[1.01] group shadow-sm dark:shadow-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Containers</span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <Box className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div className="text-3xl font-black text-zinc-900 dark:text-white">{containers.length}</div>
            <div className="flex items-center space-x-2 text-xs font-semibold">
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                {runningContainers.length} Active
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">/</span>
              <span className="text-zinc-500 dark:text-zinc-400">{stoppedContainers.length} Stopped</span>
            </div>
          </div>
        </div>

        {/* Images Tile */}
        <div
          onClick={() => onSelectTab('images')}
          className="p-5 bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl cursor-pointer transition-all hover:scale-[1.01] group shadow-sm dark:shadow-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Docker Images</span>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div className="text-3xl font-black text-zinc-900 dark:text-white">{images.length}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              {formatBytes(images.reduce((acc, img) => acc + (img.size || 0), 0))}
            </div>
          </div>
        </div>

        {/* Volumes Tile */}
        <div
          onClick={() => onSelectTab('volumes')}
          className="p-5 bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl cursor-pointer transition-all hover:scale-[1.01] group shadow-sm dark:shadow-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Volumes</span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20 transition-colors">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div className="text-3xl font-black text-zinc-900 dark:text-white">{volumes.length}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Local storage pools</div>
          </div>
        </div>

        {/* Security Posture Tile */}
        <div
          onClick={() => onSelectTab('security')}
          className="p-5 bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl cursor-pointer transition-all hover:scale-[1.01] group shadow-sm dark:shadow-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Security Scans</span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500/20 transition-colors">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div className="text-3xl font-black text-zinc-900 dark:text-white">{reports.length}</div>
            <div className="flex items-center space-x-2 text-xs font-semibold">
              <span className="text-red-500 dark:text-red-400">{totalCritical} Critical</span>
              <span className="text-zinc-300 dark:text-zinc-600">/</span>
              <span className="text-orange-500 dark:text-orange-400">{totalHigh} High</span>
            </div>
          </div>
        </div>
      </div>

      {/* Host Specs & Daemon Details */}
      {systemInfo && (
        <div className="p-4 sm:p-6 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-3 sm:pb-4 mb-4 gap-2">
            <div className="flex items-center space-x-2.5 sm:space-x-3">
              <Server className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 dark:text-blue-400 shrink-0" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Host Engine Telemetry</h3>
            </div>
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">Docker {systemInfo.ServerVersion}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800/60">
              <span className="text-zinc-500 font-medium">Operating System</span>
              <div className="text-zinc-800 dark:text-zinc-200 font-semibold mt-0.5 truncate" title={systemInfo.OperatingSystem}>{systemInfo.OperatingSystem}</div>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800/60">
              <span className="text-zinc-500 font-medium">Architecture / CPUs</span>
              <div className="text-zinc-800 dark:text-zinc-200 font-semibold mt-0.5">
                {systemInfo.Architecture} ({systemInfo.NCPU} Cores)
              </div>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800/60">
              <span className="text-zinc-500 font-medium">Total Host RAM</span>
              <div className="text-zinc-800 dark:text-zinc-200 font-semibold mt-0.5">{formatBytes(systemInfo.MemTotal)}</div>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800/60">
              <span className="text-zinc-500 font-medium">Storage Driver</span>
              <div className="text-zinc-800 dark:text-zinc-200 font-semibold mt-0.5">{systemInfo.Driver}</div>
            </div>
          </div>
        </div>
      )}

      {/* Active Running Containers Table */}
      <div className="p-4 sm:p-6 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm dark:shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">Running Containers</h3>
          </div>
          <button
            onClick={() => onSelectTab('containers')}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 font-semibold flex items-center space-x-1"
          >
            <span>View All ({containers.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {runningContainers.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs">
            No running containers. Deploy or start a container to monitor live.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-zinc-500 uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Container</th>
                  <th className="py-3 px-4">Image</th>
                  <th className="py-3 px-4">Ports</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
                {runningContainers.slice(0, 6).map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onSelectContainer(c, 'overview')}
                        className="font-bold text-zinc-900 dark:text-zinc-200 hover:text-blue-500 text-left font-sans"
                      >
                        {c.name}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 truncate max-w-xs">{c.image}</td>
                    <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">
                      {c.ports && c.ports.length > 0
                        ? c.ports
                            .map((p) => (p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : `${p.PrivatePort}`))
                            .join(', ')
                        : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
                        Running
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onSelectContainer(c, 'terminal')}
                          title="Open Terminal"
                          className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSelectContainer(c, 'logs')}
                          title="View Logs"
                          className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
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
    </div>
  );
};
