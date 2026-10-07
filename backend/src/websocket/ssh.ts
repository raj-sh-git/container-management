import { WebSocket } from 'ws';
import { Client, ConnectConfig } from 'ssh2';
import fs from 'fs';
import dns from 'dns';
import crypto from 'crypto';
import { db } from '../db';
import * as schema from '../db/schema';

/**
 * Smart host resolution:
 * When target is localhost or 127.0.0.1 and running inside a container,
 * resolve to the host VM (via host.docker.internal or bridge default gateway).
 */
export async function resolveSshHost(host: string): Promise<{ resolvedHost: string; isMapped: boolean; originalHost: string }> {
  const trimmed = (host || '').trim();
  const isLocal = trimmed.toLowerCase() === 'localhost' || trimmed === '127.0.0.1' || trimmed === '::1';

  if (!isLocal) {
    return { resolvedHost: trimmed, isMapped: false, originalHost: trimmed };
  }

  // Check if running inside a Docker container
  let isContainer = false;
  try {
    if (fs.existsSync('/.dockerenv')) {
      isContainer = true;
    } else if (fs.existsSync('/proc/1/cgroup') && fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker')) {
      isContainer = true;
    }
  } catch {}

  if (!isContainer) {
    return { resolvedHost: trimmed, isMapped: false, originalHost: trimmed };
  }

  // Inside container: test host.docker.internal first
  try {
    await dns.promises.lookup('host.docker.internal');
    return { resolvedHost: 'host.docker.internal', isMapped: true, originalHost: trimmed };
  } catch {}

  // Fallback: discover default gateway from /proc/net/route
  try {
    if (fs.existsSync('/proc/net/route')) {
      const routes = fs.readFileSync('/proc/net/route', 'utf8');
      const lines = routes.split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        // Destination 00000000 is default route
        if (parts[1] === '00000000' && parts[2]) {
          const hex = parts[2];
          const b1 = parseInt(hex.substring(6, 8), 16);
          const b2 = parseInt(hex.substring(4, 6), 16);
          const b3 = parseInt(hex.substring(2, 4), 16);
          const b4 = parseInt(hex.substring(0, 2), 16);
          const gatewayIp = `${b1}.${b2}.${b3}.${b4}`;
          if (gatewayIp && gatewayIp !== '0.0.0.0') {
            return { resolvedHost: gatewayIp, isMapped: true, originalHost: trimmed };
          }
        }
      }
    }
  } catch {}

  // Default fallback if DNS lookup fails
  return { resolvedHost: 'host.docker.internal', isMapped: true, originalHost: trimmed };
}

