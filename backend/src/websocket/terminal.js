import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { URL } from 'url';
import { authenticateWebSocket } from '../api/middleware/auth.js';
import SessionModel from '../models/session.js';
import logger from '../utils/logger.js';

// Store active terminal connections
const activeConnections = new Map();

/**
 * Initialize WebSocket server for terminal connections
 */
export function initializeWebSocket(server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/terminal',
  });

  wss.on('connection', async (ws, req) => {
    let userId = null;
    let sessionId = null;
    let ptyProcess = null;

    try {
      // Parse URL and get token
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      sessionId = url.searchParams.get('sessionId');

      if (!token) {
        ws.close(4001, 'Token required');
        return;
      }

      if (!sessionId) {
        ws.close(4002, 'Session ID required');
        return;
      }

      // Authenticate
      let authResult;
      try {
        authResult = authenticateWebSocket(token);
        userId = authResult.userId;
      } catch (error) {
        ws.close(4003, 'Authentication failed');
        return;
      }

      // Verify session ownership
      const session = SessionModel.findById(sessionId);
      if (!session) {
        ws.close(4004, 'Session not found');
        return;
      }

      if (session.user_id !== userId) {
        ws.close(4005, 'Access denied');
        return;
      }

      if (session.status !== 'started') {
        ws.close(4006, 'Session not active');
        return;
      }

      logger.info('WebSocket connection established', { userId, sessionId });

      // Store connection
      const connectionId = `${userId}-${sessionId}`;
      if (activeConnections.has(connectionId)) {
        // Close existing connection
        const existing = activeConnections.get(connectionId);
        existing.ws.close(4007, 'New connection');
        if (existing.pty) {
          existing.pty.kill();
        }
      }

      // Spawn PTY process
      const containerName = `term-${session.cluster_name}`;
      ptyProcess = spawn('docker', ['exec', '-it', containerName, '/bin/bash'], {
        env: {
          ...process.env,
          TERM: 'xterm-256color',
        },
      });

      // Store connection
      activeConnections.set(connectionId, { ws, pty: ptyProcess, sessionId });

      // Handle PTY output -> WebSocket
      ptyProcess.stdout.on('data', (data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
        }
      });

      ptyProcess.stderr.on('data', (data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
        }
      });

      ptyProcess.on('exit', (code) => {
        logger.info('PTY process exited', { sessionId, code });
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'exit', code }));
          ws.close(1000, 'Process exited');
        }
      });

      ptyProcess.on('error', (error) => {
        logger.error('PTY process error', { sessionId, error: error.message });
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
      });

      // Handle WebSocket messages -> PTY
      ws.on('message', (message) => {
        try {
          const parsed = JSON.parse(message.toString());

          switch (parsed.type) {
            case 'input':
              if (ptyProcess && ptyProcess.stdin.writable) {
                ptyProcess.stdin.write(parsed.data);
              }
              break;

            case 'resize':
              // Note: resize not supported with basic spawn
              // Would need node-pty for proper resize support
              break;

            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }));
              break;

            default:
              logger.warn('Unknown message type', { type: parsed.type });
          }
        } catch (error) {
          logger.error('Failed to parse WebSocket message', { error: error.message });
        }
      });

      // Handle WebSocket close
      ws.on('close', (code, reason) => {
        logger.info('WebSocket connection closed', { 
          userId, 
          sessionId, 
          code, 
          reason: reason.toString() 
        });

        activeConnections.delete(connectionId);

        if (ptyProcess) {
          ptyProcess.kill();
        }
      });

      // Handle WebSocket error
      ws.on('error', (error) => {
        logger.error('WebSocket error', { userId, sessionId, error: error.message });
      });

      // Send connected message
      ws.send(JSON.stringify({ 
        type: 'connected', 
        sessionId,
        message: 'Terminal connected. Type commands to interact with your Kubernetes cluster.' 
      }));

    } catch (error) {
      logger.error('WebSocket connection error', { error: error.message });
      ws.close(4000, 'Connection error');
    }
  });

  // Periodic ping to keep connections alive
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  logger.info('WebSocket server initialized');
  return wss;
}

/**
 * Close all connections for a session
 */
export function closeSessionConnections(sessionId) {
  for (const [connectionId, connection] of activeConnections.entries()) {
    if (connection.sessionId === sessionId) {
      logger.info('Closing connection for session', { sessionId });
      connection.ws.close(1000, 'Session ended');
      if (connection.pty) {
        connection.pty.kill();
      }
      activeConnections.delete(connectionId);
    }
  }
}

/**
 * Broadcast message to all connections
 */
export function broadcast(message) {
  for (const connection of activeConnections.values()) {
    if (connection.ws.readyState === connection.ws.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  }
}

/**
 * Get count of active connections
 */
export function getConnectionCount() {
  return activeConnections.size;
}

export default { 
  initializeWebSocket, 
  closeSessionConnections, 
  broadcast,
  getConnectionCount,
};

