import { WebSocket } from 'ws';
import { getDocker } from '../services/docker.service';

export function handleExecWs(ws: WebSocket, containerId: string, cmd: string = '/bin/sh') {
  const docker = getDocker();
  const container = docker.getContainer(containerId);

  const shellCommands = cmd ? [cmd] : ['/bin/bash', '/bin/sh', 'sh'];

  async function tryExec(shells: string[]) {
    const currentShell = shells[0];
    try {
      const execInstance = await container.exec({
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Cmd: [currentShell],
      });

      const stream = await execInstance.start({
        hijack: true,
        stdin: true,
        Tty: true,
      });

      // Forward Docker stream output to WebSocket
      stream.on('data', (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'stdout', data: chunk.toString('utf-8') }));
        }
      });

      stream.on('end', () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'exit', code: 0 }));
          ws.close();
        }
      });

      stream.on('error', (err: any) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'stderr', data: `\r\nStream error: ${err.message}\r\n` }));
        }
      });

      // Forward WebSocket input to Docker stream
      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === 'input') {
            stream.write(parsed.data);
          } else if (parsed.type === 'resize') {
            execInstance.resize({
              w: Math.max(1, parsed.cols || 80),
              h: Math.max(1, parsed.rows || 24),
            }).catch(() => {});
          }
        } catch {
          stream.write(message.toString());
        }
      });

      ws.on('close', () => {
        try {
          stream.end();
        } catch {}
      });

    } catch (err: any) {
      if (shells.length > 1) {
        tryExec(shells.slice(1));
      } else {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'stderr', data: `\r\nFailed to start terminal: ${err.message}\r\n` }));
          ws.close();
        }
      }
    }
  }

  tryExec(shellCommands);
}
