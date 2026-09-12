import React, { useState } from 'react';
import { ScanReport } from '../types';
import { securityApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ReportViewer } from '../components/security/ReportViewer';
import {
  ShieldAlert,
  Play,
  Trash2,
  Download,
  Eye,
  RefreshCw,
  Search,
} from 'lucide-react';

interface SecurityPageProps {
  reports: ScanReport[];
  onRefresh: () => void;
  onOpenScanModal: () => void;
}

export const SecurityPage: React.FC<SecurityPageProps> = ({
  reports,
  onRefresh,
  onOpenScanModal,
}) => {
  const { isOperator } = useAuth();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  const totalCritical = reports.reduce((acc, r) => acc + r.criticalCount, 0);
  const totalHigh = reports.reduce((acc, r) => acc + r.highCount, 0);
  const totalMedium = reports.reduce((acc, r) => acc + r.mediumCount, 0);
  const totalLow = reports.reduce((acc, r) => acc + r.lowCount, 0);

  const filtered = reports.filter((r) =>
    search ? r.targetName.toLowerCase().includes(search.toLowerCase()) : true
  );

  const handleDelete = async (id: string) => {
    if (confirm('Delete this scan report?')) {
      try {
        await securityApi.deleteReport(id);
        if (selectedReportId === id) setSelectedReportId(null);
        onRefresh();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to delete report');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-2xl border border-blue-500/20 shrink-0">
              <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Trivy Vulnerability Center</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Comprehensive security vulnerability and configuration scanning powered by Trivy engine
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <button
            onClick={onRefresh}
            className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors"
            title="Refresh reports"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isOperator && (
            <button
              onClick={onOpenScanModal}
              className="flex items-center space-x-2 px-3.5 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
            >
              <Play className="w-4 h-4" />
              <span>Launch Scan</span>
            </button>
          )}
        </div>
      </div>

      {/* Security Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 sm:p-4 bg-white dark:bg-zinc-900/80 border border-red-500/20 rounded-2xl shadow-sm">
          <div className="text-xl sm:text-2xl font-black text-red-500 dark:text-red-400">{totalCritical}</div>
          <div className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Critical CVEs</div>
        </div>
        <div className="p-3.5 sm:p-4 bg-white dark:bg-zinc-900/80 border border-orange-500/20 rounded-2xl shadow-sm">
          <div className="text-xl sm:text-2xl font-black text-orange-500 dark:text-orange-400">{totalHigh}</div>
          <div className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">High CVEs</div>
        </div>
        <div className="p-3.5 sm:p-4 bg-white dark:bg-zinc-900/80 border border-yellow-500/20 rounded-2xl shadow-sm">
          <div className="text-xl sm:text-2xl font-black text-yellow-600 dark:text-yellow-400">{totalMedium}</div>
          <div className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Medium CVEs</div>
        </div>
        <div className="p-3.5 sm:p-4 bg-white dark:bg-zinc-900/80 border border-blue-500/20 rounded-2xl shadow-sm">
          <div className="text-xl sm:text-2xl font-black text-blue-500 dark:text-blue-400">{totalLow}</div>
          <div className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Low CVEs</div>
        </div>
        <div className="p-3.5 sm:p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm col-span-2 sm:col-span-1">
          <div className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">{reports.length}</div>
          <div className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Total Scans</div>
        </div>
      </div>

      {/* Selected Report Viewer or Report List */}
      {selectedReportId ? (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedReportId(null)}
            className="text-xs font-semibold text-blue-500 hover:text-blue-400 flex items-center space-x-1"
          >
            <span>&larr; Back to Scan Reports List</span>
          </button>
          <ReportViewer
            reportId={selectedReportId}
            onClose={() => setSelectedReportId(null)}
            onDeleted={() => {
              setSelectedReportId(null);
              onRefresh();
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Historical Scan Reports ({filtered.length})
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search target name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Target Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Severity Breakdown</th>
                    <th className="py-3 px-4">Date Scanned</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-zinc-500 font-sans">
                        No vulnerability reports found. Click "Launch Scan" to scan an image or container.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const downloadUrl = securityApi.getReportHtmlUrl(r.id, true, 'severity', 'desc');
                      return (
                        <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-200">
                            <button
                              onClick={() => setSelectedReportId(r.id)}
                              className="hover:text-blue-500 text-left font-sans text-sm"
                            >
                              {r.targetName}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 uppercase text-[10px] text-zinc-700 dark:text-zinc-300">
                              {r.targetType}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-sans">
                            {r.status === 'completed' ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                Completed
                              </span>
                            ) : r.status === 'running' ? (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold animate-pulse">
                                Scanning...
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[10px] font-bold">
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-1.5 font-bold">
                              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-600 dark:text-red-400 text-[10px]">
                                {r.criticalCount} C
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px]">
                                {r.highCount} H
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-[10px]">
                                {r.mediumCount} M
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px]">
                                {r.lowCount} L
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 font-sans">
                            {new Date(r.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => setSelectedReportId(r.id)}
                                title="View Interactive Security Report"
                                className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-blue-500 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={downloadUrl}
                                download
                                title="Download HTML Security Report"
                                className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              {isOperator && (
                                <button
                                  onClick={() => handleDelete(r.id)}
                                  title="Delete Report"
                                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      )}
    </div>
  );
};
