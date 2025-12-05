import { CronJob } from 'cron';
import SessionModel from '../models/session.js';
import PortModel from '../models/port.js';
import AuthModel from '../models/auth.js';
import KindService from './kind.js';
import TerminalService from './terminal.js';
import { closeSessionConnections } from '../websocket/terminal.js';
import logger from '../utils/logger.js';

/**
 * Cleanup expired sessions
 */
async function cleanupExpiredSessions() {
  logger.debug('Running expired sessions cleanup...');

  const expiredSessions = SessionModel.findExpired();

  if (expiredSessions.length === 0) {
    return;
  }

  logger.info('Found expired sessions', { count: expiredSessions.length });

  for (const session of expiredSessions) {
    try {
      logger.info('Cleaning up expired session', { 
        sessionId: session.id, 
        clusterName: session.cluster_name 
      });

      // Close WebSocket connections
      closeSessionConnections(session.id);

      // Cleanup resources
      const containerName = `term-${session.cluster_name}`;

      // Remove terminal container
      await TerminalService.removeContainer(containerName).catch(err => {
        logger.warn('Failed to remove terminal container', { 
          sessionId: session.id, 
          error: err.message 
        });
      });

      // Delete KIND cluster
      await KindService.cleanupCluster(session.cluster_name).catch(err => {
        logger.warn('Failed to cleanup cluster', { 
          sessionId: session.id, 
          error: err.message 
        });
      });

      // Release ports
      PortModel.releasePorts(session.id);

      // Update session status
      SessionModel.updateStatus(session.id, 'timeout', 'Session expired');

      logger.info('Expired session cleaned up', { sessionId: session.id });
    } catch (error) {
      logger.error('Failed to cleanup expired session', { 
        sessionId: session.id, 
        error: error.message 
      });
    }
  }
}

/**
 * Cleanup orphaned resources (runs on startup and periodically)
 */
async function cleanupOrphanedResources() {
  logger.info('Running orphaned resources cleanup...');

  try {
    // Get active sessions from DB
    const activeSessions = SessionModel.findAllActive();
    const validClusterNames = activeSessions.map(s => s.cluster_name);
    const validContainerNames = activeSessions.map(s => `term-${s.cluster_name}`);

    // Find orphaned KIND clusters
    const kindClusters = await KindService.listClusters();
    const orphanedClusters = kindClusters.filter(
      name => name.startsWith('ckad-') && !validClusterNames.includes(name)
    );

    for (const clusterName of orphanedClusters) {
      logger.info('Removing orphaned KIND cluster', { clusterName });
      await KindService.deleteCluster(clusterName).catch(err => {
        logger.warn('Failed to delete orphaned cluster', { 
          clusterName, 
          error: err.message 
        });
      });
    }

    // Find orphaned terminal containers
    const orphanedCount = await TerminalService.cleanupOrphanedContainers(validContainerNames);

    // Cleanup orphaned port allocations
    PortModel.cleanupOrphanedPorts();

    // Cleanup expired auth tokens
    AuthModel.cleanupExpiredRefreshTokens();
    AuthModel.cleanupOTPs();

    logger.info('Orphaned resources cleanup completed', {
      orphanedClusters: orphanedClusters.length,
      orphanedContainers: orphanedCount,
    });
  } catch (error) {
    logger.error('Failed to cleanup orphaned resources', { error: error.message });
  }
}

// Cleanup jobs
let expiredSessionsJob = null;
let orphanedResourcesJob = null;

/**
 * Start cleanup scheduler
 */
export function startCleanupScheduler() {
  // Run expired sessions cleanup every 30 seconds
  expiredSessionsJob = new CronJob(
    '*/30 * * * * *', // Every 30 seconds
    cleanupExpiredSessions,
    null,
    true,
    'UTC'
  );

  // Run orphaned resources cleanup every 5 minutes
  orphanedResourcesJob = new CronJob(
    '0 */5 * * * *', // Every 5 minutes
    cleanupOrphanedResources,
    null,
    true,
    'UTC'
  );

  logger.info('Cleanup scheduler started');

  // Run initial orphan cleanup on startup
  setTimeout(() => {
    cleanupOrphanedResources();
  }, 5000);
}

/**
 * Stop cleanup scheduler
 */
export function stopCleanupScheduler() {
  if (expiredSessionsJob) {
    expiredSessionsJob.stop();
  }
  if (orphanedResourcesJob) {
    orphanedResourcesJob.stop();
  }
  logger.info('Cleanup scheduler stopped');
}

export default {
  startCleanupScheduler,
  stopCleanupScheduler,
  cleanupExpiredSessions,
  cleanupOrphanedResources,
};

