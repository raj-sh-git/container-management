import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import url from 'url';
import jwt from 'jsonwebtoken';

import { config } from './config';
import { initDatabase, db } from './db';
import * as schema from './db/schema';
import { eq } from 'drizzle-orm';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import containerRoutes from './routes/container.routes';
import imageRoutes from './routes/image.routes';
import volumeRoutes from './routes/volume.routes';
import networkRoutes from './routes/network.routes';
import securityRoutes from './routes/security.routes';
import systemRoutes from './routes/system.routes';

import { handleExecWs } from './websocket/exec';
import { handleLogsWs } from './websocket/logs';
import { handleStatsWs } from './websocket/stats';
import { cleanupSchedulerService } from './services/cleanup-scheduler.service';

// Helper to match WebSocket endpoint from pathname (supports sub-paths like /cce/ws/exec or /ws/exec)
function getWsEndpoint(pathname: string | null): 'exec' | 'logs' | 'stats' | null {
  if (!pathname) return null;
  if (pathname.endsWith('/ws/exec')) return 'exec';
  if (pathname.endsWith('/ws/logs')) return 'logs';
  if (pathname.endsWith('/ws/stats')) return 'stats';
  return null;
}

async function bootstrap() {
  // 1. Initialize SQLite Database
  await initDatabase();

  // 2. Initialize Auto Clean-Up Scheduler Service
  cleanupSchedulerService.init();

  const app = express();

  app.set('trust proxy', true);
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  // 2. Register REST API Routes in an API Router
  const apiRouter = express.Router();
  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/users', userRoutes);
  apiRouter.use('/containers', containerRoutes);
  apiRouter.use('/images', imageRoutes);
  apiRouter.use('/volumes', volumeRoutes);
  apiRouter.use('/networks', networkRoutes);
  apiRouter.use('/security', securityRoutes);
  apiRouter.use('/system', systemRoutes);

  // Health check endpoint
  apiRouter.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      basePath: config.basePath || '/',
    });
  });

  // Mount API router at /api and also at ${config.basePath}/api if configured
  app.use('/api', apiRouter);
  if (config.basePath) {
    app.use(`${config.basePath}/api`, apiRouter);
  }

  // Serve static frontend assets if built
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    const indexHtmlPath = path.join(frontendDist, 'index.html');
    const indexHtmlTemplate = fs.existsSync(indexHtmlPath) ? fs.readFileSync(indexHtmlPath, 'utf-8') : '';

    const serveIndexHtml = (req: express.Request, res: express.Response) => {
      const runtimeBasePath = config.basePath || (req.headers['x-forwarded-prefix'] as string) || '';
      const normalizedBase = runtimeBasePath ? (runtimeBasePath.endsWith('/') ? runtimeBasePath.slice(0, -1) : runtimeBasePath) : '';

      let html = indexHtmlTemplate;
      if (html) {
        const injectedScript = `<script>window.__BASE_PATH__ = ${JSON.stringify(normalizedBase)};</script>`;
        if (html.includes('</head>')) {
          html = html.replace('</head>', `  ${injectedScript}\n</head>`);
        } else {
          html = injectedScript + html;
        }
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html || 'Docker Control Center is running.');
    };

    // If config.basePath is configured, handle subpath static assets and redirects
    if (config.basePath) {
      app.use((req, res, next) => {
        // Redirect exact /cce to /cce/
        const rawPath = req.baseUrl || req.path;
        if (rawPath === config.basePath && !req.originalUrl.startsWith(`${config.basePath}/`)) {
          const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
          return res.redirect(301, `${config.basePath}/${query}`);
        }
        next();
      });

      app.use(config.basePath, express.static(frontendDist, { index: false }));
      app.get(`${config.basePath}*`, (req, res, next) => {
        if (req.originalUrl.startsWith(`${config.basePath}/api`) || req.originalUrl.startsWith(`${config.basePath}/ws`)) {
          return next();
        }
        serveIndexHtml(req, res);
      });
    }

    // Default root static asset serving
    app.use(express.static(frontendDist, { index: false }));
    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/ws')) return next();
      serveIndexHtml(req, res);
    });

  }

  // 3. Create HTTP & WebSocket server
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Authenticate WebSocket connection via token in query params
  function authenticateWs(reqUrl: string): { valid: boolean; user?: any } {
    try {
      const parsedUrl = url.parse(reqUrl, true);
      const token = parsedUrl.query.token as string;
      if (!token) return { valid: false };

      const decoded: any = jwt.verify(token, config.jwtSecret);
      const user = db.select().from(schema.users).where(eq(schema.users.id, decoded.id)).get();
      if (!user || !user.isActive) return { valid: false };

      return { valid: true, user };
    } catch {
      return { valid: false };
    }
  }

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = url.parse(request.url || '', true);
    const endpoint = getWsEndpoint(pathname);

    if (endpoint) {
      const auth = authenticateWs(request.url || '');
      if (!auth.valid) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Check role permissions: Viewer cannot open exec terminal
      if (endpoint === 'exec' && auth.user.role === 'viewer') {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
    const { pathname, query } = url.parse(request.url || '', true);
    const endpoint = getWsEndpoint(pathname);
    const containerId = query.containerId as string;

    if (!containerId) {
      ws.send(JSON.stringify({ type: 'error', message: 'containerId is required' }));
      ws.close();
      return;
    }

    if (endpoint === 'exec') {
      const cmd = (query.cmd as string) || '/bin/sh';
      handleExecWs(ws, containerId, cmd);
    } else if (endpoint === 'logs') {
      const tail = query.tail ? parseInt(query.tail as string, 10) : 200;
      const timestamps = query.timestamps !== 'false';
      handleLogsWs(ws, containerId, tail, timestamps);
    } else if (endpoint === 'stats') {
      handleStatsWs(ws, containerId);
    }
  });

  server.listen(config.port, () => {
    console.log(`====================================================`);
    console.log(`[Engine] Docker Container Management Engine`);
    console.log(`[Server] Server running on http://localhost:${config.port}${config.basePath}`);
    console.log(`[Base Path] ${config.basePath || '/'}`);
    console.log(`[Docker] Docker Socket: ${config.dockerSocket}`);
    console.log(`[Admin] Default Admin: ${config.defaultAdminUser}`);
    console.log(`====================================================`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});

