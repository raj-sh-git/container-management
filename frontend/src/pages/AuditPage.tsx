import React, { useState, useEffect } from 'react';
import { AuditLog } from '../types';
import { systemApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, Search, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

export const AuditPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [clearing, setClearing] = useState<boolean>(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await systemApi.auditLogs(1000);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to permanently clear all audit logs? This action cannot be undone.')) {
      return;
    }
    setClearing(true);
    try {
      await systemApi.clearAuditLogs();
      await loadLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to clear audit logs');
    } finally {
      setClearing(false);
    }
  };

  const filtered = logs.filter((l) =>
    search
      ? l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.username.toLowerCase().includes(search.toLowerCase()) ||
        (l.details && l.details.toLowerCase().includes(search.toLowerCase())) ||
        (l.resourceId && l.resourceId.toLowerCase().includes(search.toLowerCase()))
      : true
  );

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const paginatedLogs = filtered.slice(startIndex, startIndex + pageSize);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Security Audit Trail</h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">Immutable record of all container, image, and user management actions</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadLogs}
            className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors shadow-sm"
            title="Refresh audit logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isAdmin && (
            <button
              onClick={handleClearLogs}
              disabled={clearing || logs.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
              title="Clear all audit log entries"
            >
              <Trash2 className="w-4 h-4" />
              <span>{clearing ? 'Clearing...' : 'Clear Audit Logs'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-wrap items-center justify-between gap-4 transition-colors shadow-sm">
        <div className="flex items-center space-x-4">
          <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
            Showing {filtered.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, filtered.length)} of {filtered.length} Events
          </span>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg px-2.5 py-1 font-mono focus:outline-none focus:border-blue-500"
            >
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={200}>200 per page</option>
            </select>
          </div>
        </div>

        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, user, or details..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Resource</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-500 font-sans">
                    No audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 font-sans">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-200 font-sans">{l.username}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-400 font-sans">
                      {l.resourceType} {l.resourceId ? `(${l.resourceId.substring(0, 12)})` : ''}
                    </td>
                    <td className="py-3 px-4 text-zinc-500">{l.ipAddress || 'local'}</td>
                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-sans max-w-sm truncate" title={l.details || ''}>
                      {l.details || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filtered.length > 0 && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-zinc-50/60 dark:bg-zinc-950/40 text-xs">
            <span className="text-zinc-600 dark:text-zinc-400 font-medium">
              Page {validPage} of {totalPages}
            </span>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(validPage - 1)}
                disabled={validPage <= 1}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-lg font-semibold disabled:opacity-40 transition-colors shadow-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <button
                onClick={() => handlePageChange(validPage + 1)}
                disabled={validPage >= totalPages}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-lg font-semibold disabled:opacity-40 transition-colors shadow-sm"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
