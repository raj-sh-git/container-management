import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';

dotenv.config();

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const reportsDir = path.join(dataDir, 'reports');

// Ensure data and reports directories exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Auto-detect Docker Socket
function getDockerSocket(): string {
  if (process.env.DOCKER_SOCKET && fs.existsSync(process.env.DOCKER_SOCKET)) {
    return process.env.DOCKER_SOCKET;
  }

  const candidateSockets = [
    '/var/run/docker.sock',
    path.join(os.homedir(), '.orbstack/run/docker.sock'),
    path.join(os.homedir(), '.docker/run/docker.sock'),
    path.join(os.homedir(), '.colima/default/docker.sock'),
  ];

  for (const sock of candidateSockets) {
    if (fs.existsSync(sock)) {
      return sock;
    }
  }

  return process.env.DOCKER_SOCKET || '/var/run/docker.sock';
}

// Normalize Sub-path / Base Path (e.g. '/cce', '/control-center', or '' for root)
function normalizeBasePath(rawPath?: string): string {
  if (!rawPath || rawPath.trim() === '' || rawPath.trim() === '/') {
    return '';
  }
  let p = rawPath.trim();
  if (!p.startsWith('/')) {
    p = '/' + p;
  }
  if (p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  basePath: normalizeBasePath(process.env.BASE_PATH || process.env.SUB_PATH || process.env.URL_PREFIX || ''),
  jwtSecret: process.env.JWT_SECRET || 'super-secret-container-management-jwt-token-key-2026',
  dockerSocket: getDockerSocket(),
  dockerHost: process.env.DOCKER_HOST,
  dockerPort: process.env.DOCKER_PORT ? parseInt(process.env.DOCKER_PORT, 10) : undefined,
  dataDir,
  reportsDir,
  dbPath: path.join(dataDir, 'app.db'),
  defaultAdminUser: process.env.DEFAULT_ADMIN_USER || 'admin',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
  trivyBinary: process.env.TRIVY_PATH || 'trivy',
};

