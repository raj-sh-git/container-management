import React, { useState } from 'react';
import { Container, DockerImage, DockerNetwork, ScanReport } from '../types';
import { containersApi, securityApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { WebTerminal } from '../components/terminal/WebTerminal';
import { LogsViewer } from '../components/logs/LogsViewer';
import { StatsCards } from '../components/stats/StatsCards';
import { ReportViewer } from '../components/security/ReportViewer';
import {
  Box,
  Play,
  Square,
  RefreshCw,
  Pause,
  Trash2,
  Terminal,
  Activity,
  ShieldAlert,
  Search,
  Plus,
  MoreVertical,
  Code,
  FileText,
  Clock,
  Layers,
  CheckSquare,
  X,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface ContainersPageProps {
  containers: Container[];
  images: DockerImage[];
  networks: DockerNetwork[];
  reports: ScanReport[];
  onRefresh: () => void;
  onOpenCreateModal: () => void;
  onOpenScanModal: (target: { type: 'container'; name: string; id: string }) => void;
  selectedContainerForDetail?: Container | null;
  initialDetailTab?: string;
}

export const ContainersPage: React.FC<ContainersPageProps> = ({
  containers,
  images,
  networks,
  reports,
  onRefresh,
  onOpenCreateModal,
  onOpenScanModal,
  selectedContainerForDetail,
  initialDetailTab,
}) => {
  const { isOperator } = useAuth();
  const [filterState, setFilterState] = useState<'all' | 'running' | 'stopped'>('all');
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeContainer, setActiveContainer] = useState<Container | null>(
    selectedContainerForDetail || null
  );
  const [detailTab, setDetailTab] = useState<'overview' | 'terminal' | 'logs' | 'stats' | 'inspect'>(
    (initialDetailTab as any) || 'overview'
  );
  const [inspectData, setInspectData] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [scanningMap, setScanningMap] = useState<Record<string, boolean>>({});

  // Synchronize when parent passes selected container
  React.useEffect(() => {
    if (selectedContainerForDetail) {
      setActiveContainer(selectedContainerForDetail);
      if (initialDetailTab) {
        setDetailTab(initialDetailTab as any);
      }
    }
  }, [selectedContainerForDetail, initialDetailTab]);

  const filteredContainers = containers.filter((c) => {
    const matchesState =
      filterState === 'all'
        ? true
        : filterState === 'running'
        ? c.state === 'running'
        : c.state !== 'running';

    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.image.toLowerCase().includes(search.toLowerCase()) ||
      c.shortId.toLowerCase().includes(search.toLowerCase());

    return matchesState && matchesSearch;
  });

  const handleSelectAll = () => {
    if (selectedIds.length === filteredContainers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContainers.map((c) => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Container Lifecycle Actions
  const handleAction = async (action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'delete', id: string) => {
    const target = containers.find((c) => c.id === id);
    if (target?.isSelf && (action === 'stop' || action === 'restart' || action === 'delete')) {
      alert('Action blocked: Cannot stop, restart, or delete the Container Control Center platform itself.');
      return;
    }

    setActionLoading(id);
    try {
      if (action === 'start') await containersApi.start(id);
      else if (action === 'stop') await containersApi.stop(id);
      else if (action === 'restart') await containersApi.restart(id);
      else if (action === 'pause') await containersApi.pause(id);
      else if (action === 'unpause') await containersApi.unpause(id);
      else if (action === 'delete') {
        if (confirm('Are you sure you want to remove this container?')) {
          await containersApi.remove(id, true, true);
        }
      }
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Batch actions
  const handleBatchAction = async (action: 'start' | 'stop' | 'restart' | 'delete') => {
    if (selectedIds.length === 0) return;
    const actionableIds = selectedIds.filter((id) => {
      const c = containers.find((cnt) => cnt.id === id);
      return !c?.isSelf;
    });

    if (actionableIds.length === 0) {
      alert('Selected containers only contain the Control Center itself, which cannot be modified in batch.');
      return;
    }

    if (action === 'delete' && !confirm(`Remove ${actionableIds.length} selected containers?`)) return;

    for (const id of actionableIds) {
      try {
        if (action === 'start') await containersApi.start(id);
        else if (action === 'stop') await containersApi.stop(id);
        else if (action === 'restart') await containersApi.restart(id);
        else if (action === 'delete') await containersApi.remove(id, true, true);
      } catch {}
    }
    setSelectedIds([]);
    onRefresh();
  };

  const openInspect = async (c: Container) => {
    setActiveContainer(c);
    setDetailTab('inspect');
    try {
      const data = await containersApi.get(c.id);
      setInspectData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const getContainerReport = (c: Container) => {
    return reports.find((r) => r.targetId === c.id || r.targetName === c.name || r.targetName === c.image);
  };

  const handleDirectScan = async (c: Container) => {
    setScanningMap((prev) => ({ ...prev, [c.id]: true }));
    try {
      await securityApi.scan('container', c.name, c.id);
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to start container scan');
    } finally {
      setScanningMap((prev) => ({ ...prev, [c.id]: false }));
    }
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'running':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'paused':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'exited':
      case 'dead':
        return 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700';
      case 'restarting':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Container Operations</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Manage lifecycle, terminals, real-time logs & metrics</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onRefresh}
            className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors"
            title="Refresh containers"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isOperator && (
            <button
              onClick={onOpenCreateModal}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Container</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters and Batch Actions Header */}
      <div className="p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div className="flex flex-wrap items-center gap-2">
          {/* State Filters */}
          <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto max-w-full">
            <button
              onClick={() => setFilterState('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterState === 'all'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              All ({containers.length})
            </button>
            <button
              onClick={() => setFilterState('running')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterState === 'running'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Running ({containers.filter((c) => c.state === 'running').length})
            </button>
            <button
              onClick={() => setFilterState('stopped')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterState === 'stopped'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Stopped ({containers.filter((c) => c.state !== 'running').length})
            </button>
          </div>

          {/* Batch Actions */}
          {isOperator && selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pl-0 sm:pl-3 sm:border-l border-zinc-200 dark:border-zinc-800 mt-2 sm:mt-0">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold mr-1">
                {selectedIds.length} Selected:
              </span>
              <button
                onClick={() => handleBatchAction('start')}
                className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold"
              >
                Start
              </button>
              <button
                onClick={() => handleBatchAction('stop')}
                className="px-2.5 py-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold"
              >
                Stop
              </button>
              <button
                onClick={() => handleBatchAction('restart')}
                className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-lg text-xs font-semibold"
              >
                Restart
              </button>
              <button
                onClick={() => handleBatchAction('delete')}
                className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, image, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      {/* Main Containers Table */}
      <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length > 0 && selectedIds.length === filteredContainers.length
                    }
                    onChange={handleSelectAll}
                    className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
                  />
                </th>
                <th className="py-3 px-4">Container</th>
                <th className="py-3 px-4">Image</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4">Port Bindings</th>
                <th className="py-3 px-4">Security</th>
                <th className="py-3 px-4 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
              {filteredContainers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-500 font-sans">
                    No containers found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredContainers.map((c) => {
                  const report = getContainerReport(c);
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
                        />
                      </td>

                      {/* Name & ID */}
                      <td className="py-3 px-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setActiveContainer(c);
                                setDetailTab('overview');
                              }}
                              className="font-bold text-zinc-900 dark:text-zinc-200 hover:text-blue-500 text-left font-sans text-sm flex items-center space-x-1.5"
                            >
                              <span>{c.name}</span>
                            </button>
                            {c.isSelf && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 inline-flex items-center space-x-1" title="Self-container running Container Control Center">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Self</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{c.shortId}</span>
                        </div>
                      </td>

                      {/* Image */}
                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 max-w-xs truncate" title={c.image}>
                        {c.image}
                      </td>

                      {/* State */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStateBadge(c.state)}`}>
                          {c.state}
                        </span>
                      </td>

                      {/* Ports */}
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                        {c.ports && c.ports.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.ports.map((p, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[10px]"
                              >
                                {p.PublicPort ? `${p.PublicPort} -> ${p.PrivatePort}` : `${p.PrivatePort}`}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-600">-</span>
                        )}
                      </td>

                      {/* Security Scanner Status */}
                      <td className="py-3 px-4">
                        {(() => {
                          const isScanning = scanningMap[c.id] || (report && report.status === 'running');
                          if (isScanning) {
                            return (
                              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Scanning...</span>
                              </div>
                            );
                          }

                          if (report) {
                            return (
                              <div className="inline-flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedReportId(report.id)}
                                  title="Click to view interactive Trivy report"
                                  className="group cursor-pointer focus:outline-none"
                                >
                                  {report.criticalCount > 0 ? (
                                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[10px] font-bold group-hover:ring-2 group-hover:ring-red-400/50 transition-all flex items-center space-x-1">
                                      <ShieldAlert className="w-3 h-3 text-red-500" />
                                      <span>{report.criticalCount} Critical</span>
                                    </span>
                                  ) : report.highCount > 0 ? (
                                    <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-[10px] font-bold group-hover:ring-2 group-hover:ring-orange-400/50 transition-all flex items-center space-x-1">
                                      <ShieldAlert className="w-3 h-3 text-orange-500" />
                                      <span>{report.highCount} High</span>
                                    </span>
                                  ) : report.mediumCount > 0 ? (
                                    <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 text-[10px] font-bold group-hover:ring-2 group-hover:ring-yellow-400/50 transition-all flex items-center space-x-1">
                                      <ShieldAlert className="w-3 h-3 text-yellow-600" />
                                      <span>{report.mediumCount} Medium</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold group-hover:ring-2 group-hover:ring-emerald-400/50 transition-all flex items-center space-x-1">
                                      <span>Clean</span>
                                    </span>
                                  )}
                                </button>

                                {isOperator && (
                                  <button
                                    type="button"
                                    onClick={() => handleDirectScan(c)}
                                    title="Rescan container"
                                    className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-[10px] font-semibold inline-flex items-center space-x-1 transition-colors"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    <span>Rescan</span>
                                  </button>
                                )}
                              </div>
                            );
                          }

                          return isOperator ? (
                            <button
                              type="button"
                              onClick={() => handleDirectScan(c)}
                              className="text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                              title="Start scanning container"
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-blue-500" />
                              <span>Scan</span>
                            </button>
                          ) : (
                            <span className="text-zinc-400 text-[11px]">Unscanned</span>
                          );
                        })()}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {c.state === 'running' ? (
                            c.isSelf ? (
                              <>
                                <button
                                  disabled
                                  title="Self / Protected Platform - Cannot stop own container via UI"
                                  className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-600 cursor-not-allowed border border-zinc-200 dark:border-zinc-800"
                                >
                                  <Square className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  disabled
                                  title="Self / Protected Platform - Cannot restart own container via UI"
                                  className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-600 cursor-not-allowed border border-zinc-200 dark:border-zinc-800"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleAction('stop', c.id)}
                                  disabled={actionLoading === c.id}
                                  title="Stop Container"
                                  className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                >
                                  <Square className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleAction('restart', c.id)}
                                  disabled={actionLoading === c.id}
                                  title="Restart Container"
                                  className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )
                          ) : (
                            <button
                              onClick={() => handleAction('start', c.id)}
                              disabled={actionLoading === c.id}
                              title="Start Container"
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Terminal Shortcut */}
                          {c.state === 'running' && isOperator && (
                            <button
                              onClick={() => {
                                setActiveContainer(c);
                                setDetailTab('terminal');
                              }}
                              title="Open Terminal (Exec)"
                              className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-blue-500"
                            >
                              <Terminal className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Logs Shortcut */}
                          <button
                            onClick={() => {
                              setActiveContainer(c);
                              setDetailTab('logs');
                            }}
                            title="Live Logs"
                            className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {/* Stats Shortcut */}
                          {c.state === 'running' && (
                            <button
                              onClick={() => {
                                setActiveContainer(c);
                                setDetailTab('stats');
                              }}
                              title="Live Performance Metrics"
                              className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                            >
                              <Activity className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          {isOperator && (
                            c.isSelf ? (
                              <button
                                disabled
                                title="Self / Protected Platform - Cannot delete own container via UI"
                                className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-600 cursor-not-allowed border border-zinc-200 dark:border-zinc-800"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAction('delete', c.id)}
                                disabled={actionLoading === c.id}
                                title="Delete Container"
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Container Details Modal / Tabbed Drawer */}
      {activeContainer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-5xl w-full h-[95vh] sm:h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 transition-colors overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:px-6 sm:py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center justify-between w-full lg:w-auto">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
                    <Box className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight truncate max-w-[170px] xs:max-w-[220px] sm:max-w-md">
                        {activeContainer.name}
                      </h2>
                      {activeContainer.isSelf && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 inline-flex items-center space-x-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Self</span>
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStateBadge(activeContainer.state)}`}>
                        {activeContainer.state}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-xs sm:max-w-md">{activeContainer.image}</p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveContainer(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1.5 rounded-lg lg:hidden"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs Switcher & Close button */}
              <div className="flex items-center justify-between lg:justify-end space-x-2 w-full lg:w-auto">
                <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold overflow-x-auto max-w-full">
                  <button
                    onClick={() => setDetailTab('overview')}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                      detailTab === 'overview' ? 'bg-blue-600 text-white shadow' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Overview
                  </button>
                  {activeContainer.state === 'running' && isOperator && (
                    <button
                      onClick={() => setDetailTab('terminal')}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                        detailTab === 'terminal' ? 'bg-blue-600 text-white shadow' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      Terminal
                    </button>
                  )}
                  <button
                    onClick={() => setDetailTab('logs')}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                      detailTab === 'logs' ? 'bg-blue-600 text-white shadow' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Logs
                  </button>
                  {activeContainer.state === 'running' && (
                    <button
                      onClick={() => setDetailTab('stats')}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                        detailTab === 'stats' ? 'bg-blue-600 text-white shadow' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      Metrics
                    </button>
                  )}
                  <button
                    onClick={() => openInspect(activeContainer)}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                      detailTab === 'inspect' ? 'bg-blue-600 text-white shadow' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Inspect
                  </button>
                </div>

                <button
                  onClick={() => setActiveContainer(null)}
                  className="hidden lg:block text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1.5 rounded-lg"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
              {detailTab === 'overview' && (
                <div className="space-y-6 text-xs">
                  {/* Basic Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 p-4 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                    <div>
                      <span className="text-zinc-500 font-semibold uppercase">Container ID</span>
                      <div className="font-mono text-zinc-800 dark:text-zinc-200 mt-1 truncate">{activeContainer.id}</div>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-semibold uppercase">Created</span>
                      <div className="text-zinc-800 dark:text-zinc-200 mt-1">
                        {new Date(activeContainer.created * 1000).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-semibold uppercase">Network Mode</span>
                      <div className="font-mono text-zinc-800 dark:text-zinc-200 mt-1">{activeContainer.networkMode}</div>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-semibold uppercase">Command</span>
                      <div className="font-mono text-zinc-800 dark:text-zinc-200 mt-1 truncate">{activeContainer.command}</div>
                    </div>
                  </div>

                  {/* Mounts */}
                  <div className="p-4 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
                    <h4 className="font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider text-[11px]">
                      Mounted Volumes ({activeContainer.mounts?.length || 0})
                    </h4>
                    {activeContainer.mounts && activeContainer.mounts.length > 0 ? (
                      <div className="space-y-1 font-mono">
                        {activeContainer.mounts.map((m, idx) => (
                          <div key={idx} className="p-2 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 flex justify-between">
                            <span className="text-zinc-700 dark:text-zinc-300">{m.Source}</span>
                            <span className="text-zinc-400">{'->'}</span>
                            <span className="text-blue-500 font-bold">{m.Destination} ({m.Mode})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500">No external volume mounts configured.</p>
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'terminal' && (
                <WebTerminal containerId={activeContainer.id} containerName={activeContainer.name} />
              )}

              {detailTab === 'logs' && (
                <LogsViewer containerId={activeContainer.id} containerName={activeContainer.name} />
              )}

              {detailTab === 'stats' && <StatsCards containerId={activeContainer.id} />}

              {detailTab === 'inspect' && (
                <pre className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-mono text-xs text-zinc-800 dark:text-zinc-300 overflow-x-auto select-text">
                  {JSON.stringify(inspectData || activeContainer, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Trivy Security Report Modal */}
      {selectedReportId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative animate-in fade-in zoom-in-95 transition-colors">
            <div className="flex justify-end pb-2">
              <button
                onClick={() => setSelectedReportId(null)}
                className="p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                title="Close report viewer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ReportViewer
              reportId={selectedReportId}
              onClose={() => setSelectedReportId(null)}
              onDeleted={() => {
                setSelectedReportId(null);
                onRefresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
