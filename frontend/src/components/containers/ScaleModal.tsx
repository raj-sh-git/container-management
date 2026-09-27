import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ScalePanel } from './ScalePanel';
import {
  Boxes,
  X,
  Minus,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface ScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  containerId: string;
  containerName: string;
  onScaled?: () => void;
}

export const ScaleModal: React.FC<ScaleModalProps> = ({
  isOpen,
  onClose,
  containerId,
  containerName,
  onScaled,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  if (!isOpen) return null;

  if (isMinimized) {
    return createPortal(
      <div className="fixed bottom-5 right-5 z-[100] bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-5">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="p-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg border border-purple-500/20 shrink-0">
            <Boxes className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-zinc-900 dark:text-white truncate max-w-[150px]">Scale: {containerName}</p>
            <p className="text-[10px] text-zinc-400">Scaling Settings</p>
          </div>
        </div>
        <div className="flex items-center space-x-1 pl-2 border-l border-zinc-200 dark:border-zinc-800 shrink-0">
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl overflow-hidden transition-all ${
        isMaximized ? 'w-full h-full inset-0 rounded-none' : 'rounded-3xl max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/20 shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-zinc-900 dark:text-white truncate">
                Scale: {containerName}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                Manual replica management & metric-driven autoscaling
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Minimize"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
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
              className="p-1.5 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <ScalePanel
            containerId={containerId}
            containerName={containerName}
            onScaled={onScaled}
          />
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex items-center justify-between text-xs text-zinc-500 shrink-0">
          <span className="truncate">Target: {containerName}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold rounded-xl transition-colors shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
