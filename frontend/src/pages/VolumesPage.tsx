import React, { useState } from 'react';
import { DockerVolume } from '../types';
import { volumesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { HardDrive, Plus, Trash2, Search, X, Eye, ShieldCheck } from 'lucide-react';
import { RefreshButton } from '../components/common/RefreshButton';

interface VolumesPageProps {
  volumes: DockerVolume[];
  onRefresh: () => void;
}

export const VolumesPage: React.FC<VolumesPageProps> = ({ volumes, onRefresh }) => {
  const { isOperator } = useAuth();
  const [search, setSearch] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'Name', direction: 'asc' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [volumeName, setVolumeName] = useState<string>('');
  const [driver, setDriver] = useState<string>('local');
  const [inspectVolume, setInspectVolume] = useState<any>(null);

  const filtered = volumes.filter((v) =>
    search ? v.Name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const sorted = [...filtered].sort((a: any, b: any) => {
    const valA = a[sortConfig.key] || '';
    const valB = b[sortConfig.key] || '';
    if (typeof valA === 'string' && typeof valB === 'string') {
      const cmp = valA.localeCompare(valB);
      if (cmp !== 0) return sortConfig.direction === 'asc' ? cmp : -cmp;
    } else {
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return a.Name.localeCompare(b.Name);
  });

  const toggleSelect = (name: string) => {
    setSelectedIds(prev => prev.includes(name) ? prev.filter(id => id !== name) : [...prev, name]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === sorted.length && sorted.length > 0) setSelectedIds([]);
    else setSelectedIds(sorted.map(v => v.Name));
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleBatchDelete = async () => {
    if (!confirm()) return;
    for (const name of selectedIds) {
      try { await handleDelete(name); } catch (e) {}
    }
    setSelectedIds([]);
    onRefresh();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await volumesApi.create({ name: volumeName.trim() || undefined, driver });
      setIsCreateOpen(false);
      setVolumeName('');
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create volume');
    }
  };

  const handleDelete = async (name: string) => {
    if (confirm(`Delete volume '${name}'? This action cannot be undone.`)) {
      try {
        await volumesApi.remove(name, true);
        onRefresh();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to delete volume');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Persistent Storage Volumes</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Manage data volumes and local storage drivers</p>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <RefreshButton onRefresh={onRefresh} title="Refresh volumes" />
          {isOperator && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center space-x-2 px-3.5 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Volume</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors shadow-sm">
        <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          Showing {filtered.length} of {volumes.length} Volumes
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search volume name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      {selectedIds.length > 0 && isOperator && (
        <div className="p-3 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between transition-colors shadow-sm mb-4">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {selectedIds.length} Selected
          </span>
          <button onClick={handleBatchDelete} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold transition-colors">
            Delete Selected
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl transition-colors">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-3 w-8 sm:w-10 text-center shrink-0">
                  <input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === sorted.length} onChange={handleSelectAll} className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0" />
                </th>
                <th className="py-3 px-3 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 select-none" onClick={() => handleSort('Name')}>Volume Name {sortConfig.key === 'Name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th className="py-3 px-3 hidden sm:table-cell cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 select-none" onClick={() => handleSort('Driver')}>Driver {sortConfig.key === 'Driver' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th className="py-3 px-3 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 select-none" onClick={() => handleSort('Mountpoint')}>Mountpoint {sortConfig.key === 'Mountpoint' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th className="py-3 px-3 hidden md:table-cell cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 select-none" onClick={() => handleSort('Scope')}>Scope {sortConfig.key === 'Scope' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-500 font-sans">
                    No volumes found.
                  </td>
                </tr>
              ) : (
                sorted.map((v) => (
                  <tr key={v.Name} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                    <td className="py-3 px-3 w-8 sm:w-10 text-center shrink-0">
                      <input type="checkbox" checked={selectedIds.includes(v.Name)} onChange={() => toggleSelect(v.Name)} className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0" />
                    </td>
                    <td className="py-3 px-3 font-bold text-zinc-900 dark:text-zinc-200 min-w-0">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="truncate max-w-[130px] sm:max-w-xs block" title={v.Name}>{v.Name}</span>
                        {v.isSelf && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 inline-flex items-center space-x-1 shrink-0 whitespace-nowrap" title="Platform Storage Volume">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Self</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 hidden sm:table-cell">{v.Driver}</td>
                    <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 min-w-0" title={v.Mountpoint}>
                      <span className="truncate max-w-[130px] sm:max-w-xs md:max-w-sm block">{v.Mountpoint}</span>
                    </td>
                    <td className="py-3 px-3 text-zinc-500 uppercase text-[10px] hidden md:table-cell">{v.Scope}</td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={async () => {
                            const data = await volumesApi.inspect(v.Name);
                            setInspectVolume(data);
                          }}
                          title="Inspect"
                          className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {isOperator && !v.isSelf && (
                          <button
                            onClick={() => handleDelete(v.Name)}
                            title="Delete Volume"
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 transition-colors">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Create Volume</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Volume Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. pg_data (optional)"
                  value={volumeName}
                  onChange={(e) => setVolumeName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Driver
                </label>
                <input
                  type="text"
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/30"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Modal */}
      {inspectVolume && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 transition-colors">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Inspect Volume</h3>
              <button onClick={() => setInspectVolume(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-mono text-xs text-zinc-800 dark:text-zinc-300 overflow-x-auto max-h-[60vh]">
              {JSON.stringify(inspectVolume, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
