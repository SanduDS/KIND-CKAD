import db from '../db/index.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

export const PortModel = {
  /**
   * Allocate ports for a session (within a transaction)
   * Returns { apiPort, ingressPort, ingressHttpsPort }
   */
  allocatePorts(sessionId) {
    const { apiStart, apiEnd, ingressStart, ingressEnd, ingressHttpsStart, ingressHttpsEnd } = 
      config.kind.portRange;

    const allocate = db.transaction(() => {
      // Find available API port
      const apiPort = this.findAvailablePort(apiStart, apiEnd);
      if (!apiPort) {
        throw new Error('No available API port');
      }

      // Find available ingress port
      const ingressPort = this.findAvailablePort(ingressStart, ingressEnd);
      if (!ingressPort) {
        throw new Error('No available ingress port');
      }

      // Find available ingress HTTPS port
      const ingressHttpsPort = this.findAvailablePort(ingressHttpsStart, ingressHttpsEnd);
      if (!ingressHttpsPort) {
        throw new Error('No available ingress HTTPS port');
      }

      // Allocate all ports
      const insertStmt = db.prepare(`
        INSERT INTO allocated_ports (port, session_id, port_type)
        VALUES (?, ?, ?)
      `);

      insertStmt.run(apiPort, sessionId, 'api');
      insertStmt.run(ingressPort, sessionId, 'ingress');
      insertStmt.run(ingressHttpsPort, sessionId, 'ingress_https');

      logger.info('Allocated ports for session', { 
        sessionId, 
        apiPort, 
        ingressPort, 
        ingressHttpsPort 
      });

      return { apiPort, ingressPort, ingressHttpsPort };
    });

    return allocate();
  },

  /**
   * Find an available port within a range
   */
  findAvailablePort(start, end) {
    const stmt = db.prepare(`
      SELECT port FROM allocated_ports WHERE port BETWEEN ? AND ?
    `);
    const allocatedPorts = new Set(stmt.all(start, end).map(row => row.port));

    // Find first available port
    for (let port = start; port <= end; port++) {
      if (!allocatedPorts.has(port)) {
        return port;
      }
    }
    return null;
  },

  /**
   * Get ports for a session
   */
  getPortsForSession(sessionId) {
    const stmt = db.prepare(`
      SELECT port, port_type FROM allocated_ports WHERE session_id = ?
    `);
    const rows = stmt.all(sessionId);
    
    const result = {};
    for (const row of rows) {
      result[row.port_type] = row.port;
    }
    return result;
  },

  /**
   * Release ports for a session
   */
  releasePorts(sessionId) {
    const stmt = db.prepare('DELETE FROM allocated_ports WHERE session_id = ?');
    const result = stmt.run(sessionId);
    if (result.changes > 0) {
      logger.info('Released ports for session', { sessionId, count: result.changes });
    }
    return result.changes;
  },

  /**
   * Check if a specific port is available
   */
  isPortAvailable(port) {
    const stmt = db.prepare('SELECT port FROM allocated_ports WHERE port = ?');
    return !stmt.get(port);
  },

  /**
   * Get count of allocated ports
   */
  countAllocated() {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM allocated_ports');
    return stmt.get().count;
  },

  /**
   * Clean up orphaned port allocations
   */
  cleanupOrphanedPorts() {
    const stmt = db.prepare(`
      DELETE FROM allocated_ports 
      WHERE session_id NOT IN (SELECT id FROM sessions WHERE status = 'started')
    `);
    const result = stmt.run();
    if (result.changes > 0) {
      logger.info('Cleaned up orphaned port allocations', { count: result.changes });
    }
    return result.changes;
  },
};

export default PortModel;

