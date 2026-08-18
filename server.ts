import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { dbService } from './src/backend/database/db.js';
import { workerManager } from './src/backend/workers/WorkerManager.js';
import { jobManager } from './src/backend/jobs/JobManager.js';
import { mainNode } from './src/backend/MainNode.js';
import { apiRouter } from './src/backend/api/router.js';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize SQLite Database
  await dbService.init();

  // Initialize Worker & Job Managers
  await workerManager.init();
  await jobManager.init();

  // Start Main Node Controller
  await mainNode.start();

  // Mount API routes
  app.use('/api', apiRouter);

  // Explicit API 404 fallback to guarantee API requests NEVER fall through to static assets or SPA fallback
  app.use(['/api', '/api/*'], (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Global Express error handler for API requests to guarantee JSON error response
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.originalUrl?.startsWith('/api') || req.url?.startsWith('/api')) {
      console.error('API Error:', err);
      const status = typeof err.status === 'number' ? err.status : (typeof err.statusCode === 'number' ? err.statusCode : 500);
      return res.status(status).json({
        error: err.message || 'Internal server error',
      });
    }
    next(err);
  });

  const server = http.createServer(app);

  // WebSocket Server for Real-Time Monitoring
  interface AuthenticatedWebSocket extends WebSocket {
    user?: any;
  }

  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients: Set<AuthenticatedWebSocket> = new Set();

  wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
    clients.add(ws);

    try {
      const host = req.headers.host || 'localhost';
      const url = new URL(req.url || '', `http://${host}`);
      const token = url.searchParams.get('token');
      if (token) {
        const session = dbService.getSession(token);
        if (session) {
          const user = dbService.getUserById(session.user_id);
          if (user) {
            ws.user = user;
          }
        }
      }
    } catch (_) {}

    const isAdmin = ws.user?.role === 'Cluster Admin';
    const userJobs = ws.user
      ? isAdmin
        ? jobManager.getAllJobs()
        : jobManager.getJobsForUser(ws.user.id)
      : [];

    // Send initial snapshot
    ws.send(
      JSON.stringify({
        type: 'SNAPSHOT',
        data: {
          status: mainNode.getSystemStatus(),
          workers: workerManager.getAllWorkers(),
          jobs: userJobs,
        },
      })
    );

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  // Broadcast state changes to all connected clients
  const broadcastState = () => {
    if (clients.size === 0) return;
    const allJobs = jobManager.getAllJobs();
    const systemStatus = mainNode.getSystemStatus();
    const allWorkers = workerManager.getAllWorkers();

    clients.forEach((client: AuthenticatedWebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        const isAdmin = client.user?.role === 'Cluster Admin';
        const userJobs = client.user
          ? isAdmin
            ? allJobs
            : jobManager.getJobsForUser(client.user.id)
          : [];

        const payload = JSON.stringify({
          type: 'TICK',
          data: {
            status: systemStatus,
            workers: allWorkers,
            jobs: userJobs,
          },
        });
        client.send(payload);
      }
    });
  };

  mainNode.on('update', broadcastState);
  setInterval(broadcastState, 1000);

  // Vite development middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Rayva Cloud Main Node running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Rayva Cloud server:', err);
});
