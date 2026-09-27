import React, { useState, useEffect } from 'react';
import { SystemInfo, CleanupSchedule, CreateCleanupScheduleInput } from '../types';
import { systemApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CleanupScheduleModal } from '../components/host/CleanupScheduleModal';
import {
  Cpu,
  HardDrive,
  Trash2,
  RefreshCw,
  Server,
  Layers,
  Box,
  CheckCircle2,
  Calendar,
  Clock,
  Play,
  Edit2,
  Plus,
  Network,
  Sparkles,
  AlertTriangle,
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
  const [pruneAll, setPruneAll] = useState<boolean>(true);
  const [pruneVolumes, setPruneVolumes] = useState<boolean>(false);

  // Schedules state
  const [schedules, setSchedules] = useState<CleanupSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSchedule, setEditingSchedule] = useState<CleanupSchedule | null>(null);
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);

  const loadDf = async () => {
    try {
      const data = await systemApi.df();
      setDiskUsage(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSchedules = async () => {
    if (!isAdmin) return;
    setLoadingSchedules(true);
    try {
      const list = await systemApi.getCleanupSchedules();
      setSchedules(list);
    } catch (err) {
      console.error('Failed to load cleanup schedules', err);
    } finally {
      setLoadingSchedules(false);
    }
  };

  useEffect(() => {
    loadDf();
    if (isAdmin) {
      loadSchedules();
    }
  }, [isAdmin]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Never';
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  const handlePrune = async () => {
    if (!confirm('Run System Prune? This will permanently delete unused container resources.')) return;
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

  const handleSaveSchedule = async (data: CreateCleanupScheduleInput, scheduleId?: string) => {
    if (scheduleId) {
      await systemApi.updateCleanupSchedule(scheduleId, data);
    } else {
      await systemApi.createCleanupSchedule(data);
    }
    await loadSchedules();
  };

  const handleToggleSchedule = async (id: string) => {
    try {
      await systemApi.toggleCleanupSchedule(id);
      await loadSchedules();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to toggle schedule');
    }
  };

  const handleRunScheduleNow = async (id: string, name: string) => {
    if (!confirm(`Run cleanup schedule "${name}" now?`)) return;
    setRunningScheduleId(id);
    try {
      const res = await systemApi.runCleanupSchedule(id);
      const reclaimed = res.summary?.spaceReclaimed || 0;
      alert(`Cleanup completed successfully! Reclaimed ${formatBytes(reclaimed)}.`);
      loadDf();
      await loadSchedules();
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to execute schedule');
    } finally {
      setRunningScheduleId(null);
    }
  };

  const handleDeleteSchedule = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete cleanup schedule "${name}"?`)) return;
    try {
      await systemApi.deleteCleanupSchedule(id);
      await loadSchedules();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete schedule');
    }
  };

  const openCreateModal = () => {
    setEditingSchedule(null);
    setIsModalOpen(true);
  };

  const openEditModal = (schedule: CleanupSchedule) => {
    setEditingSchedule(schedule);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Host Daemon & Disk Engine</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Host specifications, storage utilization, automated cleanup scheduler & garbage collection
          </p>
        </div>

        <button
          onClick={() => {
            loadDf();
            loadSchedules();
            onRefresh();
          }}
          className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors self-start sm:self-auto"
          title="Refresh host metrics"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Host Engine Specs Grid */}
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
      {diskUsage && (
        <div className="p-4 sm:p-6 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl space-y-4 transition-colors">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl border border-amber-500/20">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Engine Disk Usage (System Storage Reclaim)</h3>
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

      {/* Auto Clean-Up Schedules Section (Admin only) */}
      {isAdmin && (
        <div className="p-4 sm:p-6 bg-white dark:bg-zinc-900/80 border border-indigo-500/20 rounded-2xl shadow-xl space-y-4 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800/80 pb-3 sm:pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">Automated Clean-Up Scheduler</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Configure recurring or one-time automated garbage collection tasks for container resources
                </p>
              </div>
            </div>

            <button
              onClick={openCreateModal}
              className="flex items-center space-x-2 px-3.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all self-start sm:self-auto shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Clean-Up Schedule</span>
            </button>
          </div>

          {/* Schedules Table */}
          {loadingSchedules ? (
            <div className="text-center py-8 text-xs text-zinc-500">Loading schedules...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl space-y-2">
              <Calendar className="w-8 h-8 text-zinc-400 mx-auto" />
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">No automated clean-up schedules configured</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Create a recurring or one-time schedule to automatically reclaim disk space from unused container resources.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold">
                    <th className="pb-3 px-3">Schedule Name</th>
                    <th className="pb-3 px-3">Clean Targets</th>
                    <th className="pb-3 px-3">Frequency / Type</th>
                    <th className="pb-3 px-3">Next Run</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3">Last Run & Reclaimed</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-medium">
                  {schedules.map((schedule) => {
                    const isRunning = runningScheduleId === schedule.id;
                    let reclaimed = 0;
                    if (schedule.lastRunSummary) {
                      try {
                        const parsed = JSON.parse(schedule.lastRunSummary);
                        reclaimed = parsed.spaceReclaimed || 0;
                      } catch {}
                    }

                    return (
                      <tr key={schedule.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-zinc-900 dark:text-white">{schedule.name}</div>
                          <div className="text-[10px] text-zinc-400 font-mono">ID: {schedule.id.slice(0, 8)}...</div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1.5">
                            {schedule.cleanImages && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-mono font-semibold">
                                <Layers className="w-3 h-3" />
                                <span>Images ({schedule.cleanImagesMode})</span>
                              </span>
                            )}
                            {schedule.cleanVolumes && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-mono font-semibold">
                                <HardDrive className="w-3 h-3" />
                                <span>Volumes</span>
                              </span>
                            )}
                            {schedule.cleanNetworks && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-semibold">
                                <Network className="w-3 h-3" />
                                <span>Networks</span>
                              </span>
                            )}
                            {schedule.cleanContainers && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-mono font-semibold">
                                <Box className="w-3 h-3" />
                                <span>Containers</span>
                              </span>
                            )}
                            {schedule.cleanBuildCache && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-mono font-semibold">
                                <Sparkles className="w-3 h-3" />
                                <span>Cache</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {schedule.scheduleType === 'recurring' ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-[10px] font-semibold">
                                <RefreshCw className="w-3 h-3 text-indigo-500" />
                                <span>Recurring</span>
                              </span>
                              <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                                {schedule.cronExpression}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-[10px] font-semibold">
                                <Clock className="w-3 h-3 text-amber-500" />
                                <span>Run Once</span>
                              </span>
                              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {formatDate(schedule.scheduledAt)}
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-mono text-zinc-800 dark:text-zinc-200">
                            {formatDate(schedule.nextRunAt)}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleToggleSchedule(schedule.id)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                              schedule.enabled
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/20'
                            }`}
                            title="Click to toggle active status"
                          >
                            {schedule.enabled ? 'Active' : 'Disabled'}
                          </button>
                        </td>

                        <td className="py-3 px-3">
                          {schedule.lastRunAt ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-1 text-zinc-700 dark:text-zinc-300">
                                {schedule.lastRunStatus === 'success' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                )}
                                <span className="font-semibold">{formatBytes(reclaimed)} freed</span>
                              </div>
                              <div className="text-[10px] text-zinc-400">{formatDate(schedule.lastRunAt)}</div>
                            </div>
                          ) : (
                            <span className="text-zinc-400 text-xs">Never executed</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleRunScheduleNow(schedule.id, schedule.name)}
                              disabled={isRunning}
                              className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors disabled:opacity-50"
                              title="Run clean-up now"
                            >
                              <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
                            </button>

                            <button
                              onClick={() => openEditModal(schedule)}
                              className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                              title="Edit schedule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteSchedule(schedule.id, schedule.name)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
                              title="Delete schedule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* System Prune Section (Manual Prune, Admin only) */}
      {isAdmin && (
        <div className="p-6 bg-white dark:bg-zinc-900/80 border border-red-500/20 rounded-2xl shadow-xl space-y-4 transition-colors">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-500/10 text-red-500 dark:text-red-400 rounded-xl border border-red-500/20">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Manual Garbage Collection (Prune)</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Instantly reclaim disk space by purging unused images, stopped containers & dangling networks</p>
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
              <label htmlFor="pruneAll" className="text-zinc-800 dark:text-zinc-200 font-medium cursor-pointer">
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
              <label htmlFor="pruneVolumes" className="text-zinc-800 dark:text-zinc-200 font-medium cursor-pointer">
                Prune unused persistent volumes (Warning: data in unused volumes will be lost)
              </label>
            </div>
          </div>

          {pruneResult && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-300 font-mono space-y-1.5">
              <div className="font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Prune complete! Reclaimed disk space.</span>
              </div>
              {(() => {
                const total =
                  pruneResult.totalSpaceReclaimed !== undefined
                    ? pruneResult.totalSpaceReclaimed
                    : (pruneResult.containers?.SpaceReclaimed || 0) +
                      (pruneResult.images?.SpaceReclaimed || 0) +
                      (pruneResult.volumes?.SpaceReclaimed || 0);
                const imagesCount = pruneResult.images?.ImagesDeleted?.length || 0;
                const containersCount = pruneResult.containers?.ContainersDeleted?.length || 0;
                const volumesCount = pruneResult.volumes?.VolumesDeleted?.length || 0;
                return (
                  <div className="space-y-0.5 text-[11px] text-zinc-700 dark:text-zinc-300">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      Total Space Reclaimed: {formatBytes(total)}
                    </div>
                    {imagesCount > 0 && <div>• Images Deleted: {imagesCount}</div>}
                    {containersCount > 0 && <div>• Stopped Containers Deleted: {containersCount}</div>}
                    {volumesCount > 0 && <div>• Volumes Deleted: {volumesCount}</div>}
                    {imagesCount === 0 && containersCount === 0 && volumesCount === 0 && total === 0 && (
                      <div className="text-zinc-500">No unreferenced resources found to reclaim.</div>
                    )}
                  </div>
                );
              })()}
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

      {/* Schedule Modal */}
      <CleanupScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSchedule}
        editingSchedule={editingSchedule}
      />
    </div>
  );
};
