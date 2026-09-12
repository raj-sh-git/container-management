import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Layers, HardDrive, Network, Box, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { CleanupSchedule, CreateCleanupScheduleInput } from '../../types';

interface CleanupScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateCleanupScheduleInput, scheduleId?: string) => Promise<void>;
  editingSchedule?: CleanupSchedule | null;
}

export const CleanupScheduleModal: React.FC<CleanupScheduleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingSchedule,
}) => {
  const [name, setName] = useState('');
  const [cleanImages, setCleanImages] = useState(true);
  const [cleanImagesMode, setCleanImagesMode] = useState<'all' | 'dangling'>('all');
  const [cleanVolumes, setCleanVolumes] = useState(false);
  const [cleanNetworks, setCleanNetworks] = useState(true);
  const [cleanContainers, setCleanContainers] = useState(true);
  const [cleanBuildCache, setCleanBuildCache] = useState(true);
  
  const [scheduleType, setScheduleType] = useState<'recurring' | 'once'>('recurring');
  const [cronPreset, setCronPreset] = useState<'hourly' | 'daily' | 'nightly' | 'weekly' | 'monthly' | 'custom'>('nightly');
  const [cronExpression, setCronExpression] = useState('0 3 * * *');
  const [runOnceDate, setRunOnceDate] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingSchedule) {
      setName(editingSchedule.name);
      setCleanImages(Boolean(editingSchedule.cleanImages));
      setCleanImagesMode(editingSchedule.cleanImagesMode || 'all');
      setCleanVolumes(Boolean(editingSchedule.cleanVolumes));
      setCleanNetworks(Boolean(editingSchedule.cleanNetworks));
      setCleanContainers(Boolean(editingSchedule.cleanContainers));
      setCleanBuildCache(Boolean(editingSchedule.cleanBuildCache));
      setScheduleType(editingSchedule.scheduleType);
      setEnabled(Boolean(editingSchedule.enabled));

      if (editingSchedule.scheduleType === 'recurring') {
        const cron = editingSchedule.cronExpression || '0 3 * * *';
        setCronExpression(cron);
        if (cron === '0 * * * *') setCronPreset('hourly');
        else if (cron === '0 0 * * *') setCronPreset('daily');
        else if (cron === '0 3 * * *') setCronPreset('nightly');
        else if (cron === '0 0 * * 0') setCronPreset('weekly');
        else if (cron === '0 0 1 * *') setCronPreset('monthly');
        else setCronPreset('custom');
      } else if (editingSchedule.scheduleType === 'once' && editingSchedule.scheduledAt) {
        // Convert ISO string to format YYYY-MM-DDTHH:MM for datetime-local
        try {
          const d = new Date(editingSchedule.scheduledAt);
          const formatted = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setRunOnceDate(formatted);
        } catch {
          setRunOnceDate('');
        }
      }
    } else {
      // Default reset
      setName('');
      setCleanImages(true);
      setCleanImagesMode('all');
      setCleanVolumes(false);
      setCleanNetworks(true);
      setCleanContainers(true);
      setCleanBuildCache(true);
      setScheduleType('recurring');
      setCronPreset('nightly');
      setCronExpression('0 3 * * *');
      
      // Default once date: 1 hour from now
      const defaultDate = new Date(Date.now() + 3600 * 1000);
      const formatted = new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setRunOnceDate(formatted);
      setEnabled(true);
      setError('');
    }
  }, [editingSchedule, isOpen]);

  if (!isOpen) return null;

  const handlePresetChange = (preset: 'hourly' | 'daily' | 'nightly' | 'weekly' | 'monthly' | 'custom') => {
    setCronPreset(preset);
    switch (preset) {
      case 'hourly':
        setCronExpression('0 * * * *');
        break;
      case 'daily':
        setCronExpression('0 0 * * *');
        break;
      case 'nightly':
        setCronExpression('0 3 * * *');
        break;
      case 'weekly':
        setCronExpression('0 0 * * 0');
        break;
      case 'monthly':
        setCronExpression('0 0 1 * *');
        break;
      case 'custom':
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!cleanImages && !cleanVolumes && !cleanNetworks && !cleanContainers && !cleanBuildCache) {
      setError('Please select at least one resource category to clean.');
      return;
    }

    let finalCron: string | undefined = undefined;
    let finalOnceAt: string | undefined = undefined;

    if (scheduleType === 'recurring') {
      if (!cronExpression.trim()) {
        setError('Please enter a valid cron expression.');
        return;
      }
      finalCron = cronExpression.trim();
    } else {
      if (!runOnceDate) {
        setError('Please select a valid execution date and time.');
        return;
      }
      const parsedDate = new Date(runOnceDate);
      if (isNaN(parsedDate.getTime())) {
        setError('Invalid date/time format.');
        return;
      }
      if (parsedDate.getTime() <= Date.now()) {
        setError('One-time execution date must be in the future.');
        return;
      }
      finalOnceAt = parsedDate.toISOString();
    }

    const payload: CreateCleanupScheduleInput = {
      name: name.trim() || (scheduleType === 'recurring' ? 'Automated Clean-Up' : 'One-Time Clean-Up'),
      cleanImages,
      cleanImagesMode,
      cleanVolumes,
      cleanNetworks,
      cleanContainers,
      cleanBuildCache,
      scheduleType,
      frequencyPreset: scheduleType === 'recurring' ? cronPreset : 'once',
      cronExpression: finalCron,
      scheduledAt: finalOnceAt,
      enabled,
    };

    setSubmitting(true);
    try {
      await onSave(payload, editingSchedule?.id);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save cleanup schedule');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-white">
                {editingSchedule ? 'Edit Clean-Up Schedule' : 'Schedule Auto Clean-Up'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Automate Docker garbage collection with recurring or one-time schedules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Schedule Name */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              Schedule Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nightly Engine Deep Clean"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-200 font-medium focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Resource Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Target Resources to Clean
            </label>

            <div className="space-y-2.5 bg-zinc-50 dark:bg-zinc-950/60 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              {/* Images */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cleanImages}
                      onChange={(e) => setCleanImages(e.target.checked)}
                      className="rounded bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0"
                    />
                    <span className="flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Unused Images</span>
                    </span>
                  </label>
                </div>

                {cleanImages && (
                  <div className="ml-6 pl-3 border-l-2 border-indigo-500/30 flex items-center space-x-4 text-xs">
                    <label className="flex items-center space-x-2 text-zinc-600 dark:text-zinc-400 cursor-pointer">
                      <input
                        type="radio"
                        name="imageMode"
                        value="all"
                        checked={cleanImagesMode === 'all'}
                        onChange={() => setCleanImagesMode('all')}
                        className="text-indigo-600 focus:ring-0"
                      />
                      <span>All unused images</span>
                    </label>
                    <label className="flex items-center space-x-2 text-zinc-600 dark:text-zinc-400 cursor-pointer">
                      <input
                        type="radio"
                        name="imageMode"
                        value="dangling"
                        checked={cleanImagesMode === 'dangling'}
                        onChange={() => setCleanImagesMode('dangling')}
                        className="text-indigo-600 focus:ring-0"
                      />
                      <span>Dangling only (&lt;none&gt;)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Volumes */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cleanVolumes}
                    onChange={(e) => setCleanVolumes(e.target.checked)}
                    className="rounded bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0"
                  />
                  <span className="flex items-center space-x-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-amber-500" />
                    <span>Unused Volumes</span>
                  </span>
                </label>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                  (Deletes unreferenced volume data)
                </span>
              </div>

              {/* Networks */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cleanNetworks}
                    onChange={(e) => setCleanNetworks(e.target.checked)}
                    className="rounded bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0"
                  />
                  <span className="flex items-center space-x-1.5">
                    <Network className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Unused Networks</span>
                  </span>
                </label>
              </div>

              {/* Containers */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cleanContainers}
                    onChange={(e) => setCleanContainers(e.target.checked)}
                    className="rounded bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0"
                  />
                  <span className="flex items-center space-x-1.5">
                    <Box className="w-3.5 h-3.5 text-blue-500" />
                    <span>Stopped / Exited Containers</span>
                  </span>
                </label>
              </div>

              {/* Build Cache */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cleanBuildCache}
                    onChange={(e) => setCleanBuildCache(e.target.checked)}
                    className="rounded bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0"
                  />
                  <span className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span>Docker Build Cache</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Schedule Type Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Execution Frequency
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScheduleType('recurring')}
                className={`flex items-center justify-center space-x-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                  scheduleType === 'recurring'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/25'
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recurring Schedule</span>
              </button>

              <button
                type="button"
                onClick={() => setScheduleType('once')}
                className={`flex items-center justify-center space-x-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                  scheduleType === 'once'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/25'
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Run Once</span>
              </button>
            </div>

            {/* Recurring Options */}
            {scheduleType === 'recurring' && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                    Frequency Preset
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { id: 'hourly', label: 'Every Hour', cron: '0 * * * *' },
                      { id: 'daily', label: 'Daily (Midnight)', cron: '0 0 * * *' },
                      { id: 'nightly', label: 'Nightly (3:00 AM)', cron: '0 3 * * *' },
                      { id: 'weekly', label: 'Weekly (Sun 00:00)', cron: '0 0 * * 0' },
                      { id: 'monthly', label: 'Monthly (1st 00:00)', cron: '0 0 1 * *' },
                      { id: 'custom', label: 'Custom Cron', cron: cronExpression },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePresetChange(p.id as any)}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          cronPreset === p.id
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="text-[11px] font-semibold">{p.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Cron Expression (Minute Hour Day-of-Month Month Day-of-Week)
                  </label>
                  <input
                    type="text"
                    required
                    value={cronExpression}
                    onChange={(e) => {
                      setCronExpression(e.target.value);
                      setCronPreset('custom');
                    }}
                    placeholder="0 3 * * *"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 block">
                    e.g. <code className="font-mono">0 3 * * *</code> executes every night at 03:00 UTC.
                  </span>
                </div>
              </div>
            )}

            {/* Run Once Option */}
            {scheduleType === 'once' && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                  Target Execution Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={runOnceDate}
                  onChange={(e) => setRunOnceDate(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">
                  The engine will automatically execute this cleanup once at the specified time, then mark it completed.
                </span>
              </div>
            )}
          </div>

          {/* Enabled Status Toggle */}
          <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div>
              <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Active Status</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Enable or disable this automated cleanup schedule
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                enabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center space-x-2"
            >
              <Calendar className="w-4 h-4" />
              <span>{submitting ? 'Saving...' : editingSchedule ? 'Update Schedule' : 'Create Schedule'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
