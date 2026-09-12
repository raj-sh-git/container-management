import React, { useState, useEffect } from 'react';
import { ScanReport } from '../../types';
import { securityApi } from '../../services/api';
import {
  ShieldAlert,
  Download,
  ExternalLink,
  Search,
  Trash2,
  Clock,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface ReportViewerProps {
  reportId: string;
  onClose?: () => void;
  onDeleted?: () => void;
}

type SortField = 'id' | 'pkg' | 'severity';
type SortOrder = 'asc' | 'desc';

export const ReportViewer: React.FC<ReportViewerProps> = ({ reportId, onClose, onDeleted }) => {
  const [report, setReport] = useState<ScanReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc'); // CRITICAL first by default

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await securityApi.getReport(reportId);
        setReport(data);
      } catch (err) {
        console.error('Failed to load report:', err);
      }
      setLoading(false);
    }
    load();
  }, [reportId]);

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-zinc-400 space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading security report...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center text-zinc-400">
        <p>Report not found or has been deleted.</p>
      </div>
    );
  }

  const vulnerabilities: any[] = [];
  (report.data?.Results || []).forEach((res: any) => {
    (res.Vulnerabilities || []).forEach((v: any) => {
      vulnerabilities.push({
        target: res.Target,
        type: res.Type || 'package',
        id: v.VulnerabilityID,
        pkg: v.PkgName,
        installedVersion: v.InstalledVersion,
        fixedVersion: v.FixedVersion || 'None',
        severity: (v.Severity || 'UNKNOWN').toUpperCase(),
        title: v.Title || v.Description || 'No description provided',
        primaryURL: v.PrimaryURL || `https://nvd.nist.gov/vuln/detail/${v.VulnerabilityID}`,
      });
    });
  });

  const severityRank = (s: string) => {
    switch (s) {
      case 'CRITICAL': return 4;
      case 'HIGH': return 3;
      case 'MEDIUM': return 2;
      case 'LOW': return 1;
      default: return 0;
    }
  };

  // Filter
  const filteredVulns = vulnerabilities.filter((v) => {
    const matchesSev = severityFilter === 'ALL' || v.severity === severityFilter;
    const matchesSearch =
      !search ||
      v.id.toLowerCase().includes(search.toLowerCase()) ||
      v.pkg.toLowerCase().includes(search.toLowerCase()) ||
      v.title.toLowerCase().includes(search.toLowerCase());
    return matchesSev && matchesSearch;
  });

  // Sort
  filteredVulns.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'id') {
      cmp = a.id.localeCompare(b.id);
    } else if (sortField === 'pkg') {
      cmp = a.pkg.localeCompare(b.pkg);
    } else if (sortField === 'severity') {
      cmp = severityRank(a.severity) - severityRank(b.severity);
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'severity' ? 'desc' : 'asc');
    }
  };

  const getSeverityBadge = (s: string) => {
    switch (s) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-500 dark:text-orange-400 border-orange-500/20';
      case 'MEDIUM':
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20';
      case 'LOW':
        return 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20';
    }
  };

  const downloadHtmlUrl = securityApi.getReportHtmlUrl(report.id, true, sortField, sortOrder);

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this scan report?')) {
      await securityApi.deleteReport(report.id);
      if (onDeleted) onDeleted();
      if (onClose) onClose();
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-zinc-400 ml-1 inline" />;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-blue-500 ml-1 inline" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-blue-500 ml-1 inline" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="p-6 bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 dark:text-blue-400 border border-blue-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                  Trivy Scan: {report.targetName}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 uppercase font-mono font-medium">
                  {report.targetType}
                </span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(report.createdAt).toLocaleString()}</span>
                </span>
                <span>•</span>
                <span>Scanned by {report.createdBy || 'Admin'}</span>
                {report.durationMs && <span>• {report.durationMs}ms</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Export HTML Button */}
            <a
              href={downloadHtmlUrl}
              download
              title="Export standalone HTML Security Report"
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export HTML</span>
            </a>

            <button
              onClick={handleDelete}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-colors"
              title="Delete report"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Severity Count Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-red-500/20 rounded-xl">
            <div className="text-xl font-black text-red-500 dark:text-red-400">{report.criticalCount}</div>
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">Critical</div>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-orange-500/20 rounded-xl">
            <div className="text-xl font-black text-orange-500 dark:text-orange-400">{report.highCount}</div>
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">High</div>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-yellow-500/20 rounded-xl">
            <div className="text-xl font-black text-yellow-600 dark:text-yellow-400">{report.mediumCount}</div>
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">Medium</div>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-blue-500/20 rounded-xl">
            <div className="text-xl font-black text-blue-500 dark:text-blue-400">{report.lowCount}</div>
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">Low</div>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl">
            <div className="text-xl font-black text-zinc-800 dark:text-zinc-200">
              {report.criticalCount + report.highCount + report.mediumCount + report.lowCount}
            </div>
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">Total CVEs</div>
          </div>
        </div>
      </div>

      {/* Interactive Vulnerability Table */}
      <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    severityFilter === sev
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>

            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search CVE ID or package..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* CVE Table with Column Sorting */}
          <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800/80 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800 select-none">
                <tr>
                  <th
                    onClick={() => handleSort('id')}
                    className="py-3 px-4 cursor-pointer hover:text-blue-500 transition-colors"
                  >
                    <span>Vulnerability ID</span>
                    {renderSortIcon('id')}
                  </th>
                  <th
                    onClick={() => handleSort('pkg')}
                    className="py-3 px-4 cursor-pointer hover:text-blue-500 transition-colors"
                  >
                    <span>Package</span>
                    {renderSortIcon('pkg')}
                  </th>
                  <th className="py-3 px-4">Installed</th>
                  <th className="py-3 px-4">Fixed In</th>
                  <th
                    onClick={() => handleSort('severity')}
                    className="py-3 px-4 cursor-pointer hover:text-blue-500 transition-colors"
                  >
                    <span>Severity</span>
                    {renderSortIcon('severity')}
                  </th>
                  <th className="py-3 px-4">Title / Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
                {filteredVulns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-zinc-500 font-sans">
                      No vulnerabilities found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredVulns.map((v, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <a
                          href={v.primaryURL}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center space-x-1 text-blue-500 hover:underline font-bold"
                        >
                          <span>{v.id}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-3 px-4 text-zinc-900 dark:text-zinc-200 font-bold font-sans">{v.pkg}</td>
                      <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">{v.installedVersion}</td>
                      <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">{v.fixedVersion}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getSeverityBadge(v.severity)}`}>
                          {v.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-sans max-w-sm truncate" title={v.title}>
                        {v.title}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
};
