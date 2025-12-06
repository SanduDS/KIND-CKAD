import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config/index.js';
import SessionModel from '../../models/session.js';
import TaskModel from '../../models/task.js';
import PortModel from '../../models/port.js';
import KindService from '../../services/kind.js';
import TerminalService from '../../services/terminal.js';
import { authenticate } from '../middleware/auth.js';
import { sessionStartLimiter } from '../middleware/rateLimit.js';
import { 
  asyncHandler, 
  ValidationError, 
  ConflictError, 
  NotFoundError 
} from '../middleware/errorHandler.js';
import logger from '../../utils/logger.js';

const router = Router();

/**
 * POST /api/session/start
 * Create a new practice session
 */
router.post('/start', authenticate, sessionStartLimiter, asyncHandler(async (req, res) => {
  const userId = req.userId;

  // Check if user already has an active session
  const existingSession = SessionModel.findActiveByUserId(userId);
  if (existingSession) {
    throw new ConflictError('You already have an active session. Please end it before starting a new one.');
  }

  // Check global session limit
  const activeCount = SessionModel.countActive();
  if (activeCount >= config.session.maxConcurrent) {
    throw new ConflictError(
      `Maximum concurrent sessions (${config.session.maxConcurrent}) reached. Please try again later.`
    );
  }

  // Generate cluster name
  const shortId = uuidv4().split('-')[0];
  const clusterName = `ckad-${shortId}`;

  logger.info('Starting new session', { userId, clusterName });

  // Create a placeholder session to reserve the slot
  const session = SessionModel.create({
    userId,
    clusterName,
    kubeconfigPath: null,
    terminalContainerId: null,
  });

  try {
    // Allocate ports
    const ports = PortModel.allocatePorts(session.id);
    logger.info('Ports allocated', { sessionId: session.id, ports });

    // Create KIND cluster
    const clusterResult = await KindService.createCluster(clusterName, ports);
    
    // Update session with kubeconfig path
    SessionModel.updateDetails(session.id, { 
      kubeconfigPath: clusterResult.kubeconfigPath 
    });
    SessionModel.addNotes(session.id, `Cluster created in ${clusterResult.duration}ms`);

    // Create terminal container with the terminal-specific kubeconfig
    const terminalResult = await TerminalService.createContainer(
      clusterName, 
      clusterResult.terminalKubeconfigPath || clusterResult.kubeconfigPath
    );

    // Update session with terminal container ID
    SessionModel.updateDetails(session.id, { 
      terminalContainerId: terminalResult.containerId 
    });

    // Assign random 20 tasks for CKAD exam (like real exam)
    try {
      const examTasks = TaskModel.getRandomExamTasks(20);
      const taskIds = examTasks.map(task => task.id);
      SessionModel.assignRandomTasks(session.id, taskIds);
      logger.info('Assigned random exam tasks', { 
        sessionId: session.id, 
        taskCount: taskIds.length,
        taskIds 
      });
    } catch (error) {
      logger.error('Failed to assign tasks to session', { 
        sessionId: session.id, 
        error: error.message 
      });
      // Continue anyway - tasks can be added later
      // Don't fail session creation just because of insufficient tasks
    }

    // Get session with time info
    const sessionWithTime = SessionModel.getWithTimeInfo(session.id);

    logger.info('Session started successfully', { 
      sessionId: session.id, 
      userId, 
      clusterName 
    });

    res.json({
      success: true,
      session: {
        id: session.id,
        clusterName,
        status: 'started',
        startTime: sessionWithTime.start_time,
        ttlMinutes: sessionWithTime.ttl_minutes,
        remainingMinutes: sessionWithTime.remaining_minutes,
        extended: false,
      },
      terminal: {
        wsUrl: `/ws/terminal?sessionId=${session.id}`,
      },
    });
  } catch (error) {
    // Cleanup on failure
    logger.error('Session creation failed, cleaning up', { 
      sessionId: session.id, 
      error: error.message 
    });

    await cleanupSession(session.id, clusterName);
    
    // Update session status
    SessionModel.updateStatus(session.id, 'ended', `Failed: ${error.message}`);

    throw error;
  }
}));

/**
 * GET /api/session/status
 * Get current session status
 */
router.get('/status', authenticate, asyncHandler(async (req, res) => {
  const session = SessionModel.findActiveByUserId(req.userId);

  if (!session) {
    return res.json({
      success: true,
      hasActiveSession: false,
      session: null,
    });
  }

  const sessionWithTime = SessionModel.getWithTimeInfo(session.id);

  res.json({
    success: true,
    hasActiveSession: true,
    session: {
      id: session.id,
      clusterName: session.cluster_name,
      status: session.status,
      startTime: session.start_time,
      ttlMinutes: session.ttl_minutes,
      remainingMinutes: Math.max(0, sessionWithTime.remaining_minutes),
      extended: !!session.extended,
    },
    terminal: {
      wsUrl: `/ws/terminal?sessionId=${session.id}`,
    },
  });
}));

/**
 * POST /api/session/extend
 * Extend session TTL
 */
router.post('/extend', authenticate, asyncHandler(async (req, res) => {
  const session = SessionModel.findActiveByUserId(req.userId);

  if (!session) {
    throw new NotFoundError('No active session found');
  }

  if (session.extended) {
    throw new ConflictError('Session has already been extended');
  }

  const extendedSession = SessionModel.extend(session.id);
  const sessionWithTime = SessionModel.getWithTimeInfo(session.id);

  logger.info('Session extended', { 
    sessionId: session.id, 
    newTtl: extendedSession.ttl_minutes 
  });

  res.json({
    success: true,
    message: `Session extended by ${config.session.extensionMinutes} minutes`,
    session: {
      id: extendedSession.id,
      ttlMinutes: extendedSession.ttl_minutes,
      remainingMinutes: Math.max(0, sessionWithTime.remaining_minutes),
      extended: true,
    },
  });
}));

/**
 * POST /api/session/stop
 * End current session
 */
router.post('/stop', authenticate, asyncHandler(async (req, res) => {
  const session = SessionModel.findActiveByUserId(req.userId);

  if (!session) {
    throw new NotFoundError('No active session found');
  }

  logger.info('Stopping session', { sessionId: session.id, clusterName: session.cluster_name });

  // Cleanup resources
  await cleanupSession(session.id, session.cluster_name);

  // Update session status
  SessionModel.updateStatus(session.id, 'ended', 'Stopped by user');

  res.json({
    success: true,
    message: 'Session ended successfully',
  });
}));

/**
 * Helper function to cleanup session resources
 */
async function cleanupSession(sessionId, clusterName) {
  const errors = [];

  // Remove terminal container
  try {
    const containerName = `term-${clusterName}`;
    await TerminalService.removeContainer(containerName);
  } catch (error) {
    errors.push(`Terminal cleanup: ${error.message}`);
    logger.error('Failed to remove terminal container', { sessionId, error: error.message });
  }

  // Delete KIND cluster
  try {
    await KindService.cleanupCluster(clusterName);
  } catch (error) {
    errors.push(`Cluster cleanup: ${error.message}`);
    logger.error('Failed to cleanup cluster', { sessionId, error: error.message });
  }

  // Release ports
  try {
    PortModel.releasePorts(sessionId);
  } catch (error) {
    errors.push(`Port cleanup: ${error.message}`);
    logger.error('Failed to release ports', { sessionId, error: error.message });
  }

  if (errors.length > 0) {
    logger.warn('Session cleanup completed with errors', { sessionId, errors });
  } else {
    logger.info('Session cleanup completed successfully', { sessionId });
  }
}

export { cleanupSession };
export default router;

