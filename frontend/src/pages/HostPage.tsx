import React, { useState, useEffect } from 'react';
import { SystemInfo } from '../types';
import { systemApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Cpu,
  HardDrive,
  Trash2,
  RefreshCw,
  Server,
  Layers,
  Box,
  CheckCircle2,
} from 'lucide-react';

interface HostPageProps {
  systemInfo: SystemInfo | null;
  onRefresh: () => void;
}

export const HostPage: React.FC<HostPageProps> = ({ systemInfo, onRefresh }) => {
  const { isAdmin } = useAuth();
  const [diskUsage, setDiskUsage] = useState<any>(null);
  const [pruneResult, setPruneResult] = useState<any>(null);
  const [pruning, setPruning] = useState<boolean>(false);
  const [pruneAll, setPruneAll] = useState<boolean>(false);
  const [pruneVolumes, setPruneVolumes] = useState<boolean>(false);

  const loadDf = async () => {
    try {
      const data = await systemApi.df();
      setDiskUsage(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadDf();
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handlePrune = async () => {
    if (!confirm('Run Docker System Prune? This will permanently delete unused Docker resources.')) return;
    setPruning(true);
    setPruneResult(null);
    try {
      const res = await systemApi.prune({ all: pruneAll, volumes: pruneVolumes });
      setPruneResult(res);
      loadDf();
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Prune failed');
    } finally {
      setPruning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Host Daemon & Disk Engine</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Host specifications, storage utilization & garbage collection</p>
        </div>

        <button
          onClick={() => {
            loadDf();
            onRefresh();
          }}
          className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors"
          title="Refresh host metrics"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Host Engine Specs Grid */}
      {systemInfo && (
        <div className="p-6 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl space-y-4 transition-colors">
          <div className="flex items-center space-x-3 border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
            <div className="p-2 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl border border-blue-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Docker Daemon Specifications</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Node Architecture & Engine Runtime</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
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

      {/* Disk Space Breakdown (docker system df) */}
      {diskUsage && (
        <div className="p-6 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl space-y-4 transition-colors">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl border border-amber-500/20">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Docker Disk Usage (docker system df)</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Total space consumed by images, containers, and volumes</p>
              </div>
            </div>
          </div>

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
        </div>
      )}

      {/* System Prune Section (Admin only) */}
      {isAdmin && (
        <div className="p-6 bg-white dark:bg-zinc-900/80 border border-red-500/20 rounded-2xl shadow-xl space-y-4 transition-colors">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-500/10 text-red-500 dark:text-red-400 rounded-xl border border-red-500/20">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">System Garbage Collection (Prune)</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Reclaim disk space by purging unused images, stopped containers & dangling networks</p>
            </div>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 text-xs">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="pruneAll"
                checked={pruneAll}
                onChange={(e) => setPruneAll(e.target.checked)}
                className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
              />
              <label htmlFor="pruneAll" className="text-zinc-800 dark:text-zinc-200 font-medium">
                Prune all unused images (not just dangling ones)
              </label>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="pruneVolumes"
                checked={pruneVolumes}
                onChange={(e) => setPruneVolumes(e.target.checked)}
                className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
              />
              <label htmlFor="pruneVolumes" className="text-zinc-800 dark:text-zinc-200 font-medium">
                Prune unused persistent volumes (Warning: data in unused volumes will be lost)
              </label>
            </div>
          </div>

          {pruneResult && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-300 font-mono space-y-1">
              <div className="font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Prune complete! Reclaimed disk space.</span>
              </div>
              <div>Space Reclaimed: {formatBytes(pruneResult.containers?.SpaceReclaimed || 0)}</div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handlePrune}
              disabled={pruning}
              className="flex items-center space-x-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 disabled:opacity-50 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>{pruning ? 'Pruning...' : 'Run System Prune'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
