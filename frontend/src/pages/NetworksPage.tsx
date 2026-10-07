import React, { useState } from 'react';
import { DockerNetwork, Container } from '../types';
import { networksApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Network, Plus, Trash2, Search, X, Link, Unlink, Eye, ShieldCheck } from 'lucide-react';
import { RefreshButton } from '../components/common/RefreshButton';

interface NetworksPageProps {
  networks: DockerNetwork[];
  containers: Container[];
  onRefresh: () => void;
}

export const NetworksPage: React.FC<NetworksPageProps> = ({ networks, containers, onRefresh }) => {
  const { isOperator } = useAuth();
  const [search, setSearch] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'Name', direction: 'asc' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [networkName, setNetworkName] = useState<string>('');
  const [driver, setDriver] = useState<string>('bridge');
  const [inspectNetwork, setInspectNetwork] = useState<any>(null);

  const [connectNetworkId, setConnectNetworkId] = useState<string | null>(null);
  const [selectedContainerId, setSelectedContainerId] = useState<string>(containers[0]?.id || '');

  const filtered = networks.filter((n) =>
    search ? n.Name.toLowerCase().includes(search.toLowerCase()) || n.Driver.toLowerCase().includes(search.toLowerCase()) : true
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!networkName.trim()) return;
    try {
      await networksApi.create({ name: networkName.trim(), driver });
      setIsCreateOpen(false);
      setNetworkName('');
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create network');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete network '${name}'?`)) {
      try {
        await networksApi.remove(id);
        onRefresh();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to delete network');
      }
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectNetworkId || !selectedContainerId) return;
    try {
      await networksApi.connect(connectNetworkId, selectedContainerId);
      setConnectNetworkId(null);
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to connect container to network');
    }
  };

  const handleDisconnect = async (networkId: string, containerId: string) => {
    if (confirm('Disconnect container from network?')) {
      try {
        await networksApi.disconnect(networkId, containerId, true);
        onRefresh();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to disconnect');
      }
    }
  };


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
    return a.Name.localeCompare(b.Name) || (a.Id || '').localeCompare(b.Id || '');
  });

  const deletableNetworks = sorted.filter(n => !['bridge', 'host', 'none'].includes(n.Name) && !n.isSelf);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === deletableNetworks.length && deletableNetworks.length > 0) setSelectedIds([]);
    else setSelectedIds(deletableNetworks.map(n => n.Id));
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} networks?`)) return;
    for (const id of selectedIds) {
      try { await networksApi.remove(id); } catch (e) {}
    }
    setSelectedIds([]);
    onRefresh();
  };

  return (

    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Container Virtual Networks</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Manage subnets, bridge/overlay drivers & container connections</p>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <RefreshButton onRefresh={onRefresh} title="Refresh networks" />

          {isOperator && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center space-x-2 px-3.5 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Network</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors shadow-sm">
        <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          Showing {filtered.length} of {networks.length} Networks
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search network or driver..."
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-xs border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3.5 px-3 w-8 sm:w-10 text-center shrink-0">
                  <input
                    type="checkbox"
                    disabled={deletableNetworks.length === 0}
                    checked={selectedIds.length > 0 && selectedIds.length === deletableNetworks.length}
                    onChange={handleSelectAll}
                    className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-zinc-900 dark:hover:text-white select-none" onClick={() => handleSort('Name')}>
                  Network Name {sortConfig.key === 'Name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-zinc-900 dark:hover:text-white select-none" onClick={() => handleSort('Driver')}>
                  Driver {sortConfig.key === 'Driver' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-3.5 px-4">Subnet / Gateway</th>
                <th className="py-3.5 px-4">Connected Containers</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-zinc-500 font-sans text-sm">
                  No networks found.
                </td>
              </tr>
            ) : (
              sorted.map((n) => {
                const id = n.Id || (n as any).id;
                const subnet = n.IPAM?.Config?.[0]?.Subnet || '-';
                const containerCount = n.Containers ? Object.keys(n.Containers).length : 0;
                const isDeletable = !['bridge', 'host', 'none'].includes(n.Name) && !n.isSelf;
                return (
                  <tr key={id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-3 w-8 sm:w-10 text-center shrink-0">
                      <input
                        type="checkbox"
                        disabled={!isDeletable}
                        checked={selectedIds.includes(id)}
                        onChange={() => toggleSelect(id)}
                        className="rounded bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-zinc-100 font-sans text-sm">
                      <div className="flex items-center space-x-2">
                        <span>{n.Name}</span>
                        {n.isSelf && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 inline-flex items-center space-x-1" title="Platform Virtual Network">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Self</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400">
                      <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 uppercase text-xs font-semibold font-mono text-zinc-700 dark:text-zinc-300">
                        {n.Driver}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs sm:text-sm font-mono text-zinc-700 dark:text-zinc-300">{subnet}</td>
                    <td className="py-3.5 px-4 text-zinc-700 dark:text-zinc-300">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 font-sans">{containerCount}</span>
                        {n.Containers && containerCount > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(n.Containers).map(([cid, cval]) => (
                              <span
                                key={cid}
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300"
                              >
                                <span>{cval.Name}</span>
                                {isOperator && (
                                  <button
                                    onClick={() => handleDisconnect(id, cid)}
                                    className="text-zinc-400 hover:text-red-500 transition-colors"
                                    title="Disconnect"
                                  >
                                    <Unlink className="w-3 h-3" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5 sm:space-x-2">
                        {isOperator && (
                          <button
                            onClick={() => {
                              setConnectNetworkId(id);
                              setSelectedContainerId(containers[0]?.id || '');
                            }}
                            title="Connect Container"
                            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-blue-600 dark:text-blue-400 transition-colors"
                          >
                            <Link className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            const data = await networksApi.inspect(id);
                            setInspectNetwork(data);
                          }}
                          title="Inspect"
                          className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isOperator && isDeletable && (
                          <button
                            onClick={() => handleDelete(id, n.Name)}
                            title="Delete Network"
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Connect Modal */}
      {connectNetworkId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 transition-colors">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Connect Container to Network</h3>
              <button onClick={() => setConnectNetworkId(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConnect} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Select Container
                </label>
                <select
                  value={selectedContainerId}
                  onChange={(e) => setSelectedContainerId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:border-blue-500"
                >
                  {containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.state})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setConnectNetworkId(null)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/30"
                >
                  Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 transition-colors">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Create Network</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Network Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. app-network"
                  value={networkName}
                  onChange={(e) => setNetworkName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Driver
                </label>
                <select
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                >
                  <option value="bridge">bridge</option>
                  <option value="overlay">overlay</option>
                  <option value="macvlan">macvlan</option>
                  <option value="ipvlan">ipvlan</option>
                </select>
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
      {inspectNetwork && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 transition-colors">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Inspect Network</h3>
              <button onClick={() => setInspectNetwork(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-mono text-xs text-zinc-800 dark:text-zinc-300 overflow-x-auto max-h-[60vh]">
              {JSON.stringify(inspectNetwork, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
