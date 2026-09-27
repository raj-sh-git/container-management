import React, { useState, useEffect } from 'react';
import { CleanupSchedule, CreateCleanupScheduleInput } from '../types';
import { systemApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CleanupScheduleModal } from '../components/host/CleanupScheduleModal';
import {
  Wrench,
  Trash2,
  RefreshCw,
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
  HardDrive,
  ShieldAlert,
} from 'lucide-react';

interface MaintenancePageProps {
  onRefresh?: () => void;
}

export const MaintenancePage: React.FC<MaintenancePageProps> = ({ onRefresh }) => {
  const { isAdmin } = useAuth();
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
      if (onRefresh) onRefresh();
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
      await loadSchedules();
      if (onRefresh) onRefresh();
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

  if (!isAdmin) {
    return (
      <div className="p-8 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
        <ShieldAlert className="w-12 h-12 text-yellow-500" />
        <h3 className="text-base font-bold text-zinc-900 dark:text-white">Administrator Access Required</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
          System Maintenance, garbage collection, and clean-up schedules can only be managed by system administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 select-text">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-500/20 shrink-0">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              Maintenance
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Automated clean-up scheduler & manual container garbage collection (pruning)
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            loadSchedules();
            if (onRefresh) onRefresh();
          }}
          disabled={loadingSchedules}
          className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors self-start sm:self-auto disabled:opacity-50"
          title="Refresh maintenance telemetry"
        >
          <RefreshCw className={`w-4 h-4 ${loadingSchedules ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Automated Clean-Up Scheduler Section */}
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

      {/* Manual Garbage Collection (Prune) Section */}
      <div className="p-6 bg-white dark:bg-zinc-900/80 border border-red-500/20 rounded-2xl shadow-xl space-y-4 transition-colors">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-500/10 text-red-500 dark:text-red-400 rounded-xl border border-red-500/20 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">Manual Garbage Collection (Prune)</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Instantly reclaim disk space by purging unused images, stopped containers & dangling networks
            </p>
          </div>
        </div>

        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 text-xs">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="maintPruneAll"
              checked={pruneAll}
              onChange={(e) => setPruneAll(e.target.checked)}
              className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
            />
            <label htmlFor="maintPruneAll" className="text-zinc-800 dark:text-zinc-200 font-medium cursor-pointer">
              Prune all unused images (not just dangling ones)
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="maintPruneVolumes"
              checked={pruneVolumes}
              onChange={(e) => setPruneVolumes(e.target.checked)}
              className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
            />
            <label htmlFor="maintPruneVolumes" className="text-zinc-800 dark:text-zinc-200 font-medium cursor-pointer">
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
