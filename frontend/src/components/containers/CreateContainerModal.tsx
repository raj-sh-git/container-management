import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { containersApi } from '../../services/api';
import { DockerImage, DockerNetwork } from '../../types';
import { Box, X, Plus, Trash2, Play, Loader2, Minus, Maximize2, Minimize2 } from 'lucide-react';

interface CreateContainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: DockerImage[];
  networks: DockerNetwork[];
  onCreated: () => void;
}

export const CreateContainerModal: React.FC<CreateContainerModalProps> = ({
  isOpen,
  onClose,
  images,
  networks,
  onCreated,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [image, setImage] = useState<string>('');
  const [command, setCommand] = useState<string>('');
  const [network, setNetwork] = useState<string>('bridge');
  const [restartPolicy, setRestartPolicy] = useState<'no' | 'always' | 'unless-stopped' | 'on-failure'>('unless-stopped');
  const [memoryLimitMB, setMemoryLimitMB] = useState<string>('');
  const [privileged, setPrivileged] = useState<boolean>(false);

  const [ports, setPorts] = useState<Array<{ hostPort: string; containerPort: string }>>([]);
  const [volumes, setVolumes] = useState<Array<{ hostPath: string; containerPath: string }>>([]);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);

  const [pullBeforeCreate, setPullBeforeCreate] = useState<boolean>(false);
  const [usePrivateRegistry, setUsePrivateRegistry] = useState<boolean>(false);
  const [registryServer, setRegistryServer] = useState<string>('');
  const [registryUsername, setRegistryUsername] = useState<string>('');
  const [registryPassword, setRegistryPassword] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const addPort = () => setPorts([...ports, { hostPort: '', containerPort: '' }]);
  const removePort = (idx: number) => setPorts(ports.filter((_, i) => i !== idx));

  const addVolume = () => setVolumes([...volumes, { hostPath: '', containerPath: '' }]);
  const removeVolume = (idx: number) => setVolumes(volumes.filter((_, i) => i !== idx));

  const addEnv = () => setEnvVars([...envVars, { key: '', value: '' }]);
  const removeEnv = (idx: number) => setEnvVars(envVars.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) {
      setError('Container image is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload: any = {
        name: name.trim() || undefined,
        image: image.trim(),
        network,
        restartPolicy,
        privileged,
        pullBeforeCreate,
      };

      if (usePrivateRegistry && (registryUsername || registryServer)) {
        payload.auth = {
          serveraddress: registryServer.trim() || undefined,
          username: registryUsername.trim() || undefined,
          password: registryPassword || undefined,
        };
      }

      if (command.trim()) {
        payload.command = command.trim().split(' ');
      }

      if (memoryLimitMB) {
        payload.memoryLimit = parseInt(memoryLimitMB, 10) * 1024 * 1024;
      }

      const validPorts = ports.filter((p) => p.hostPort && p.containerPort);
      if (validPorts.length > 0) {
        payload.ports = validPorts;
      }

      const validVolumes = volumes.filter((v) => v.hostPath && v.containerPath);
      if (validVolumes.length > 0) {
        payload.volumes = validVolumes;
      }

      const validEnvs = envVars.filter((e) => e.key);
      if (validEnvs.length > 0) {
        payload.env = validEnvs.map((e) => `${e.key}=${e.value}`);
      }

      const created = await containersApi.create(payload);
      // Auto-start container after creation
      if (created.Id) {
        await containersApi.start(created.Id);
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create container');
    } finally {
      setLoading(false);
    }
  };

  if (isMinimized) {
    return createPortal(
      <div className="fixed bottom-5 right-5 z-[100] bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-5">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg border border-blue-500/20">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-zinc-900 dark:text-white">Create Container</p>
            <p className="text-[10px] text-zinc-400">{image || 'Configuring...'}</p>
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
      <div className={`bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl animate-in fade-in zoom-in-95 transition-all overflow-hidden ${
        isMaximized ? 'w-full h-full inset-0 rounded-none' : 'rounded-2xl max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl border border-blue-500/20">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Create & Run Container</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Configure parameters, ports, volumes and resources</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Image <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. nginx:alpine or redis:latest"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                list="local-images"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
              />
              <datalist id="local-images">
                {images.map((img) => (
                  <option key={img.id} value={img.repoTags[0]} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Container Name
              </label>
              <input
                type="text"
                placeholder="e.g. my-web-app (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Pre-pull & Private Registry Options */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pullBeforeCreate}
                  onChange={(e) => setPullBeforeCreate(e.target.checked)}
                  className="rounded bg-zinc-100 dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-blue-600 focus:ring-0"
                />
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Pull latest image before deploy
                </span>
              </label>

              {pullBeforeCreate && (
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={usePrivateRegistry}
                    onChange={(e) => setUsePrivateRegistry(e.target.checked)}
                    className="rounded bg-zinc-100 dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-blue-600 focus:ring-0"
                  />
                  <span className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                    Private Registry Auth
                  </span>
                </label>
              )}
            </div>

            {pullBeforeCreate && usePrivateRegistry && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">
                    Registry Server
                  </label>
                  <input
                    type="text"
                    placeholder="docker.io / ghcr.io"
                    value={registryServer}
                    onChange={(e) => setRegistryServer(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 font-mono text-zinc-800 dark:text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    placeholder="Username"
                    value={registryUsername}
                    onChange={(e) => setRegistryUsername(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 font-mono text-zinc-800 dark:text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">
                    Password / Token
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={registryPassword}
                    onChange={(e) => setRegistryPassword(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 font-mono text-zinc-800 dark:text-zinc-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Command & Resources */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Custom Command (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. npm start or /bin/sh"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Memory Limit (MB)
              </label>
              <input
                type="number"
                placeholder="e.g. 512"
                value={memoryLimitMB}
                onChange={(e) => setMemoryLimitMB(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Network & Restart */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Network Mode
              </label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
              >
                <option value="bridge">bridge (default)</option>
                <option value="host">host</option>
                <option value="none">none</option>
                {networks
                  .filter((n) => !['bridge', 'host', 'none'].includes(n.Name))
                  .map((n) => (
                    <option key={n.Id || n.Name} value={n.Name}>
                      {n.Name} ({n.Driver})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Restart Policy
              </label>
              <select
                value={restartPolicy}
                onChange={(e) => setRestartPolicy(e.target.value as any)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
              >
                <option value="unless-stopped">Unless Stopped</option>
                <option value="always">Always</option>
                <option value="on-failure">On Failure</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          {/* Port Mappings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Port Bindings</span>
              <button
                type="button"
                onClick={addPort}
                className="flex items-center space-x-1 text-blue-500 hover:text-blue-400 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Port</span>
              </button>
            </div>
            {ports.map((p, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Host Port (e.g. 8080)"
                  value={p.hostPort}
                  onChange={(e) => {
                    const newPorts = [...ports];
                    newPorts[idx].hostPort = e.target.value;
                    setPorts(newPorts);
                  }}
                  className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-zinc-900 dark:text-zinc-200 font-mono focus:border-blue-500"
                />
                <span className="text-zinc-400 shrink-0">:</span>
                <input
                  type="text"
                  placeholder="Container Port (e.g. 80)"
                  value={p.containerPort}
                  onChange={(e) => {
                    const newPorts = [...ports];
                    newPorts[idx].containerPort = e.target.value;
                    setPorts(newPorts);
                  }}
                  className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-zinc-900 dark:text-zinc-200 font-mono focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removePort(idx)}
                  className="p-2 text-zinc-400 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Volume Mappings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Volume Mounts</span>
              <button
                type="button"
                onClick={addVolume}
                className="flex items-center space-x-1 text-blue-500 hover:text-blue-400 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Mount</span>
              </button>
            </div>
            {volumes.map((v, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Host / Volume Path (/var/data)"
                  value={v.hostPath}
                  onChange={(e) => {
                    const newVols = [...volumes];
                    newVols[idx].hostPath = e.target.value;
                    setVolumes(newVols);
                  }}
                  className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-zinc-900 dark:text-zinc-200 font-mono focus:border-blue-500"
                />
                <span className="text-zinc-400 shrink-0">:</span>
                <input
                  type="text"
                  placeholder="Container Mount (/app/data)"
                  value={v.containerPath}
                  onChange={(e) => {
                    const newVols = [...volumes];
                    newVols[idx].containerPath = e.target.value;
                    setVolumes(newVols);
                  }}
                  className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-zinc-900 dark:text-zinc-200 font-mono focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removeVolume(idx)}
                  className="p-2 text-zinc-400 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Environment Variables */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Environment Variables</span>
              <button
                type="button"
                onClick={addEnv}
                className="flex items-center space-x-1 text-blue-500 hover:text-blue-400 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Variable</span>
              </button>
            </div>
            {envVars.map((env, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="KEY (e.g. NODE_ENV)"
                  value={env.key}
                  onChange={(e) => {
                    const newEnvs = [...envVars];
                    newEnvs[idx].key = e.target.value;
                    setEnvVars(newEnvs);
                  }}
                  className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-zinc-900 dark:text-zinc-200 font-mono focus:border-blue-500"
                />
                <span className="text-zinc-400 shrink-0">=</span>
                <input
                  type="text"
                  placeholder="VALUE (e.g. production)"
                  value={env.value}
                  onChange={(e) => {
                    const newEnvs = [...envVars];
                    newEnvs[idx].value = e.target.value;
                    setEnvVars(newEnvs);
                  }}
                  className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-zinc-900 dark:text-zinc-200 font-mono focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removeEnv(idx)}
                  className="p-2 text-zinc-400 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Privileged flag */}
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="privileged"
              checked={privileged}
              onChange={(e) => setPrivileged(e.target.checked)}
              className="rounded bg-zinc-100 dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-blue-600 focus:ring-0"
            />
            <label htmlFor="privileged" className="text-zinc-700 dark:text-zinc-300 font-medium">
              Run in Privileged Mode (Full Host Capabilities)
            </label>
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{loading ? 'Deploying...' : 'Deploy & Start'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
