import { WebSocketServer } from 'ws';
import { spawn } from 'node-pty';
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
        // Distinguish between expired and invalid tokens
        const isExpired = error.name === 'TokenExpiredError';
        const closeCode = isExpired ? 4003 : 4004;
        const closeReason = isExpired ? 'Token expired - refresh required' : 'Authentication failed';
        logger.warn('WebSocket authentication failed', { 
          error: error.message, 
          errorType: error.name,
          isExpired 
        });
        ws.close(closeCode, closeReason);
        return;
      }

      // Verify session ownership
      const session = SessionModel.findById(sessionId);
      if (!session) {
        ws.close(4005, 'Session not found');
        return;
      }

      if (session.user_id !== userId) {
        ws.close(4006, 'Access denied');
        return;
      }

      if (session.status !== 'started') {
        ws.close(4007, 'Session not active');
        return;
      }

      logger.info('WebSocket connection established', { userId, sessionId });

      // Initialize WebSocket heartbeat
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Store connection
      const connectionId = `${userId}-${sessionId}`;
      if (activeConnections.has(connectionId)) {
        // Close existing connection
        const existing = activeConnections.get(connectionId);
        existing.ws.close(4008, 'New connection');
        if (existing.pty) {
          existing.pty.kill();
        }
      }

      // Spawn PTY process - use docker exec directly for cleaner terminal handling
      const containerName = `term-${session.cluster_name}`;
      
      // Use docker exec directly without socat for better compatibility
      // This provides cleaner output without rendering artifacts
      ptyProcess = spawn('docker', [
        'exec',
        '-it',
        containerName,
        '/bin/bash'
      ], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: process.env.HOME,
        env: {
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          COLUMNS: '120',
          LINES: '30',
        },
      });

      // Store connection
      activeConnections.set(connectionId, { ws, pty: ptyProcess, sessionId });

      // Log PTY creation
      logger.info('PTY process created', { 
        sessionId, 
        containerName
      });

      // Initialize terminal with proper settings for line wrapping
      // Wait for bash to be ready, then set terminal properties
      setTimeout(() => {
        if (ptyProcess && ws.readyState === ws.OPEN) {
          // Clear screen without showing commands
          // The COLUMNS and LINES env vars should handle the dimensions
          ptyProcess.write('clear\r');
        }
      }, 200);

      // Handle PTY output -> WebSocket
      ptyProcess.on('data', (data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data }));
        }
      });

      ptyProcess.on('exit', (exitCode, signal) => {
        const uptime = Date.now() - (ptyProcess._startTime || Date.now());
        logger.info('PTY process exited', { 
          sessionId, 
          exitCode, 
          signal,
          uptimeMs: uptime
        });
        
        // If exited too quickly, might be an error
        if (uptime < 5000 && exitCode !== 0) {
          logger.error('PTY exited abnormally soon after start', {
            sessionId,
            exitCode,
            signal,
            uptimeMs: uptime
          });
        }
        
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
          ws.close(1000, 'Process exited');
        }
        activeConnections.delete(connectionId);
      });

      // Track start time for debugging
      ptyProcess._startTime = Date.now();

      // Handle WebSocket messages -> PTY
      ws.on('message', (message) => {
        try {
          const parsed = JSON.parse(message.toString());

          switch (parsed.type) {
            case 'input':
              if (ptyProcess) {
                ptyProcess.write(parsed.data);
              }
              break;

            case 'resize':
              if (ptyProcess && parsed.cols && parsed.rows) {
                try {
                  // PTY resize automatically updates the terminal dimensions
                  // No need to write stty commands which would be visible
                  ptyProcess.resize(parsed.cols, parsed.rows);
                } catch (error) {
                  logger.error('Failed to resize PTY', { sessionId, error: error.message });
                }
              }
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



