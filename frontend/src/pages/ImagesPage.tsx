import React, { useState } from 'react';
import { DockerImage, Container, ScanReport, RegistryAuth } from '../types';
import { imagesApi, securityApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ReportViewer } from '../components/security/ReportViewer';
import {
  Layers,
  DownloadCloud,
  Tag,
  Trash2,
  ShieldAlert,
  Search,
  RefreshCw,
  X,
  Loader2,
  List,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ImagesPageProps {
  images: DockerImage[];
  containers?: Container[];
  reports: ScanReport[];
  onRefresh: () => void;
  onOpenScanModal: (target: { type: 'image'; name: string; id: string }) => void;
}

export const ImagesPage: React.FC<ImagesPageProps> = ({
  images,
  containers = [],
  reports,
  onRefresh,
  onOpenScanModal,
}) => {
  const { isOperator } = useAuth();
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in-use' | 'unused'>('all');
  const [isPullModalOpen, setIsPullModalOpen] = useState<boolean>(false);
  const [pullImageName, setPullImageName] = useState<string>('');
  const [isPrivateRegistry, setIsPrivateRegistry] = useState<boolean>(false);
  const [registryServer, setRegistryServer] = useState<string>('https://index.docker.io/v1/');
  const [registryUsername, setRegistryUsername] = useState<string>('');
  const [registryPassword, setRegistryPassword] = useState<string>('');
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [pullMessage, setPullMessage] = useState<string>('');

  const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
  const [tagTargetImage, setTagTargetImage] = useState<DockerImage | null>(null);
  const [newRepo, setNewRepo] = useState<string>('');
  const [newTag, setNewTag] = useState<string>('latest');

  const [historyImage, setHistoryImage] = useState<DockerImage | null>(null);
  const [imageHistory, setImageHistory] = useState<any[]>([]);

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [scanningMap, setScanningMap] = useState<Record<string, boolean>>({});

  const isImageInUse = (img: DockerImage): boolean => {
    if (img.inUse !== undefined) return img.inUse;
    if (!containers || containers.length === 0) {
      return (typeof img.containers === 'number' && img.containers > 0) || false;
    }
    const cleanId = img.id.replace(/^sha256:/, '');
    return containers.some((c) => {
      const cCleanId = c.imageId ? c.imageId.replace(/^sha256:/, '') : '';
      const matchId = (cCleanId && cCleanId === cleanId) || c.imageId === img.id;
      const matchTag = img.repoTags.some(
        (t) => t !== '<none>:<none>' && (t === c.image || c.image === t.split(':')[0] || c.image.startsWith(t.split(':')[0] + ':'))
      );
      return matchId || matchTag;
    });
  };

  const inUseCount = images.filter((img) => isImageInUse(img)).length;
  const unusedCount = images.length - inUseCount;

  const filteredImages = images.filter((img) => {
    const inUse = isImageInUse(img);
    if (statusFilter === 'in-use' && !inUse) return false;
    if (statusFilter === 'unused' && inUse) return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      img.repoTags.some((t) => t.toLowerCase().includes(q)) ||
      img.shortId.toLowerCase().includes(q)
    );
  });


  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handlePull = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pullImageName.trim()) return;

    setIsPulling(true);
    setPullMessage('Connecting to registry and pulling image layers...');

    try {
      const auth: RegistryAuth | undefined =
        isPrivateRegistry && registryUsername
          ? {
              serveraddress: registryServer.trim() || undefined,
              username: registryUsername.trim(),
              password: registryPassword.trim(),
            }
          : undefined;

      await imagesApi.pull(pullImageName.trim(), auth);
      setPullMessage('Successfully pulled image!');
      onRefresh();
      setTimeout(() => {
        setIsPullModalOpen(false);
        setPullImageName('');
        setPullMessage('');
        setIsPrivateRegistry(false);
      }, 1200);
    } catch (err: any) {
      setPullMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsPulling(false);
    }
  };

  const handleTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagTargetImage || !newRepo.trim()) return;

    try {
      await imagesApi.tag(tagTargetImage.id, newRepo.trim(), newTag.trim());
      setIsTagModalOpen(false);
      setNewRepo('');
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to tag image');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove image '${name}'?`)) {
      try {
        await imagesApi.remove(id, true);
        onRefresh();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to remove image');
      }
    }
  };

  const openHistory = async (img: DockerImage) => {
    setHistoryImage(img);
    try {
      const history = await imagesApi.history(img.id);
      setImageHistory(history);
    } catch (err) {
      console.error(err);
    }
  };

  const getImageReport = (img: DockerImage) => {
    return reports.find(
      (r) => r.targetId === img.id || img.repoTags.some((t) => r.targetName === t)
    );
  };

  const handleDirectScan = async (img: DockerImage) => {
    const primaryTag = img.repoTags[0] || img.shortId;
    setScanningMap((prev) => ({ ...prev, [img.id]: true }));
    try {
      await securityApi.scan('image', primaryTag, img.id);
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to start image scan');
    } finally {
      setScanningMap((prev) => ({ ...prev, [img.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Container Images & Registry</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage local images, pull from public / private registries, tag & inspect layers
          </p>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <button
            onClick={onRefresh}
            className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors"
            title="Refresh images"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isOperator && (
            <button
              onClick={() => setIsPullModalOpen(true)}
              className="flex items-center space-x-2 px-3.5 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>Pull Image</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            All ({images.length})
          </button>
          <button
            onClick={() => setStatusFilter('in-use')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'in-use'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            In Use ({inUseCount})
          </button>
          <button
            onClick={() => setStatusFilter('unused')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'unused'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Unused ({unusedCount})
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search image tags or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      {/* Images Table */}
      <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4">Repository / Tag</th>
                <th className="py-3 px-4">Image ID</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4">Trivy Security</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
              {filteredImages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-500 font-sans">
                    No images found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredImages.map((img) => {
                  const report = getImageReport(img);
                  const primaryTag = img.repoTags[0] || '<none>:<none>';
                  const isScanning = scanningMap[img.id] || (report && report.status === 'running');
                  const isUnused = !isImageInUse(img);

                  return (
                    <tr key={img.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 font-sans text-sm">{primaryTag}</span>
                          {isUnused ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider shrink-0">
                              Unused
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider shrink-0">
                              In Use
                            </span>
                          )}
                        </div>
                        {img.repoTags.length > 1 && (
                          <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                            Also: {img.repoTags.slice(1).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">{img.shortId}</td>
                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">{formatBytes(img.size)}</td>
                      <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 font-sans">
                        {new Date(img.created * 1000).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4">
                        {(() => {
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
                                    onClick={() => handleDirectScan(img)}
                                    title="Rescan image"
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
                              onClick={() => handleDirectScan(img)}
                              className="text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                              title="Start scanning image"
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-blue-500" />
                              <span>Scan</span>
                            </button>
                          ) : (
                            <span className="text-zinc-400 text-[11px]">Unscanned</span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => openHistory(img)}
                            title="Inspect Layers"
                            className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                          >
                            <List className="w-3.5 h-3.5" />
                          </button>

                          {isOperator && (
                            <>
                              <button
                                onClick={() => {
                                  setTagTargetImage(img);
                                  setIsTagModalOpen(true);
                                }}
                                title="Tag Image"
                                className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-blue-500"
                              >
                                <Tag className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(img.id, primaryTag)}
                                title="Remove Image"
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
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

      {/* Pull Image Modal (Public & Private Registry) */}
      {isPullModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <DownloadCloud className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Pull Container Image</h3>
              </div>
              <button
                onClick={() => setIsPullModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePull} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Image Reference <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. nginx:alpine, redis:7, ghcr.io/org/repo:tag"
                  value={pullImageName}
                  onChange={(e) => setPullImageName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Private Registry Toggle */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-950/60 space-y-3">
                <div
                  onClick={() => setIsPrivateRegistry(!isPrivateRegistry)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center space-x-2">
                    <Lock className="w-3.5 h-3.5 text-blue-500" />
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      Private Registry Authentication
                    </span>
                  </div>
                  {isPrivateRegistry ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                </div>

                {isPrivateRegistry && (
                  <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                        Registry Server URL
                      </label>
                      <input
                        type="text"
                        placeholder="https://index.docker.io/v1/ or ghcr.io"
                        value={registryServer}
                        onChange={(e) => setRegistryServer(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-zinc-900 dark:text-zinc-200 font-mono focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          placeholder="username"
                          value={registryUsername}
                          onChange={(e) => setRegistryUsername(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-zinc-900 dark:text-zinc-200 font-mono focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                          Password / Token
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={registryPassword}
                          onChange={(e) => setRegistryPassword(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-zinc-900 dark:text-zinc-200 font-mono focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {pullMessage && (
                <div className="p-3 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">
                  {pullMessage}
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsPullModalOpen(false)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPulling}
                  className="flex items-center space-x-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/30 disabled:opacity-50"
                >
                  {isPulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                  <span>{isPulling ? 'Pulling...' : 'Pull Image'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tag Modal */}
      {isTagModalOpen && tagTargetImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Tag Image</h3>
              <button onClick={() => setIsTagModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTag} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Target Repository
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. my-org/app"
                  value={newRepo}
                  onChange={(e) => setNewRepo(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Tag Name
                </label>
                <input
                  type="text"
                  required
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsTagModalOpen(false)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/30"
                >
                  Apply Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Layers History Modal */}
      {historyImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Image Layers Breakdown</h3>
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{historyImage.repoTags[0]}</p>
              </div>
              <button
                onClick={() => setHistoryImage(null)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs">
              {imageHistory.map((layer, idx) => (
                <div key={idx} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-xl flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400">Layer {idx + 1}</span>
                    <p className="text-zinc-800 dark:text-zinc-200 break-all">{layer.CreatedBy || '<missing instruction>'}</p>
                  </div>
                  <span className="text-zinc-600 dark:text-zinc-400 font-bold shrink-0">{formatBytes(layer.Size)}</span>
                </div>
              ))}
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
