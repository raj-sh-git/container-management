import { WebSocket } from 'ws';
import { getDocker } from '../services/docker.service';

export function handleLogsWs(ws: WebSocket, containerId: string, tail: number = 200, timestamps: boolean = true) {
  const docker = getDocker();
  const container = docker.getContainer(containerId);

  container.logs(
    {
      stdout: true,
      stderr: true,
      follow: true,
      tail,
      timestamps,
    },
    (err: any, stream: any) => {
      if (err) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
          ws.close();
        }
        return;
      }

      // Stream logs chunk by chunk
      if (stream) {
        stream.on('data', (chunk: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            // Docker stream contains header bytes in multiplexed format, slice or send
            const text = chunk.toString('utf-8');
            ws.send(JSON.stringify({ type: 'log', data: text }));
          }
        });

        stream.on('end', () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'end' }));
            ws.close();
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
    }
  );
}
