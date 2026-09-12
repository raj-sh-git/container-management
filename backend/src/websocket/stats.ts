import { WebSocket } from 'ws';
import { getDocker } from '../services/docker.service';

export function handleStatsWs(ws: WebSocket, containerId: string) {
  const docker = getDocker();
  const container = docker.getContainer(containerId);

  container.stats({ stream: true }, (err: any, stream: any) => {
    if (err) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
        ws.close();
      }
      return;
    }

    if (stream) {
      stream.on('data', (chunk: Buffer) => {
        try {
          const stats = JSON.parse(chunk.toString('utf-8'));

          // Calculate CPU %
          let cpuPercent = 0.0;
          const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
          const systemDelta = (stats.cpu_stats.system_cpu_usage || 0) - (stats.precpu_stats.system_cpu_usage || 0);
          const onlineCpus = stats.cpu_stats.online_cpus || (stats.cpu_stats.cpu_usage.percpu_usage || []).length || 1;

          if (systemDelta > 0 && cpuDelta > 0) {
            cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100.0;
          }

          // Calculate Memory Usage
          const memUsage = (stats.memory_stats.usage || 0) - (stats.memory_stats.stats?.cache || 0);
          const memLimit = stats.memory_stats.limit || 1;
          const memPercent = (memUsage / memLimit) * 100.0;

          // Calculate Network I/O
          let rxBytes = 0;
          let txBytes = 0;
          if (stats.networks) {
            Object.values(stats.networks).forEach((net: any) => {
              rxBytes += net.rx_bytes || 0;
              txBytes += net.tx_bytes || 0;
            });
          }

          // Calculate Block I/O
          let readBytes = 0;
          let writeBytes = 0;
          const ioServiceBytes = stats.blkio_stats?.io_service_bytes_recursive || [];
          ioServiceBytes.forEach((entry: any) => {
            if (entry.op === 'Read' || entry.op === 'read') readBytes += entry.value || 0;
            if (entry.op === 'Write' || entry.op === 'write') writeBytes += entry.value || 0;
          });

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'stats',
                data: {
                  timestamp: new Date().toISOString(),
                  cpuPercent: Math.round(cpuPercent * 100) / 100,
                  memUsage,
                  memLimit,
                  memPercent: Math.round(memPercent * 100) / 100,
                  network: { rxBytes, txBytes },
                  blockIO: { readBytes, writeBytes },
                  pids: stats.pids_stats?.current || 0,
                },
              })
            );
          }
        } catch {
          // Ignore JSON parse errors from partial chunks
        }
      });

      stream.on('error', (err: any) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
          ws.close();
        }
      });

      ws.on('close', () => {
        try {
          if (typeof stream.destroy === 'function') stream.destroy();
        } catch {}
      });
    }
  });
}
