import React, { useState, useEffect } from 'react';
import { ScalingInfo, ScalingPolicy } from '../../types';
import { scalingApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Boxes,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Clock,
  Sparkles,
  Loader2,
  Trash2,
  Layers,
  TrendingUp,
} from 'lucide-react';

export interface ScalePanelProps {
  containerId: string;
  containerName: string;
  onScaled?: () => void;
}

export const ScalePanel: React.FC<ScalePanelProps> = ({
  containerId,
  containerName,
  onScaled,
}) => {
  const { isOperator } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [scaling, setScaling] = useState<boolean>(false);
  const [savingPolicy, setSavingPolicy] = useState<boolean>(false);
  const [info, setInfo] = useState<ScalingInfo | null>(null);
  const [targetReplicas, setTargetReplicas] = useState<number>(1);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Autoscaling policy form state
  const [autoscaleEnabled, setAutoscaleEnabled] = useState<boolean>(false);
  const [minReplicas, setMinReplicas] = useState<number>(1);
  const [maxReplicas, setMaxReplicas] = useState<number>(3);
  const [cpuThreshold, setCpuThreshold] = useState<number>(80);
  const [memoryThreshold, setMemoryThreshold] = useState<number>(85);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(60);
  const [existingPolicy, setExistingPolicy] = useState<ScalingPolicy | null>(null);

  const loadInfo = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await scalingApi.getInfo(containerId || containerName);
      setInfo(data);
      setTargetReplicas(data.currentReplicas);

      if (data.policy) {
        setExistingPolicy(data.policy);
        setAutoscaleEnabled(data.policy.enabled);
        setMinReplicas(data.policy.minReplicas);
        setMaxReplicas(data.policy.maxReplicas);
        setCpuThreshold(data.policy.cpuThreshold);
        setMemoryThreshold(data.policy.memoryThreshold);
        setCooldownSeconds(data.policy.cooldownSeconds);
      } else {
        setExistingPolicy(null);
        setAutoscaleEnabled(false);
        setMinReplicas(1);
        setMaxReplicas(3);
        setCpuThreshold(80);
        setMemoryThreshold(85);
        setCooldownSeconds(60);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to inspect container scaling');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfo();
  }, [containerId, containerName]);

  const handleManualScale = async () => {
    if (!info) return;
    setScaling(true);
    setError('');
    setSuccess('');
    try {
      await scalingApi.scale(info.baseName, targetReplicas);
      setSuccess(`Successfully scaled to ${targetReplicas} replica(s).`);
      await loadInfo();
      if (onScaled) onScaled();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to scale container');
    } finally {
      setScaling(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    setSavingPolicy(true);
    setError('');
    setSuccess('');
    try {
      if (existingPolicy) {
        const updated = await scalingApi.updatePolicy(existingPolicy.id, {
          enabled: autoscaleEnabled,
          minReplicas,
          maxReplicas,
          cpuThreshold,
          memoryThreshold,
          cooldownSeconds,
        });
        setExistingPolicy(updated);
        setSuccess('Autoscaling policy updated.');
      } else {
        const created = await scalingApi.createPolicy({
          name: `Autoscale ${info.baseName}`,
          targetType: 'container',
          targetId: info.baseName,
          enabled: autoscaleEnabled,
          minReplicas,
          maxReplicas,
          cpuThreshold,
          memoryThreshold,
          cooldownSeconds,
        });
        setExistingPolicy(created);
        setSuccess('Autoscaling policy created and active.');
      }
      await loadInfo();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save autoscaling policy');
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleDeletePolicy = async () => {
    if (!existingPolicy) return;
    if (!confirm('Are you sure you want to delete this autoscaling policy?')) return;
    setSavingPolicy(true);
    try {
      await scalingApi.deletePolicy(existingPolicy.id);
      setExistingPolicy(null);
      setAutoscaleEnabled(false);
      setSuccess('Autoscaling policy removed.');
      await loadInfo();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete policy');
    } finally {
      setSavingPolicy(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-3 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        <p className="text-xs font-mono">Analyzing container scaling eligibility & active policies...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs select-text">
      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-start space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {info && (
        <>
          {/* Port & Strategy Eligibility Card */}
          <div
            className={`p-4 rounded-2xl border text-xs space-y-2 ${
              info.hasHostPortConflict
                ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                : 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
            }`}
          >
            <div className="flex items-center space-x-2 font-bold">
              {info.hasHostPortConflict ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Host Port Collision Handled (Internal Network Scaling)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Direct Scaling Eligible (No Host Port Collisions)</span>
                </>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {info.reason}
            </p>
            {info.networks && info.networks.length > 0 && (
              <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center space-x-1">
                <span>Attached Networks:</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {info.networks.join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Active Replicas Card */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>Active Replicas ({info.replicas.length})</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                Base Name: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{info.baseName}</span>
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-xs">
              {info.replicas.map((r, idx) => (
                <div
                  key={r.id}
                  className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-400 text-[10px]">#{idx + 1}</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{r.name}</span>
                    {idx === 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[9px] uppercase font-bold">
                        Primary
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${
                      r.state === 'running'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {r.state}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Manual Scale Stepper */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                  Manual Scaling Control
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Clone or terminate container replicas dynamically
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  disabled={targetReplicas <= 1 || scaling || !isOperator}
                  onClick={() => setTargetReplicas((prev) => Math.max(1, prev - 1))}
                  className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                  title="Decrease replica count"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="w-16 text-center">
                  <span className="text-xl font-black text-zinc-900 dark:text-white font-mono">
                    {targetReplicas}
                  </span>
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Replicas</div>
                </div>

                <button
                  type="button"
                  disabled={targetReplicas >= 20 || scaling || !isOperator}
                  onClick={() => setTargetReplicas((prev) => Math.min(20, prev + 1))}
                  className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                  title="Increase replica count"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  disabled={targetReplicas === info.currentReplicas || scaling || !isOperator}
                  onClick={handleManualScale}
                  className="ml-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 disabled:opacity-40 transition-all flex items-center space-x-1.5 shrink-0"
                >
                  {scaling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Applying...</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Apply</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Autoscaling Policy Form */}
          <form onSubmit={handleSavePolicy} className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                  Metric-Driven Autoscaler Daemon
                </span>
              </div>

              <button
                type="button"
                onClick={() => setAutoscaleEnabled(!autoscaleEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  autoscaleEnabled ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoscaleEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {autoscaleEnabled && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Min Replicas
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={maxReplicas}
                      value={minReplicas}
                      onChange={(e) => setMinReplicas(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Max Replicas
                    </label>
                    <input
                      type="number"
                      min={minReplicas}
                      max={20}
                      value={maxReplicas}
                      onChange={(e) => setMaxReplicas(Math.max(minReplicas, parseInt(e.target.value, 10) || 1))}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                      <Cpu className="w-3.5 h-3.5 text-blue-500" />
                      <span>CPU Scale-Up (&gt; %)</span>
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={cpuThreshold}
                      onChange={(e) => setCpuThreshold(parseInt(e.target.value, 10) || 80)}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                      <Database className="w-3.5 h-3.5 text-emerald-500" />
                      <span>RAM Scale-Up (&gt; %)</span>
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={memoryThreshold}
                      onChange={(e) => setMemoryThreshold(parseInt(e.target.value, 10) || 85)}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Cooldown Window (Seconds)</span>
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={600}
                    value={cooldownSeconds}
                    onChange={(e) => setCooldownSeconds(parseInt(e.target.value, 10) || 60)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Minimum quiet period between successive auto-scale events to prevent flapping.
                  </span>
                </div>

                {existingPolicy && existingPolicy.lastScaleAction && (
                  <div className="p-2.5 rounded-xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-700 dark:text-purple-300 space-y-0.5">
                    <div className="font-bold">
                      Last Trigger: {existingPolicy.lastScaleAction} (
                      {existingPolicy.lastScaleAt ? new Date(existingPolicy.lastScaleAt).toLocaleTimeString() : 'N/A'})
                    </div>
                    <div className="text-[10px] opacity-80">{existingPolicy.lastScaleReason}</div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  {existingPolicy ? (
                    <button
                      type="button"
                      onClick={handleDeletePolicy}
                      className="flex items-center space-x-1 text-xs text-red-500 hover:text-red-400 font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Policy</span>
                    </button>
                  ) : <div />}

                  <button
                    type="submit"
                    disabled={savingPolicy || !isOperator}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 disabled:opacity-40 transition-all flex items-center space-x-1.5"
                  >
                    {savingPolicy ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Save Policy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </>
      )}
    </div>
  );
};
