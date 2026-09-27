import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { RefreshCw, Terminal as TermIcon, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getWsUrl } from '../../utils/url';

interface WebTerminalProps {
  containerId: string;
  containerName: string;
}

export const WebTerminal: React.FC<WebTerminalProps> = ({ containerId, containerName }) => {
  const { token, isOperator } = useAuth();
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [shell, setShell] = useState<string>('/bin/sh');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const connect = () => {
    if (!token || !isOperator) return;

    setStatus('connecting');
    setErrorMessage('');

    // Clean up existing WebSocket if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Determine WS URL dynamically
    const wsUrl = getWsUrl('exec', {
      containerId,
      token,
      cmd: shell,
    });

    const ws = new WebSocket(wsUrl);

    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      if (termInstanceRef.current && fitAddonRef.current) {
        fitAddonRef.current.fit();
        termInstanceRef.current.focus();
        // Send initial size
        const cols = termInstanceRef.current.cols;
        const rows = termInstanceRef.current.rows;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'stdout' && termInstanceRef.current) {
          termInstanceRef.current.write(msg.data);
        } else if (msg.type === 'stderr' && termInstanceRef.current) {
          termInstanceRef.current.write(`\x1b[31m${msg.data}\x1b[0m`);
        } else if (msg.type === 'exit') {
          setStatus('disconnected');
          termInstanceRef.current?.write('\r\n\x1b[33mSession terminated by remote.\x1b[0m\r\n');
        }
      } catch {
        termInstanceRef.current?.write(event.data);
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setErrorMessage('WebSocket connection failed.');
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize XTerm.js
    const term = new Terminal({
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
      cursorBlink: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle user keystrokes
    term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddon && term && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          fitAddon.fit();
          wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        } catch {
          // ignore fit error if detached
        }
      }
    };

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    connect();

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (wsRef.current) wsRef.current.close();
      term.dispose();
    };
  }, [containerId, shell]);

  if (!isOperator) {
    return (
      <div className="p-8 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center">
        <ShieldAlert className="w-12 h-12 text-yellow-500 mb-3" />
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Terminal Access Restricted</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
          Your role (Viewer) does not permit interactive shell sessions inside running containers.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-[350px] bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Terminal Header */}
      <div className="h-10 bg-zinc-100 dark:bg-[#121215] border-b border-zinc-200 dark:border-zinc-800 px-3 sm:px-4 flex items-center justify-between transition-colors">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <div className="flex space-x-1.5 shrink-0">
            <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-red-500/80" />
            <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-800 shrink-0" />
          <div className="flex items-center space-x-1.5 min-w-0">
            <TermIcon className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[100px] sm:max-w-xs">
              {containerName}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <div className="hidden sm:flex items-center space-x-1">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : status === 'connecting'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">{status}</span>
          </div>

          <select
            value={shell}
            onChange={(e) => setShell(e.target.value)}
            className="text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 rounded px-2 py-0.5 font-mono focus:outline-none focus:border-blue-500"
          >
            <option value="/bin/sh">/bin/sh</option>
            <option value="/bin/bash">/bin/bash</option>
            <option value="/bin/ash">/bin/ash</option>
          </select>

          <button
            onClick={connect}
            title="Reconnect Shell"
            className="p-1 rounded bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div ref={terminalRef} className="flex-1 p-2 overflow-hidden bg-[#09090b] min-h-0" />
    </div>
  );
};
