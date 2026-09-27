import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Container, DockerImage } from '../../types';
import { securityApi } from '../../services/api';
import { ShieldAlert, X, Play, Loader2, Minus, Maximize2, Minimize2 } from 'lucide-react';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  containers: Container[];
  images: DockerImage[];
  onScanInitiated: () => void;
  initialTarget?: { type: 'image' | 'container'; name: string; id?: string };
}

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  containers,
  images,
  onScanInitiated,
  initialTarget,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [targetType, setTargetType] = useState<'image' | 'container'>(
    initialTarget?.type || 'image'
  );
  const [selectedTarget, setSelectedTarget] = useState<string>(
    initialTarget?.name || (images[0]?.repoTags[0] || '')
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTarget) {
      setError('Please select a target to scan.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let targetId: string | undefined;
      if (targetType === 'container') {
        const found = containers.find((c) => c.name === selectedTarget || c.id === selectedTarget);
        targetId = found?.id;
      } else {
        const found = images.find((img) => img.repoTags.includes(selectedTarget));
        targetId = found?.id;
      }

      await securityApi.scan(targetType, selectedTarget, targetId);
      onScanInitiated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to initiate scan.');
    } finally {
      setLoading(false);
    }
  };

  if (isMinimized) {
    return createPortal(
      <div className="fixed bottom-5 right-5 z-[100] bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-5">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg border border-blue-500/20">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-zinc-900 dark:text-white">Security Scan</p>
            <p className="text-[10px] text-zinc-400 truncate max-w-[150px]">{selectedTarget || 'Select target'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-1 pl-2 border-l border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Restore window"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setIsMinimized(false);
              setIsMaximized(false);
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className={`bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 transition-all overflow-hidden flex flex-col ${
        isMaximized ? 'w-full h-full inset-0 rounded-none max-w-none' : 'rounded-2xl max-w-lg w-full'
      }`}>
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 gap-3 min-w-0">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="p-2 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">Run Trivy Security Scan</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Scan for CVEs, packages & configurations</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Minimize"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title={isMaximized ? "Restore size" : "Maximize"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                setIsMinimized(false);
                setIsMaximized(false);
                onClose();
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
              Scan Target Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetType('image');
                  setSelectedTarget(images[0]?.repoTags[0] || '');
                }}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                  targetType === 'image'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Container Image
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetType('container');
                  setSelectedTarget(containers[0]?.name || '');
                }}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                  targetType === 'container'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Running Container
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
              Select {targetType === 'image' ? 'Image' : 'Container'}
            </label>
            {targetType === 'image' ? (
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-mono"
              >
                {images.map((img) => (
                  <option key={img.id} value={img.repoTags[0]}>
                    {img.repoTags.join(', ')} ({Math.round(img.size / 1024 / 1024)} MB)
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-mono"
              >
                {containers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.image}) - {c.state}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{loading ? 'Starting Scan...' : 'Start Scan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
