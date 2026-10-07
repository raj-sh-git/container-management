import React, { useState, useRef, useEffect } from "react";
import { SshProfile } from "../../types";
import { Server, Key, Lock, Eye, EyeOff, Upload, FileCode, X, Play, Bookmark, AlertTriangle, Trash2, HelpCircle } from "lucide-react";

export interface SshSessionConfig {
  id: string;
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "key";
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

interface Props {
  onConnect: (config: SshSessionConfig, remember: boolean) => void;
}

export const SshConnectionForm: React.FC<Props> = ({ onConnect }) => {
  const [host, setHost] = useState<string>('');
  const [port, setPort] = useState<number>(22);
  const [username, setUsername] = useState<string>('root');
  const [authMethod, setAuthMethod] = useState<'password' | 'key'>('password');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Key File State
  const [privateKey, setPrivateKey] = useState<string>('');
  const [keyFileName, setKeyFileName] = useState<string>('');
  const [keyFileSize, setKeyFileSize] = useState<number>(0);
  const [passphrase, setPassphrase] = useState<string>('');
  const [showPassphrase, setShowPassphrase] = useState<boolean>(false);
  const [showManualKeyText, setShowManualKeyText] = useState<boolean>(false);
  const [rememberHost, setRememberHost] = useState<boolean>(true);
  const [savedProfiles, setSavedProfiles] = useState<SshProfile[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("sshProfiles");
    if (saved) {
      try { setSavedProfiles(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

    const handleKeyFileSelect = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setPrivateKey(content || '');
      setKeyFileName(file.name);
      setKeyFileSize(file.size);
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleKeyFileSelect(e.dataTransfer.files[0]);
    }
  };

  const clearKeyFile = () => {
    setPrivateKey('');
    setKeyFileName('');
    setKeyFileSize(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const selectProfile = (p: SshProfile) => {
    setHost(p.host);
    setPort(p.port || 22);
    setUsername(p.username);
    setAuthMethod(p.authMethod);
    setErrorMessage("");
  };

  const removeProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newProfiles = savedProfiles.filter((p) => p.id !== id);
    setSavedProfiles(newProfiles);
    localStorage.setItem("sshProfiles", JSON.stringify(newProfiles));
  };
  
  const deleteProfile = removeProfile;

  const clearAllProfiles = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSavedProfiles([]);
    localStorage.removeItem("sshProfiles");
  };

  const onConnectSubmit = () => {
    if (!host.trim()) { setErrorMessage("Please enter a host or IP address."); return; }
    if (!username.trim()) { setErrorMessage("Please enter a username."); return; }
    if (authMethod === "password" && !password) { setErrorMessage("Please enter the password."); return; }
    if (authMethod === "key" && !privateKey.trim()) { setErrorMessage("Please upload or paste a private key."); return; }
    
    setErrorMessage("");
    onConnect({
      id: Date.now().toString(),
      host, port, username, authMethod, password, privateKey, passphrase
    }, rememberHost);
    
    setPassword("");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 items-start">
            {/* Main Connection Form (7 cols on md, 8 cols on lg) */}
            <div className="md:col-span-7 lg:col-span-8 p-5 sm:p-6 md:p-7 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl space-y-6 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
                <div className="flex items-center space-x-2.5">
                  <Server className="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0" />
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">Connection Configuration</h2>
                </div>

              {/* Preset for This Host */}
              <button
                type="button"
                onClick={() => {
                  setHost('localhost');
                  setPort(22);
                  if (!username) setUsername('root');
                }}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all"
                title="Automatically map to the underlying host VM running Container Manager"
              >
                <span>Target This Host (localhost)</span>
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
                <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="break-words min-w-0">{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage('')}
                  className="p-1 hover:bg-rose-500/20 rounded-lg shrink-0 text-rose-500 transition-colors"
                  title="Dismiss error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-4">
              {/* Host and Port Row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3 space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Host / IP Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="e.g. 192.168.1.50 or localhost"
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 font-mono"
                  />
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Tip: Entering <code className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[10px]">localhost</code> automatically routes to the host machine via smart gateway mapping.
                  </p>
                </div>

                <div className="sm:col-span-1 space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value) || 22)}
                    placeholder="22"
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 font-mono text-center focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Username <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. root or ubuntu"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                />
              </div>

              {/* Authentication Method Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Authentication Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('password')}
                    className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      authMethod === 'password'
                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/40 shadow-sm'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span>Password</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthMethod('key')}
                    className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      authMethod === 'key'
                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/40 shadow-sm'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <Key className="w-4 h-4" />
                    <span>Key File</span>
                  </button>
                </div>
              </div>

              {/* Conditional Auth: Password Input */}
              {authMethod === 'password' && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter SSH password"
                      className="w-full px-3.5 py-2.5 pr-10 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Conditional Auth: Key File Upload */}
              {authMethod === 'key' && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        Private Key File <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowManualKeyText(!showManualKeyText)}
                        className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-medium"
                      >
                        {showManualKeyText ? 'Upload file instead' : 'Or paste private key text'}
                      </button>
                    </div>

                    {!showManualKeyText ? (
                      /* Drag & Drop Upload Zone */
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleKeyFileSelect(e.target.files[0]);
                            }
                          }}
                        />

                        {keyFileName ? (
                          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between">
                            <div className="flex items-center space-x-2.5">
                              <FileCode className="w-5 h-5 text-sky-500 dark:text-sky-400" />
                              <div>
                                <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono">
                                  {keyFileName}
                                </span>
                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-2">
                                  ({(keyFileSize / 1024).toFixed(1)} KB)
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={clearKeyFile}
                              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                              title="Remove key file"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleFileDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className="p-6 border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-sky-500 dark:hover:border-sky-500 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-zinc-50/50 dark:bg-zinc-950/40"
                          >
                            <Upload className="w-6 h-6 text-zinc-400 mb-2" />
                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                              Click to browse or drag & drop private key file
                            </span>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                              Supports .pem, id_rsa, id_ed25519, .key
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Manual Text Area */
                      <div>
                        <textarea
                          rows={6}
                          value={privateKey}
                          onChange={(e) => setPrivateKey(e.target.value)}
                          placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[11px] font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Optional Key Passphrase */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Key Passphrase <span className="text-zinc-400 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassphrase ? 'text' : 'password'}
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="Leave blank if private key has no passphrase"
                        className="w-full px-3.5 py-2.5 pr-10 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassphrase(!showPassphrase)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        tabIndex={-1}
                      >
                        {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Remember host checkbox */}
              <div className="pt-2">
                <label className="flex items-center space-x-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberHost}
                    onChange={(e) => setRememberHost(e.target.checked)}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Save host & username to Quick Connect (credentials are never stored)</span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onConnectSubmit}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-600/25 transition-all"
                >
                  <Play className="w-4 h-4" />
                  <span>Connect to Host</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar / Quick Connect Profiles & Host Mapping (5 cols on md, 4 cols on lg) */}
          <div className="md:col-span-5 lg:col-span-4 space-y-5">
            <div className="p-5 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Bookmark className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                    Quick Connect Profiles
                  </h3>
                </div>

                {savedProfiles.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllProfiles}
                    className="flex items-center space-x-1 px-2 py-1 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all text-xs"
                    title="Clear all quick connect profiles"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold">Clear All</span>
                  </button>
                )}
              </div>

              {savedProfiles.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 text-xs">
                  <span>No saved profiles yet. Connected hosts will appear here.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedProfiles.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => selectProfile(p)}
                      className="p-3 bg-zinc-50 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800/80 rounded-xl cursor-pointer transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-mono font-bold text-zinc-900 dark:text-white truncate">
                          {p.username}@{p.host}
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center space-x-2 mt-0.5">
                          <span>Port {p.port}</span>
                          <span>•</span>
                          <span className="capitalize">{p.authMethod}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => deleteProfile(p.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-rose-500 transition-all"
                        title="Remove profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Smart Host Mapping Card */}
            <div className="p-4 bg-sky-500/5 border border-sky-500/20 rounded-2xl text-xs space-y-2">
              <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 font-bold">
                <HelpCircle className="w-4 h-4" />
                <span>Smart Host Routing</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                When Container Manager is deployed inside Docker, specifying <code className="font-mono text-zinc-800 dark:text-zinc-200">localhost</code> is automatically mapped to the underlying host VM gateway, enabling seamless host terminal access without manual IP configuration.
              </p>
            </div>
          </div>
        </div>
  );
};
