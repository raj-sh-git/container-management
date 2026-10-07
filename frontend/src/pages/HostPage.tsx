import React, { useState, useEffect } from 'react';
import { SystemInfo, HostMetrics } from '../types';
import { systemApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RefreshButton } from '../components/common/RefreshButton';
import {
  Server,
  Layers,
  Box,
  HardDrive,
  RefreshCw,
  Wrench,
  ArrowRight,
  Activity,
  Cpu,
  Clock,
} from 'lucide-react';

interface HostPageProps {
  systemInfo: SystemInfo | null;
  diskUsage?: any;
  onUpdateDiskUsage?: (data: any) => void;
  onRefresh: () => void;
  onNavigateToMaintenance?: () => void;
}

let moduleCachedDiskUsage: any = null;
let moduleCachedMetrics: HostMetrics | null = null;

export const HostPage: React.FC<HostPageProps> = ({
  systemInfo,
  diskUsage: propDiskUsage,
  onUpdateDiskUsage,
  onRefresh,
  onNavigateToMaintenance,
}) => {
  const { isAdmin } = useAuth();
  const [diskUsage, setDiskUsage] = useState<any>(
    propDiskUsage || moduleCachedDiskUsage || null
  );
  const [metrics, setMetrics] = useState<HostMetrics | null>(
    moduleCachedMetrics || null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Keep state in sync if prop changes
  useEffect(() => {
    if (propDiskUsage) {
      moduleCachedDiskUsage = propDiskUsage;
      setDiskUsage(propDiskUsage);
    }
  }, [propDiskUsage]);

  const loadDf = async (fresh: boolean = false) => {
    try {
      const data = await systemApi.df(fresh);
      moduleCachedDiskUsage = data;
      setDiskUsage(data);
      if (onUpdateDiskUsage) onUpdateDiskUsage(data);
    } catch (err) {
      console.error('Failed to load disk usage:', err);
    }
  };

  const loadMetrics = async () => {
    try {
      const data = await systemApi.hostMetrics();
      moduleCachedMetrics = data;
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load host metrics', err);
    }
  };

  const refreshAll = async (fresh: boolean = false) => {
    setLoading(true);
    try {
      await Promise.allSettled([loadDf(fresh), loadMetrics()]);
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Revalidate data silently without resetting UI
    loadDf(false);
    loadMetrics();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadMetrics();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return '0m';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${mins}m`);
    return parts.join(' ');
  };

  const getUsageColor = (pct: number) => {
    if (pct >= 85) return 'text-rose-500 dark:text-rose-400';
    if (pct >= 60) return 'text-amber-500 dark:text-amber-400';
    return 'text-emerald-500 dark:text-emerald-400';
  };

  const getUsageBg = (pct: number) => {
    if (pct >= 85) return 'bg-rose-500';
    if (pct >= 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const handleOpenMaintenance = () => {
    if (onNavigateToMaintenance) {
      onNavigateToMaintenance();
    } else {
      window.location.hash = 'maintenance';
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 select-text">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Host Info</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Host hardware specifications, real-time CPU & memory usages, and storage utilization
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <RefreshButton onRefresh={() => refreshAll(true)} title="Refresh host metrics" />
        </div>
      </div>

      {/* SECTION 1: Host CPU & Memory Usages */}
      <div className="p-4 sm:p-6 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl space-y-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">Host CPU & Memory Usages</h3>
                <span className="flex h-2 w-2 relative">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      autoRefresh ? 'bg-emerald-400' : 'bg-zinc-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      autoRefresh ? 'bg-emerald-500' : 'bg-zinc-400'
                    }`}
                  />
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Real-time processor & physical memory utilization
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                autoRefresh
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
              }`}
              title="Toggle automatic refresh every 5 seconds"
            >
              {autoRefresh ? 'Live (5s)' : 'Paused'}
            </button>
          </div>
        </div>

        {metrics ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* CPU Tile */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Host CPU Utilization
                    </span>
                  </div>
                  <span
                    className={`text-2xl font-black font-mono tracking-tight ${getUsageColor(
                      metrics.cpu.usagePercent
                    )}`}
                  >
                    {metrics.cpu.usagePercent.toFixed(1)}%
                  </span>
                </div>

                {/* Main CPU Bar */}
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${getUsageBg(
                      metrics.cpu.usagePercent
                    )}`}
                    style={{ width: `${Math.min(100, Math.max(2, metrics.cpu.usagePercent))}%` }}
                  />
                </div>

                {/* CPU Details */}
                <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-zinc-200/70 dark:border-zinc-800/60">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400">Cores</span>
                    <div className="font-mono font-semibold text-zinc-900 dark:text-zinc-200 truncate">
                      {metrics.cpu.cores} Cores
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400">Load Avg</span>
                    <div
                      className="font-mono font-semibold text-zinc-900 dark:text-zinc-200 truncate"
                      title="1m, 5m, 15m load average"
                    >
                      {metrics.cpu.loadAvg.map((l) => l.toFixed(1)).join(' · ')}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400">Model</span>
                    <div
                      className="font-mono font-semibold text-zinc-900 dark:text-zinc-200 truncate"
                      title={metrics.cpu.model}
                    >
                      {metrics.cpu.model}
                    </div>
                  </div>
                </div>

                {/* Per-Core Breakdown */}
                {metrics.cpu.perCoreUsage && metrics.cpu.perCoreUsage.length > 0 && (
                  <div className="pt-2 border-t border-zinc-200/70 dark:border-zinc-800/60 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400">
                      Per-Core Breakdown
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 font-mono text-[10px]">
                      {metrics.cpu.perCoreUsage.map((coreUsage, idx) => (
                        <div
                          key={idx}
                          className="p-1 bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg flex flex-col items-center justify-center space-y-0.5"
                          title={`Core ${idx + 1}: ${coreUsage}%`}
                        >
                          <span className="text-[9px] text-zinc-600 dark:text-zinc-400">C{idx + 1}</span>
                          <span className={`font-bold ${getUsageColor(coreUsage)}`}>
                            {Math.round(coreUsage)}%
                          </span>
                          <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1 overflow-hidden mt-0.5">
                            <div
                              className={`h-1 rounded-full ${getUsageBg(coreUsage)}`}
                              style={{ width: `${Math.min(100, Math.max(5, coreUsage))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Memory Tile */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Host Memory Usage
                      </span>
                    </div>
                    <span
                      className={`text-2xl font-black font-mono tracking-tight ${getUsageColor(
                        metrics.memory.usagePercent
                      )}`}
                    >
                      {metrics.memory.usagePercent.toFixed(1)}%
                    </span>
                  </div>

                  {/* Main Memory Bar */}
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${getUsageBg(
                        metrics.memory.usagePercent
                      )}`}
                      style={{ width: `${Math.min(100, Math.max(2, metrics.memory.usagePercent))}%` }}
                    />
                  </div>

                  {/* Memory Details */}
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-zinc-200/70 dark:border-zinc-800/60">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400">
                        Used Memory
                      </span>
                      <div className="font-mono font-semibold text-zinc-900 dark:text-zinc-200">
                        {formatBytes(metrics.memory.usedBytes)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400">
                        Free / Available
                      </span>
                      <div className="font-mono font-semibold text-zinc-900 dark:text-zinc-200">
                        {formatBytes(metrics.memory.freeBytes)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400">
                        Total Installed
                      </span>
                      <div className="font-mono font-semibold text-zinc-900 dark:text-zinc-200">
                        {formatBytes(metrics.memory.totalBytes)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Memory Status Pill */}
                <div className="pt-3 border-t border-zinc-200/70 dark:border-zinc-800/60 flex items-center justify-between text-xs">
                  <span className="text-zinc-600 dark:text-zinc-400">Memory Pressure Status</span>
                  <span
                    className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                      metrics.memory.usagePercent < 75
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : metrics.memory.usagePercent < 90
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {metrics.memory.usagePercent < 75
                      ? 'Optimal (Normal Pressure)'
                      : metrics.memory.usagePercent < 90
                      ? 'Elevated Memory Usage'
                      : 'Critical Memory Pressure'}
                  </span>
                </div>
              </div>
            </div>

            {/* Host Metadata Ribbon */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl text-xs font-mono text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center space-x-2">
                <Clock className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                <span>Host Uptime:</span>
                <span className="text-zinc-900 dark:text-zinc-200 font-semibold font-mono">
                  {formatUptime(metrics.uptimeSeconds)}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span>Hostname:</span>
                <span className="text-zinc-900 dark:text-zinc-200 font-semibold font-mono">
                  {metrics.hostname}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span>Platform:</span>
                <span className="text-zinc-900 dark:text-zinc-200 font-semibold font-mono">
                  {metrics.platform} ({metrics.arch})
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center min-h-[400px] flex flex-col items-center justify-center text-zinc-600 dark:text-zinc-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
            <span>Gathering host CPU and memory telemetry...</span>
          </div>
        )}
      </div>

      {/* SECTION 2: Container Engine Specifications Grid */}
      {systemInfo && (
        <div className="p-4 sm:p-6 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl space-y-4 transition-colors">
          <div className="flex items-center space-x-3 border-b border-zinc-200 dark:border-zinc-800/80 pb-3 sm:pb-4">
            <div className="p-2 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">Container Engine Specifications</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Node Architecture & Engine Runtime</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs font-mono">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800/60">
              <span className="text-zinc-500 text-[10px] uppercase font-sans font-bold">Engine Version</span>
              <div className="text-zinc-900 dark:text-zinc-200 font-bold mt-1 text-sm">{systemInfo.ServerVersion}</div>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800/60">
              <span className="text-zinc-500 text-[10px] uppercase font-sans font-bold">Host OS / Kernel</span>
              <div className="text-zinc-900 dark:text-zinc-200 font-bold mt-1 text-sm truncate" title={systemInfo.OperatingSystem}>
                {systemInfo.OperatingSystem}
              </div>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800/60">
              <span className="text-zinc-500 text-[10px] uppercase font-sans font-bold">CPU Cores</span>
              <div className="text-zinc-900 dark:text-zinc-200 font-bold mt-1 text-sm">{systemInfo.NCPU} Cores ({systemInfo.Architecture})</div>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800/60">
              <span className="text-zinc-500 text-[10px] uppercase font-sans font-bold">Host Total Memory</span>
              <div className="text-zinc-900 dark:text-zinc-200 font-bold mt-1 text-sm">{formatBytes(systemInfo.MemTotal)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Disk Space Breakdown */}
      <div className="p-4 sm:p-6 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl border border-amber-500/20 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Engine Disk Usage</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total space consumed by images, containers, and volumes</p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={handleOpenMaintenance}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 text-xs font-semibold transition-all self-start sm:self-auto"
              title="Open Maintenance to clean up or schedule garbage collection"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Go to Maintenance</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {diskUsage ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-800 dark:text-zinc-300 flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span>Images</span>
                </span>
                <span className="font-mono text-zinc-500 dark:text-zinc-400">{diskUsage.Images?.length || 0} Total</span>
              </div>
              <div className="text-xl font-black text-zinc-900 dark:text-white font-mono">
                {formatBytes(
                  (diskUsage.Images || []).reduce((acc: number, img: any) => acc + (img.Size || 0), 0)
                )}
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-800 dark:text-zinc-300 flex items-center space-x-2">
                  <Box className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  <span>Containers</span>
                </span>
                <span className="font-mono text-zinc-500 dark:text-zinc-400">{diskUsage.Containers?.length || 0} Total</span>
              </div>
              <div className="text-xl font-black text-zinc-900 dark:text-white font-mono">
                {formatBytes(
                  (diskUsage.Containers || []).reduce((acc: number, c: any) => acc + (c.SizeRw || 0), 0)
                )}
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-800 dark:text-zinc-300 flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>Volumes</span>
                </span>
                <span className="font-mono text-zinc-500 dark:text-zinc-400">{diskUsage.Volumes?.length || 0} Total</span>
              </div>
              <div className="text-xl font-black text-zinc-900 dark:text-white font-mono">
                {formatBytes(
                  (diskUsage.Volumes || []).reduce(
                    (acc: number, v: any) => acc + (v.UsageData?.Size || 0),
                    0
                  )
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-3 w-12 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
                <div className="h-7 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
