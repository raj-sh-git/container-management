import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { SshSessionConfig } from './SshConnectionForm';
import { getWsUrl } from '../../utils/url';
import { 
  Terminal as TermIcon, 
  Maximize2, 
  Minimize2, 
  X, 
  Clock, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface Props {
  config: SshSessionConfig;
  isVisible?: boolean;
  onClose: (id: string) => void;
  onStatusChange?: (id: string, status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

export const SshTerminalInstance: React.FC<Props> = ({
  config,
  isVisible = true,
  onClose,
  onStatusChange,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keep a ref to onStatusChange so connect() doesn't need to re-bind
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  // Session timer
  useEffect(() => {
    let timer: any = null;
    if (status === 'connected') {
      timer = setInterval(() => {
        setSessionSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status]);

  // Disconnect helper
  const disconnectWs = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'disconnect' }));
        } catch {}
      }
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  }, []);

  // Connect helper
  const connect = useCallback(() => {
    disconnectWs();

    setStatus('connecting');
    setErrorMessage('');
    setSessionSeconds(0);
    onStatusChangeRef.current?.(config.id, 'connecting');

    const term = xtermRef.current;
    if (term) {
      term.clear();
      term.write(`\x1b[36mConnecting to ${config.username}@${config.host}:${config.port || 22}...\x1b[0m\r\n`);
    }

    const token = localStorage.getItem('token') || '';
    const wsUrl = getWsUrl('ssh', { token });
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const cols = term?.cols || 80;
      const rows = term?.rows || 24;
      ws.send(JSON.stringify({
        type: 'connect',
        ...config,
        cols,
        rows,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'status') {
          if (msg.status === 'connected') {
            setStatus('connected');
            onStatusChangeRef.current?.(config.id, 'connected');
            setTimeout(() => {
              try {
                fitAddonRef.current?.fit();
                term?.focus();
                if (ws.readyState === WebSocket.OPEN && term) {
                  ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
                }
              } catch (e) {}
            }, 50);
          } else if (msg.status === 'error') {
            setStatus('error');
            const err = msg.message || 'Connection failed';
            setErrorMessage(err);
            onStatusChangeRef.current?.(config.id, 'error');
          } else if (msg.status === 'disconnected') {
            setStatus('disconnected');
            onStatusChangeRef.current?.(config.id, 'disconnected');
          }
        } else if (msg.type === 'stdout' || msg.type === 'data') {
          term?.write(msg.data);
        } else if (msg.type === 'stderr') {
          term?.write(msg.data);
        } else if (msg.type === 'info') {
          term?.write(`\r\n\x1b[36m${msg.message}\x1b[0m\r\n`);
        } else if (msg.type === 'error') {
          setStatus('error');
          setErrorMessage(msg.message || 'Connection error');
          onStatusChangeRef.current?.(config.id, 'error');
          term?.write(`\r\n\x1b[31mError: ${msg.message}\x1b[0m\r\n`);
        } else if (msg.type === 'exit' || msg.type === 'close') {
          setStatus('disconnected');
          onStatusChangeRef.current?.(config.id, 'disconnected');
          term?.write('\r\n\x1b[33mConnection closed by remote host.\x1b[0m\r\n');
        }
      } catch {
        term?.write(event.data);
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setErrorMessage('WebSocket connection failed.');
      onStatusChangeRef.current?.(config.id, 'error');
    };

    ws.onclose = () => {
      setStatus((prev) => {
        if (prev === 'connected' || prev === 'connecting') {
          onStatusChangeRef.current?.(config.id, 'disconnected');
          return 'disconnected';
        }
        return prev;
      });
    };
  }, [config, disconnectWs]);

  // Initialize xterm on mount
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#09090b',
        foreground: '#f4f4f5',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f4f4f5',
        brightBlack: '#71717a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Send user keystrokes
    term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Send terminal window resize
    term.onResize(({ cols, rows }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    // Resize observer on container
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current && terminalRef.current.clientHeight > 0) {
        try {
          fitAddonRef.current.fit();
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && xtermRef.current) {
            wsRef.current.send(JSON.stringify({
              type: 'resize',
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            }));
          }
        } catch (e) {}
      }
    });
    resizeObserver.observe(terminalRef.current);

    // Initial connect
    connect();

    return () => {
      resizeObserver.disconnect();
      disconnectWs();
      term.dispose();
    };
  }, []); // Mount once per session instance

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      if (isVisible && fitAddonRef.current) {
        setTimeout(() => {
          try {
            fitAddonRef.current?.fit();
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && xtermRef.current) {
              wsRef.current.send(JSON.stringify({
                type: 'resize',
                cols: xtermRef.current.cols,
                rows: xtermRef.current.rows,
              }));
            }
          } catch (e) {}
        }, 80);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isVisible]);

  // Adjust fit and focus when visibility or fullscreen toggles
  useEffect(() => {
    if (isVisible && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          xtermRef.current?.focus();
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && xtermRef.current) {
            wsRef.current.send(JSON.stringify({
              type: 'resize',
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            }));
          }
        } catch (e) {}
      }, 50);
    }
  }, [isVisible, isFullscreen]);

  const handleClose = () => {
    disconnectWs();
    onClose(config.id);
  };

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-3 sm:inset-5 z-[200] flex flex-col bg-[#09090b] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl'
          : !isVisible
          ? 'hidden'
          : 'flex flex-col flex-1 min-h-0 w-full h-full bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl'
      }
      aria-hidden={!isVisible}
    >
      {/* Terminal Header */}
      <div className="h-11 bg-zinc-100 dark:bg-[#121215] border-b border-zinc-200 dark:border-zinc-800 px-3 sm:px-4 flex items-center justify-between transition-colors shrink-0">
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="flex space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              title="Close and Disconnect"
              className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-600 transition-colors flex items-center justify-center group"
            >
              <X className="w-2 h-2 text-white opacity-0 group-hover:opacity-100" />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-600 transition-colors flex items-center justify-center group"
            >
              <Maximize2 className="w-2 h-2 text-zinc-900 opacity-0 group-hover:opacity-100" />
            </button>
          </div>

          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-800 shrink-0" />

          <div className="flex items-center space-x-2 min-w-0">
            <TermIcon className="w-4 h-4 text-sky-500 shrink-0" />
            <span className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-[140px] sm:max-w-xs">
              {config.username}@{config.host}:{config.port || 22}
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 shrink-0 pl-1">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : status === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize font-medium">
              {status}
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          {status === 'connected' && (
            <div className="hidden md:flex items-center space-x-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mr-1">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {Math.floor(sessionSeconds / 60)}:{(sessionSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}

          {errorMessage && (
            <div
              className="hidden lg:flex items-center space-x-1 text-[11px] text-rose-500 truncate max-w-xs px-2 py-0.5 bg-rose-500/10 rounded-md border border-rose-500/20"
              title={errorMessage}
            >
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={connect}
            title="Reconnect SSH session"
            className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${status === 'connecting' ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleClose}
            title="Close and Disconnect"
            className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 hover:bg-rose-500/20 text-zinc-600 dark:text-zinc-400 hover:text-rose-500 border border-zinc-200 dark:border-zinc-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={terminalRef}
        onClick={() => xtermRef.current?.focus()}
        className="flex-1 p-2 sm:p-2.5 overflow-hidden bg-[#09090b] min-h-0 cursor-text"
      />
    </div>
  );
};
