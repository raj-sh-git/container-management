import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getWsUrl } from '../../utils/url';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Cpu, Database, Network, HardDrive, Activity, Clock } from 'lucide-react';

interface StatsCardsProps {
  containerId: string;
}

interface StatPoint {
  time: string;
  cpu: number;
  memory: number;
}

type TimeInterval = '5s' | '10s' | '30s' | '1m' | '5m' | '15m' | '30m' | '1h';

export const StatsCards: React.FC<StatsCardsProps> = ({ containerId }) => {
  const { token } = useAuth();
  const [history, setHistory] = useState<StatPoint[]>([]);
  const [intervalOption, setIntervalOption] = useState<TimeInterval>('1m'); // Default 1 minute
  const [currentStats, setCurrentStats] = useState<{
    cpuPercent: number;
    memUsage: number;
    memLimit: number;
    memPercent: number;
    network: { rxBytes: number; txBytes: number };
    blockIO: { readBytes: number; writeBytes: number };
    pids: number;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const lastSampleTimeRef = useRef<number>(0);

  const getIntervalMs = (opt: TimeInterval) => {
    switch (opt) {
      case '5s': return 5000;
      case '10s': return 10000;
      case '30s': return 30000;
      case '1m': return 60000;
      case '5m': return 300000;
      case '15m': return 900000;
      case '30m': return 1800000;
      case '1h': return 3600000;
      default: return 60000;
    }
  };

  const getMaxPoints = (opt: TimeInterval) => {
    switch (opt) {
      case '5s': return 30; // 2.5 minutes
      case '10s': return 30; // 5 minutes
      case '30s': return 30; // 15 minutes
      case '1m': return 30; // 30 minutes
      case '5m': return 24; // 2 hours
      case '15m': return 24; // 6 hours
      case '30m': return 24; // 12 hours
      case '1h': return 24; // 24 hours
      default: return 30;
    }
  };

  useEffect(() => {
    if (!token) return;

    const wsUrl = getWsUrl('stats', {
      containerId,
      token,
    });

    const ws = new WebSocket(wsUrl);

    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'stats' && msg.data) {
          const d = msg.data;
          const now = Date.now();
          const targetInterval = getIntervalMs(intervalOption);

          // Update metrics cards AND chart history strictly according to the selected update interval
          if (now - lastSampleTimeRef.current >= targetInterval || lastSampleTimeRef.current === 0) {
            lastSampleTimeRef.current = now;
            setCurrentStats(d);
            const timeLabel = new Date(d.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            const maxPoints = getMaxPoints(intervalOption);

            setHistory((prev) => [
              ...prev.slice(-maxPoints + 1),
              {
                time: timeLabel,
                cpu: d.cpuPercent,
                memory: Math.round((d.memUsage / (1024 * 1024)) * 10) / 10, // MB
              },
            ]);
          }
        }
      } catch {}
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [containerId, intervalOption]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Interval / Window Selector Header */}
      <div className="p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
            Live Container Metrics
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs text-zinc-500 font-medium">Update Interval:</span>
          <select
            value={intervalOption}
            onChange={(e) => {
              setIntervalOption(e.target.value as TimeInterval);
              lastSampleTimeRef.current = 0;
            }}
            className="text-xs bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl px-3 py-1.5 font-mono focus:outline-none focus:border-blue-500 font-semibold"
          >
            <option value="5s">5 seconds</option>
            <option value="10s">10 seconds</option>
            <option value="30s">30 seconds</option>
            <option value="1m">1 minute (Default)</option>
            <option value="5m">5 minutes</option>
            <option value="15m">15 minutes</option>
            <option value="30m">30 minutes</option>
            <option value="1h">1 hour</option>
          </select>
        </div>
      </div>

      {/* Metrics Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Card */}
        <div className="p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">CPU Usage</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-zinc-900 dark:text-white">
              {currentStats ? `${currentStats.cpuPercent}%` : '--'}
            </div>
            <div className="mt-2 w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, currentStats?.cpuPercent || 0)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Memory Card */}
        <div className="p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Memory</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-zinc-900 dark:text-white">
              {currentStats ? formatBytes(currentStats.memUsage) : '--'}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">
              Limit: {currentStats ? formatBytes(currentStats.memLimit) : '--'} ({currentStats?.memPercent || 0}%)
            </div>
            <div className="mt-2 w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, currentStats?.memPercent || 0)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Network I/O Card */}
        <div className="p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Network I/O</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 dark:text-purple-400">
              <Network className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 font-mono">
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              RX (In): {currentStats ? formatBytes(currentStats.network.rxBytes) : '--'}
            </div>
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-1">
              TX (Out): {currentStats ? formatBytes(currentStats.network.txBytes) : '--'}
            </div>
          </div>
        </div>

        {/* Block I/O Card */}
        <div className="p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Disk Block I/O</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 dark:text-amber-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 font-mono">
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Read: {currentStats ? formatBytes(currentStats.blockIO.readBytes) : '--'}
            </div>
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-1">
              Write: {currentStats ? formatBytes(currentStats.blockIO.writeBytes) : '--'}
            </div>
          </div>
        </div>
      </div>

      {/* Live Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU History */}
        <div className="p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">CPU Usage (%)</h4>
            </div>
            <span className="text-xs text-zinc-500 font-mono">Window: {intervalOption}</span>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#71717a" fontSize={10} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                />
                <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fillOpacity={1} fill="url(#cpuGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory History */}
        <div className="p-4 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">Memory Usage (MB)</h4>
            </div>
            <span className="text-xs text-zinc-500 font-mono">Window: {intervalOption}</span>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#71717a" fontSize={10} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} unit="MB" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                />
                <Area type="monotone" dataKey="memory" stroke="#10b981" fillOpacity={1} fill="url(#memGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
