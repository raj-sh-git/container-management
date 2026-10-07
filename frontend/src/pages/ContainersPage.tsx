import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Container, DockerImage, DockerNetwork, ScanReport } from '../types';
import { containersApi, securityApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { WebTerminal } from '../components/terminal/WebTerminal';
import { LogsViewer } from '../components/logs/LogsViewer';
import { StatsCards } from '../components/stats/StatsCards';
import { ReportViewer } from '../components/security/ReportViewer';
import { ScalePanel } from '../components/containers/ScalePanel';
import { RefreshButton } from '../components/common/RefreshButton';
import {
  Box,
  Boxes,
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
  Minus,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Shield,
} from 'lucide-react';

export type ContainerDetailTab = 'overview' | 'terminal' | 'logs' | 'stats' | 'inspect' | 'scale';

export interface MinimizedContainerWindow {
  container: Container;
  tab: ContainerDetailTab;
}

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
  onCloseDetail?: () => void;
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
  onCloseDetail,
}) => {
  const { isOperator, isAdmin, canAccessExec } = useAuth();
  const [filterState, setFilterState] = useState<'all' | 'running' | 'stopped'>('all');
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeContainer, setActiveContainer] = useState<Container | null>(
    selectedContainerForDetail || null
  );
  const [detailTab, setDetailTab] = useState<ContainerDetailTab>(
    (initialDetailTab as ContainerDetailTab) || 'overview'
  );
  const [minimizedContainers, setMinimizedContainers] = useState<MinimizedContainerWindow[]>([]);
  const [isDetailMaximized, setIsDetailMaximized] = useState<boolean>(false);
  const [inspectData, setInspectData] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [flagLoading, setFlagLoading] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isReportMinimized, setIsReportMinimized] = useState<boolean>(false);
  const [isReportMaximized, setIsReportMaximized] = useState<boolean>(false);
  const [scanningMap, setScanningMap] = useState<Record<string, boolean>>({});

  const handleToggleFlag = async (containerId: string, flag: 'isProtected' | 'isHidden', currentValue: boolean) => {
    setFlagLoading(`${containerId}-${flag}`);
    try {
      await containersApi.updateFlags(containerId, { [flag]: !currentValue });
      if (activeContainer && activeContainer.id === containerId) {
        setActiveContainer({ ...activeContainer, [flag]: !currentValue });
      }
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to update ${flag}`);
    } finally {
      setFlagLoading(null);
    }
  };

  // Synchronize when parent passes selected container
  React.useEffect(() => {
    if (selectedContainerForDetail) {
      handleOpenContainerModal(
        selectedContainerForDetail,
        (initialDetailTab as ContainerDetailTab) || 'overview'
      );
    }
  }, [selectedContainerForDetail, initialDetailTab]);

  // Synchronize active and minimized containers with live container list
  React.useEffect(() => {
    if (activeContainer) {
      const updatedActive = containers.find((c) => c.id === activeContainer.id);
      if (updatedActive) {
        setActiveContainer(updatedActive);
      }
    }
    if (minimizedContainers.length > 0) {
      setMinimizedContainers((prev) =>
        prev.map((item) => {
          const updated = containers.find((c) => c.id === item.container.id);
          return updated ? { ...item, container: updated } : item;
        })
      );
    }
  }, [containers]);

  const handleOpenContainerModal = (
    c: Container,
    tab: ContainerDetailTab = 'overview'
  ) => {
    // 1. If this container is currently minimized, pop it back up
    const existingMinimized = minimizedContainers.find((item) => item.container.id === c.id);
    if (existingMinimized) {
      setMinimizedContainers((prev) => prev.filter((item) => item.container.id !== c.id));
      if (activeContainer && activeContainer.id !== c.id) {
        setMinimizedContainers((prev) => [
          ...prev.filter((item) => item.container.id !== activeContainer.id),
          { container: activeContainer, tab: detailTab },
        ]);
      }
      setActiveContainer(c);
      setDetailTab(tab !== 'overview' ? tab : (existingMinimized.tab || 'overview'));
      setIsDetailMaximized(false);
      return;
    }

    // 2. If it is already open as activeContainer, switch to desired tab
    if (activeContainer && activeContainer.id === c.id) {
      if (tab) setDetailTab(tab);
      return;
    }

    // 3. Opening another container when one is active: minimize active one so it is not lost
    if (activeContainer) {
      setMinimizedContainers((prev) => [
        ...prev.filter((item) => item.container.id !== activeContainer.id),
        { container: activeContainer, tab: detailTab },
      ]);
    }

    setActiveContainer(c);
    setDetailTab(tab);
    setIsDetailMaximized(false);
  };

  const handleMinimizeActiveContainer = () => {
    if (!activeContainer) return;
    setMinimizedContainers((prev) => [
      ...prev.filter((item) => item.container.id !== activeContainer.id),
      { container: activeContainer, tab: detailTab },
    ]);
    setActiveContainer(null);
    if (onCloseDetail) onCloseDetail();
    setIsDetailMaximized(false);
  };

  const handleRestoreMinimized = (item: MinimizedContainerWindow) => {
    if (activeContainer) {
      setMinimizedContainers((prev) => [
        ...prev.filter(
          (p) => p.container.id !== activeContainer.id && p.container.id !== item.container.id
        ),
        { container: activeContainer, tab: detailTab },
      ]);
    } else {
      setMinimizedContainers((prev) => prev.filter((p) => p.container.id !== item.container.id));
    }
    setActiveContainer(item.container);
    setDetailTab(item.tab);
  };

  const handleCloseMinimized = (containerId: string) => {
    setMinimizedContainers((prev) => prev.filter((p) => p.container.id !== containerId));
  };

  const handleCloseActiveModal = () => {
    setActiveContainer(null);
    if (onCloseDetail) onCloseDetail();
    setIsDetailMaximized(false);
  };

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

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  const sortedContainers = [...filteredContainers].sort((a: any, b: any) => {
    const valA = a[sortConfig.key] || '';
    const valB = b[sortConfig.key] || '';
    if (typeof valA === 'string' && typeof valB === 'string') {
      const cmp = valA.localeCompare(valB);
      if (cmp !== 0) return sortConfig.direction === 'asc' ? cmp : -cmp;
    } else if (typeof valA === 'number' && typeof valB === 'number') {
      if (valA !== valB) return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    }
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSelectAll = () => {
    if (selectedIds.length === sortedContainers.length && sortedContainers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedContainers.map((c) => c.id));
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
      alert('Action blocked: Cannot stop, restart, or delete the Container Manager platform itself.');
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
    handleOpenContainerModal(c, 'inspect');
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
      await onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to start container scan');
      setScanningMap((prev) => ({ ...prev, [c.id]: false }));
      return;
    }
    setTimeout(() => {
      setScanningMap((prev) => ({ ...prev, [c.id]: false }));
    }, 3000);
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
          <RefreshButton onRefresh={onRefresh} title="Refresh containers" />

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
          <div className="flex flex-wrap bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 max-w-full">
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
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-3 w-8 sm:w-10 text-center shrink-0">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length > 0 && selectedIds.length === sortedContainers.length
                    }
                    onChange={handleSelectAll}
                    className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
                  />
                </th>
                <th className="py-3 px-3 cursor-pointer hover:text-zinc-900 dark:hover:text-white select-none" onClick={() => handleSort('name')}>
                  Container {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-3 px-3 cursor-pointer hover:text-zinc-900 dark:hover:text-white select-none" onClick={() => handleSort('image')}>
                  Image {sortConfig.key === 'image' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap cursor-pointer hover:text-zinc-900 dark:hover:text-white select-none" onClick={() => handleSort('state')}>
                  State {sortConfig.key === 'state' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap w-[200px]">Port Bindings</th>
                <th className="py-3 px-3 text-center whitespace-nowrap w-[150px]">Security</th>
                <th className="py-3 px-3 text-right whitespace-nowrap w-[180px]">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
              {sortedContainers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-500 font-sans">
                    No containers found matching current criteria.
                  </td>
                </tr>
              ) : (
                sortedContainers.map((c) => {
                  const report = getContainerReport(c);
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                      <td className="py-3 px-3 w-8 sm:w-10 text-center shrink-0">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
                        />
                      </td>

                      {/* Name & ID */}
                      <td className="py-3 px-3 min-w-0">
                        <div>
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <button
                              onClick={() => {
                                handleOpenContainerModal(c, 'overview');
                              }}
                              className="font-bold text-zinc-900 dark:text-zinc-200 hover:text-blue-500 text-left font-sans text-sm flex items-center min-w-0 max-w-full"
                            >
                              <span className="truncate max-w-[120px] sm:max-w-[160px] md:max-w-[200px] lg:max-w-xs block" title={c.name}>
                                {c.name}
                              </span>
                            </button>
                            {c.isSelf && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 inline-flex items-center space-x-1 shrink-0 whitespace-nowrap" title="Platform self container">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Self</span>
                              </span>
                            )}
                            {c.isProtected && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-flex items-center space-x-1 shrink-0 whitespace-nowrap" title="Protected against stopping and deletion">
                                <Lock className="w-3 h-3" />
                                <span>Protected</span>
                              </span>
                            )}
                            {c.isHidden && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 inline-flex items-center space-x-1 shrink-0 whitespace-nowrap" title="Hidden from operators and viewers">
                                <EyeOff className="w-3 h-3" />
                                <span>Hidden</span>
                              </span>
                            )}
                            {c.name.match(/-replica-\d+$/) && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 inline-flex items-center space-x-1 shrink-0 whitespace-nowrap" title="Scaled replica container">
                                <Boxes className="w-2.5 h-2.5" />
                                <span>Replica</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block font-mono truncate">{c.shortId}</span>
                        </div>
                      </td>

                      {/* Image */}
                      <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300 min-w-0" title={c.image}>
                        <div className="truncate max-w-[110px] sm:max-w-[150px] md:max-w-[190px] lg:max-w-xs whitespace-nowrap font-mono text-xs">
                          {c.image}
                        </div>
                      </td>

                      {/* State */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border whitespace-nowrap ${getStateBadge(c.state)}`}>
                          {c.state}
                        </span>
                      </td>

                      {/* Ports */}
                      <td className="py-3 px-3 text-center">
                        {c.ports && c.ports.length > 0 ? (
                          <div className="flex flex-nowrap justify-center gap-1">
                            {c.ports.map((p, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[10px] whitespace-nowrap font-mono inline-block shrink-0"
                              >
                                {p.PublicPort ? `${p.PublicPort} -> ${p.PrivatePort}` : `${p.PrivatePort}`}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-zinc-400 dark:text-zinc-600 font-mono">-</div>
                        )}
                      </td>

                      {/* Security Scanner Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center w-full whitespace-nowrap">
                          {(() => {
                            const isScanning = scanningMap[c.id] || (report && report.status === 'running');
                            if (isScanning) {
                              return (
                                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold animate-pulse whitespace-nowrap shrink-0">
                                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                  <span className="whitespace-nowrap">Scanning...</span>
                                </div>
                              );
                            }

                            if (report) {
                              return (
                                <div className="inline-flex items-center space-x-1.5 whitespace-nowrap shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedReportId(report.id)}
                                    title="Click to view interactive Trivy report"
                                    className="group cursor-pointer focus:outline-none shrink-0"
                                  >
                                    {report.criticalCount > 0 ? (
                                      <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[10px] font-bold group-hover:ring-2 group-hover:ring-red-400/50 transition-all flex items-center space-x-1 whitespace-nowrap shrink-0">
                                        <ShieldAlert className="w-3 h-3 text-red-500 shrink-0" />
                                        <span className="whitespace-nowrap">{report.criticalCount} Critical</span>
                                      </span>
                                    ) : report.highCount > 0 ? (
                                      <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-[10px] font-bold group-hover:ring-2 group-hover:ring-orange-400/50 transition-all flex items-center space-x-1 whitespace-nowrap shrink-0">
                                        <ShieldAlert className="w-3 h-3 text-orange-500 shrink-0" />
                                        <span className="whitespace-nowrap">{report.highCount} High</span>
                                      </span>
                                    ) : report.mediumCount > 0 ? (
                                      <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 text-[10px] font-bold group-hover:ring-2 group-hover:ring-yellow-400/50 transition-all flex items-center space-x-1 whitespace-nowrap shrink-0">
                                        <ShieldAlert className="w-3 h-3 text-yellow-600 shrink-0" />
                                        <span className="whitespace-nowrap">{report.mediumCount} Medium</span>
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold group-hover:ring-2 group-hover:ring-emerald-400/50 transition-all flex items-center space-x-1 whitespace-nowrap shrink-0">
                                        <span className="whitespace-nowrap">Clean</span>
                                      </span>
                                    )}
                                  </button>

                                  {isOperator && (
                                    <button
                                      type="button"
                                      onClick={() => handleDirectScan(c)}
                                      title="Rescan container"
                                      className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-[10px] font-semibold inline-flex items-center space-x-1 transition-colors whitespace-nowrap shrink-0"
                                    >
                                      <RefreshCw className="w-2.5 h-2.5 shrink-0" />
                                      <span className="whitespace-nowrap">Rescan</span>
                                    </button>
                                  )}
                                </div>
                              );
                            }

                            return isOperator ? (
                              <button
                                type="button"
                                onClick={() => handleDirectScan(c)}
                                className="text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0"
                                title="Start scanning container"
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span className="whitespace-nowrap">Scan</span>
                              </button>
                            ) : (
                              <span className="text-zinc-400 text-[11px] whitespace-nowrap">Unscanned</span>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1 shrink-0 whitespace-nowrap">
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
                            ) : (!isAdmin && c.isProtected) ? (
                              <>
                                <button
                                  disabled
                                  title="Protected Container - Cannot be stopped by non-admins"
                                  className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500/50 cursor-not-allowed border border-amber-500/20"
                                >
                                  <Square className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  disabled
                                  title="Protected Container - Cannot be restarted by non-admins"
                                  className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500/50 cursor-not-allowed border border-amber-500/20"
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
                              disabled={actionLoading === c.id || (!isAdmin && c.isProtected)}
                              title={(!isAdmin && c.isProtected) ? "Protected container" : "Start Container"}
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Terminal Shortcut */}
                          {c.state === 'running' && isOperator && (
                            <button
                              onClick={() => {
                                handleOpenContainerModal(c, 'terminal');
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
                              handleOpenContainerModal(c, 'logs');
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
                                handleOpenContainerModal(c, 'stats');
                              }}
                              title="Live Performance Metrics"
                              className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                            >
                              <Activity className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Scale / Autoscaling */}
                          {isOperator && !c.isSelf && (
                            <button
                              onClick={() => {
                                handleOpenContainerModal(c, 'scale');
                              }}
                              title="Scale & Autoscaling"
                              className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                            >
                              <Boxes className="w-3.5 h-3.5" />
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
                            ) : (!isAdmin && c.isProtected) ? (
                              <button
                                disabled
                                title="Protected Container - Cannot be deleted by non-admins"
                                className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500/50 cursor-not-allowed border border-amber-500/20"
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

                          {/* Admin Quick Governance Toggles */}
                          {isAdmin && !c.isSelf && (
                            <div className="flex items-center space-x-1 pl-1.5 border-l border-zinc-200 dark:border-zinc-800">
                              <button
                                onClick={() => handleToggleFlag(c.id, 'isProtected', Boolean(c.isProtected))}
                                disabled={flagLoading === `${c.id}-isProtected`}
                                title={c.isProtected ? "Protected: Click to unprotect" : "Unprotected: Click to protect container"}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  c.isProtected
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                }`}
                              >
                                {c.isProtected ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleToggleFlag(c.id, 'isHidden', Boolean(c.isHidden))}
                                disabled={flagLoading === `${c.id}-isHidden`}
                                title={c.isHidden ? "Hidden from operators/viewers: Click to unhide" : "Visible: Click to hide container"}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  c.isHidden
                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/30'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                }`}
                              >
                                {c.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
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
      {/* Minimized Container Windows Dock */}
      {minimizedContainers.length > 0 && createPortal(
        <div className="fixed bottom-5 right-5 z-[100] flex flex-wrap-reverse gap-2 items-center justify-end max-w-[90vw] pointer-events-none">
          {minimizedContainers.map((item) => (
            <div
              key={item.container.id}
              className="pointer-events-auto bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-2.5 sm:p-3 flex items-center space-x-2.5 text-xs animate-in slide-in-from-bottom-5 transition-all hover:border-blue-500/50"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg border border-blue-500/20 shrink-0">
                  <Box className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-zinc-900 dark:text-white truncate max-w-[120px] sm:max-w-[150px]">
                      {item.container.name}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase border ${getStateBadge(item.container.state)} shrink-0`}>
                      {item.container.state}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 capitalize">{item.tab}</p>
                </div>
              </div>

              <div className="flex items-center space-x-1 pl-2 border-l border-zinc-200 dark:border-zinc-800 shrink-0">
                <button
                  onClick={() => handleRestoreMinimized(item)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Restore window"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleCloseMinimized(item.container.id)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* Active Container Details Modal */}
      {activeContainer && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className={`bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl animate-in fade-in zoom-in-95 transition-all overflow-hidden ${
            isDetailMaximized ? 'w-full h-full inset-0 rounded-none' : 'rounded-2xl max-w-5xl w-full h-[95vh] sm:h-[90vh]'
          }`}>
            {/* Modal Header */}
            <div className="p-3 sm:px-6 sm:py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
              <div className="flex items-center justify-between min-w-0 flex-1 gap-2">
                <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
                  <div className="p-2 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
                    <Box className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight truncate max-w-[180px] xs:max-w-[220px] sm:max-w-xs md:max-w-sm">
                        {activeContainer.name}
                      </h2>
                      {activeContainer.isSelf && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 inline-flex items-center space-x-1 shrink-0">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Self</span>
                        </span>
                      )}
                      {activeContainer.isProtected && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-flex items-center space-x-1 shrink-0">
                          <Lock className="w-3 h-3" />
                          <span>Protected</span>
                        </span>
                      )}
                      {activeContainer.isHidden && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 inline-flex items-center space-x-1 shrink-0">
                          <EyeOff className="w-3 h-3" />
                          <span>Hidden</span>
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border shrink-0 ${getStateBadge(activeContainer.state)}`}>
                        {activeContainer.state}
                      </span>
                    </div>
                    <p
                      className="text-[11px] sm:text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate w-full max-w-full block mt-0.5"
                      title={activeContainer.image}
                    >
                      {activeContainer.image}
                    </p>
                  </div>
                </div>

                {/* Mobile controls */}
                <div className="flex md:hidden items-center space-x-1 shrink-0">
                  <button
                    onClick={handleMinimizeActiveContainer}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Minimize"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsDetailMaximized(!isDetailMaximized)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title={isDetailMaximized ? "Restore" : "Maximize"}
                  >
                    {isDetailMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleCloseActiveModal}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tabs Switcher & Desktop Window Controls */}
              <div className="flex items-center justify-between md:justify-end space-x-2 w-full md:w-auto shrink-0 min-w-0">
                <div className="flex flex-wrap bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold min-w-0 max-w-full">
                  <button
                    onClick={() => setDetailTab('overview')}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                      detailTab === 'overview' ? 'bg-blue-600 text-white shadow' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Overview
                  </button>
                  {activeContainer.state === 'running' && canAccessExec && (
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
                  {isOperator && !activeContainer.isSelf && (
                    <button
                      onClick={() => setDetailTab('scale')}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                        detailTab === 'scale'
                          ? 'bg-purple-600 text-white shadow'
                          : 'text-purple-600 dark:text-purple-400 hover:bg-purple-500/10'
                      }`}
                      title="Scale container replicas & configure autoscaling"
                    >
                      <Boxes className="w-3.5 h-3.5" />
                      <span>Scale</span>
                    </button>
                  )}
                </div>

                {/* Desktop Window Controls */}
                <div className="hidden md:flex items-center space-x-1 pl-2 border-l border-zinc-200 dark:border-zinc-800 shrink-0">
                  <button
                    onClick={handleMinimizeActiveContainer}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Minimize"
                    aria-label="Minimize modal"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsDetailMaximized(!isDetailMaximized)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title={isDetailMaximized ? "Restore" : "Maximize"}
                    aria-label={isDetailMaximized ? "Restore modal" : "Maximize modal"}
                  >
                    {isDetailMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleCloseActiveModal}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className={`p-4 sm:p-6 flex-1 ${['terminal', 'logs'].includes(detailTab) ? 'flex flex-col min-h-0 overflow-hidden' : 'overflow-y-auto'}`}>
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

                  {/* Governance & Protection Card */}
                  <div className="p-4 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        <h4 className="font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider text-[11px]">
                          Access Control & Container Governance
                        </h4>
                      </div>
                      {isAdmin && (
                        <span className="text-[10px] text-zinc-500 font-mono">Administrator Privileges</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Protection Card */}
                      <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <div className="space-y-0.5 pr-2">
                          <div className="flex items-center space-x-1.5">
                            <Lock className="w-3.5 h-3.5 text-amber-500" />
                            <span className="font-bold text-zinc-900 dark:text-white">Protected Container</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Prevents operators and viewers from stopping, restarting, or deleting this container.
                          </p>
                        </div>
                        {isAdmin && !activeContainer.isSelf ? (
                          <button
                            onClick={() => handleToggleFlag(activeContainer.id, 'isProtected', Boolean(activeContainer.isProtected))}
                            disabled={flagLoading === `${activeContainer.id}-isProtected`}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors shrink-0 ${
                              activeContainer.isProtected
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                            }`}
                          >
                            {activeContainer.isProtected ? 'Protected' : 'Unprotected'}
                          </button>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            activeContainer.isProtected || activeContainer.isSelf
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                          }`}>
                            {activeContainer.isProtected || activeContainer.isSelf ? 'Protected' : 'Standard'}
                          </span>
                        )}
                      </div>

                      {/* Hidden Card */}
                      <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <div className="space-y-0.5 pr-2">
                          <div className="flex items-center space-x-1.5">
                            <EyeOff className="w-3.5 h-3.5 text-purple-500" />
                            <span className="font-bold text-zinc-900 dark:text-white">Hidden Visibility</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Conceals this container from operator and viewer user dashboards entirely.
                          </p>
                        </div>
                        {isAdmin && !activeContainer.isSelf ? (
                          <button
                            onClick={() => handleToggleFlag(activeContainer.id, 'isHidden', Boolean(activeContainer.isHidden))}
                            disabled={flagLoading === `${activeContainer.id}-isHidden`}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors shrink-0 ${
                              activeContainer.isHidden
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                            }`}
                          >
                            {activeContainer.isHidden ? 'Hidden' : 'Visible'}
                          </button>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            activeContainer.isHidden || activeContainer.isSelf
                              ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                          }`}>
                            {activeContainer.isHidden || activeContainer.isSelf ? 'Hidden' : 'Visible'}
                          </span>
                        )}
                      </div>
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

              {detailTab === 'scale' && (
                <ScalePanel
                  containerId={activeContainer.id}
                  containerName={activeContainer.name}
                  onScaled={onRefresh}
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Interactive Security Report Modal */}
      {selectedReportId && isReportMinimized && createPortal(
        <div className="fixed bottom-5 left-5 z-[100] bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-5">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg border border-blue-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-zinc-900 dark:text-white truncate max-w-[150px]">Security Report</p>
              <p className="text-[10px] text-zinc-400 font-mono">{selectedReportId.substring(0, 8)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 pl-2 border-l border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setIsReportMinimized(false)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Restore report"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setSelectedReportId(null);
                setIsReportMinimized(false);
                setIsReportMaximized(false);
              }}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>,
        document.body
      )}

      {selectedReportId && !isReportMinimized && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className={`bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-2xl relative animate-in fade-in zoom-in-95 transition-all flex flex-col ${
            isReportMaximized ? 'w-full h-full inset-0 rounded-none' : 'rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 mb-4">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Vulnerability Security Report</h3>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setIsReportMinimized(true)}
                  className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  title="Minimize report"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsReportMaximized(!isReportMaximized)}
                  className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  title={isReportMaximized ? "Restore size" : "Maximize report"}
                >
                  {isReportMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    setSelectedReportId(null);
                    setIsReportMinimized(false);
                    setIsReportMaximized(false);
                  }}
                  className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  title="Close report viewer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <ReportViewer
              reportId={selectedReportId}
              onClose={() => {
                setSelectedReportId(null);
                setIsReportMinimized(false);
                setIsReportMaximized(false);
              }}
              onDeleted={() => {
                setSelectedReportId(null);
                setIsReportMinimized(false);
                setIsReportMaximized(false);
                onRefresh();
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