export function handleSshWs(ws: WebSocket, adminUser: any) {
  let conn: Client | null = null;
  let isConnected = false;
  let currentHost = '';
  let currentPort = 22;
  let currentUsername = 'root';

  // Audit log helper
  const logSshEvent = (action: string, details: string, host: string) => {
    try {
      db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        userId: adminUser?.id || null,
        username: adminUser?.username || 'admin',
        action,
        resourceType: 'system',
        resourceId: host,
        details,
        createdAt: new Date().toISOString(),
      }).run();
    } catch (err) {
      console.error('[SSH] Failed to log audit event:', err);
    }
  };

  ws.on('message', async (data: string | Buffer) => {
    try {
      const msg = JSON.parse(data.toString());

      // Disconnect requested by client
      if (msg.type === 'disconnect') {
        if (conn) {
          try {
            conn.end();
            conn.destroy();
          } catch {}
        }
        if (isConnected) {
          logSshEvent('SSH_DISCONNECT', `Disconnected from ${currentUsername}@${currentHost}:${currentPort}`, currentHost);
          isConnected = false;
        }
        return;
      }

      // 1. Connection initiation payload
      if (msg.type === 'connect') {
        const {
          host = '',
          port = 22,
          username = 'root',
          authMethod = 'password',
          password,
          privateKey,
          passphrase,
          cols: reqCols,
          rows: reqRows,
        } = msg;

        if (!host || !host.trim()) {
          ws.send(JSON.stringify({ type: 'error', message: 'Host is required.' }));
          return;
        }

        if (!username || !username.trim()) {
          ws.send(JSON.stringify({ type: 'error', message: 'Username is required.' }));
          return;
        }

        if (authMethod === 'password' && !password) {
          ws.send(JSON.stringify({ type: 'error', message: 'Password is required for password authentication.' }));
          return;
        }

        if (authMethod === 'key' && !privateKey) {
          ws.send(JSON.stringify({ type: 'error', message: 'Private key is required for key authentication.' }));
          return;
        }

        currentHost = host.trim();
        currentPort = Number(port) || 22;
        currentUsername = username.trim();

        // Apply smart host mapping
        const { resolvedHost, isMapped } = await resolveSshHost(host);

        if (isMapped) {
          ws.send(JSON.stringify({
            type: 'info',
            message: `[Smart Routing] '${host}' mapped to host machine gateway (${resolvedHost})`,
          }));
        }

        ws.send(JSON.stringify({
          type: 'status',
          status: 'connecting',
          message: `Establishing SSH connection to ${currentUsername}@${resolvedHost}:${currentPort}...`,
        }));

        conn = new Client();

        const connectConfig: ConnectConfig = {
          host: resolvedHost,
          port: currentPort,
          username: currentUsername,
          readyTimeout: 20000,
          keepaliveInterval: 10000,
          keepaliveCountMax: 3,
        };

        if (authMethod === 'password') {
          connectConfig.password = password;
        } else if (authMethod === 'key') {
          connectConfig.privateKey = privateKey;
          if (passphrase) {
            connectConfig.passphrase = passphrase;
          }
        }

        conn.on('ready', () => {
          isConnected = true;
          logSshEvent('SSH_CONNECT', `Connected to ${currentUsername}@${currentHost}:${currentPort} (${resolvedHost})`, currentHost);

          ws.send(JSON.stringify({
            type: 'status',
            status: 'connected',
            message: `SSH Connection Established to ${currentUsername}@${currentHost}:${currentPort}`,
          }));

          const initialCols = Math.max(1, Number(reqCols) || 80);
          const initialRows = Math.max(1, Number(reqRows) || 24);

          conn!.shell({ term: 'xterm-256color', cols: initialCols, rows: initialRows }, (err, stream) => {
            if (err) {
              ws.send(JSON.stringify({
                type: 'stderr',
                data: `\r\n\x1b[31m[SSH] Failed to allocate shell: ${err.message}\x1b[0m\r\n`,
              }));
              conn?.end();
              conn?.destroy();
              return;
            }

            // Stream stdout from SSH to WebSocket
            stream.on('data', (chunk: Buffer) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'stdout', data: chunk.toString('utf-8') }));
              }
            });

            // Stream stderr from SSH to WebSocket
            stream.stderr.on('data', (chunk: Buffer) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'stderr', data: chunk.toString('utf-8') }));
              }
            });

            stream.on('close', () => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'exit', code: 0 }));
              }
              try {
                conn?.end();
                conn?.destroy();
              } catch {}
            });

            // Listen for input / resize messages from client
            const messageHandler = (clientData: string | Buffer) => {
              try {
                const clientMsg = JSON.parse(clientData.toString());
                if (clientMsg.type === 'input' || clientMsg.type === 'data') {
                  stream.write(clientMsg.data);
                } else if (clientMsg.type === 'resize') {
                  const cols = Math.max(1, clientMsg.cols || 80);
                  const rows = Math.max(1, clientMsg.rows || 24);
                  stream.setWindow(rows, cols, 0, 0);
                } else if (clientMsg.type === 'disconnect') {
                  try {
                    conn?.end();
                    conn?.destroy();
                  } catch {}
                }
              } catch {
                stream.write(clientData.toString());
              }
            };

            ws.on('message', messageHandler);

            conn!.on('close', () => {
              ws.removeListener('message', messageHandler);
            });
          });
        });

        conn.on('error', (err: any) => {
          console.error('[SSH] Connection error:', err.message);
          let friendlyMsg = err.message || 'SSH connection failed.';
          if (err.level === 'client-authentication') {
            friendlyMsg = 'Authentication failed. Please verify username, password, or private key.';
          } else if (err.code === 'ECONNREFUSED') {
            friendlyMsg = `Connection refused on ${resolvedHost}:${currentPort}. Please verify the SSH server is running.`;
          } else if (err.code === 'ETIMEDOUT' || err.message.includes('Timed out')) {
            friendlyMsg = `Connection timed out connecting to ${resolvedHost}:${currentPort}.`;
          }

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'error',
              message: friendlyMsg,
            }));
            ws.send(JSON.stringify({
              type: 'stderr',
              data: `\r\n\x1b[31m[SSH Error] ${friendlyMsg}\x1b[0m\r\n`,
            }));
          }
        });

        conn.on('end', () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'status', status: 'disconnected', message: 'SSH session closed.' }));
          }
        });

        conn.on('close', () => {
          if (isConnected) {
            logSshEvent('SSH_DISCONNECT', `Disconnected from ${currentUsername}@${currentHost}:${currentPort}`, currentHost);
            isConnected = false;
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
          }
        });

        conn.connect(connectConfig);
      }
    } catch (err: any) {
      console.error('[SSH] Failed to process message:', err);
    }
  });

  ws.on('close', () => {
    if (conn) {
      try {
        conn.end();
        conn.destroy();
      } catch {}
    }
    if (isConnected) {
      logSshEvent('SSH_DISCONNECT', `Disconnected from ${currentUsername}@${currentHost}:${currentPort}`, currentHost);
      isConnected = false;
    }
  });
}
