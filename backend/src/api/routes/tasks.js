import { Router } from 'express';
import TaskModel from '../../models/task.js';
import SessionModel from '../../models/session.js';
import TaskResultModel from '../../models/taskResult.js';
import VerificationService from '../../services/verification.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * GET /api/tasks
 * Get all tasks (summary only)
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { difficulty, category } = req.query;

  let tasks;
  if (difficulty) {
    tasks = TaskModel.findByDifficulty(difficulty);
  } else if (category) {
    tasks = TaskModel.findByCategory(category);
  } else {
    tasks = TaskModel.findAll();
  }

  res.json({
    success: true,
    count: tasks.length,
    tasks,
  });
}));

/**
 * GET /api/tasks/categories
 * Get all task categories
 */
router.get('/categories', authenticate, asyncHandler(async (req, res) => {
  const categories = TaskModel.getCategories();

  res.json({
    success: true,
    categories,
  });
}));

/**
 * GET /api/tasks/:id
 * Get task details by ID
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const task = TaskModel.findById(parseInt(id, 10));

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  res.json({
    success: true,
    task,
  });
}));

/**
 * GET /api/tasks/session/current
 * Get current task for active session (CKAD exam-style: one at a time)
 * Only shows tasks assigned to this session (20 random tasks)
 */
router.get('/session/current', authenticate, asyncHandler(async (req, res) => {
  const userId = req.userId;
  
  // Get active session
  const session = SessionModel.findActiveByUserId(userId);
  if (!session) {
    throw new NotFoundError('No active session found');
  }

  // Get assigned tasks for this session
  const { assigned, completed } = SessionModel.getAssignedTasks(session.id);
  
  if (assigned.length === 0) {
    throw new NotFoundError('No tasks assigned to this session');
  }

  // Get current task index (next uncompleted task)
  const currentIndex = session.current_task_id ? session.current_task_id - 1 : 0;
  const currentTaskId = assigned[currentIndex];
  
  const task = TaskModel.findById(currentTaskId);
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  const progress = {
    current: currentIndex + 1,
    total: assigned.length, // Always 20 for CKAD exam
    completed: completed.length,
    percentage: Math.round((completed.length / assigned.length) * 100)
  };

  res.json({
    success: true,
    task,
    progress,
  });
}));

/**
 * POST /api/tasks/session/complete
 * Mark current task as complete and move to next (within assigned 20 tasks)
 */
router.post('/session/complete', authenticate, asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { taskId } = req.body;
  
  if (!taskId) {
    throw new ValidationError('taskId is required');
  }
  
  // Get active session
  const session = SessionModel.findActiveByUserId(userId);
  if (!session) {
    throw new NotFoundError('No active session found');
  }

  const { assigned, completed } = SessionModel.getAssignedTasks(session.id);
  
  if (assigned.length === 0) {
    throw new NotFoundError('No tasks assigned to this session');
  }
  
  // Validate that this is the current task (no skipping ahead)
  const currentIndex = session.current_task_id ? session.current_task_id - 1 : 0;
  const expectedTaskId = assigned[currentIndex];
  
  if (taskId !== expectedTaskId) {
    throw new ValidationError(
      `Cannot complete task ${taskId}. Current task is ${expectedTaskId} (Question ${currentIndex + 1})`
    );
  }
  
  // Add current task to completed if not already there
  if (!completed.includes(taskId)) {
    completed.push(taskId);
  }

  // Move to next task
  const nextIndex = currentIndex + 1;
  
  // Update session with new current task index and completed list
  const taskData = JSON.stringify({ assigned, completed });
  SessionModel.updateTaskProgress(session.id, nextIndex + 1, taskData);

  const hasMore = nextIndex < assigned.length;
  const nextTask = hasMore ? TaskModel.findById(assigned[nextIndex]) : null;

  res.json({
    success: true,
    message: hasMore ? 'Task completed! Moving to next question.' : 'All tasks completed! 🎉',
    nextTask: hasMore ? nextTask : null,
    progress: {
      current: hasMore ? nextIndex + 1 : assigned.length, // Current question number
      total: assigned.length,
      completed: completed.length,
      percentage: Math.round((completed.length / assigned.length) * 100)
    }
  });
}));

/**
 * POST /api/tasks/verify
 * Verify task completion using verification checks
 */
router.post('/verify', authenticate, asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { taskId } = req.body;

  if (!taskId) {
    throw new ValidationError('taskId is required');
  }

  // Get active session
  const session = SessionModel.findActiveByUserId(userId);
  if (!session) {
    throw new NotFoundError('No active session found');
  }

  // Get task
  const task = TaskModel.findById(taskId);
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  // Get verification config
  const verificationConfig = TaskModel.getVerificationConfig(taskId);
  if (!verificationConfig || !verificationConfig.checks) {
    throw new ValidationError('This task does not have verification configured');
  }

  const containerName = `term-${session.cluster_name}`;

  // Execute each verification check
  const checkResults = [];
  let allOutput = '';

  for (const check of verificationConfig.checks) {
    if (!check.command) {
      continue;
    }

    const result = await VerificationService.executeVerification(
      containerName,
      check.command,
      30000
    );

    allOutput += `\n--- ${check.name} ---\n${result.output}\n`;

    const checkResult = VerificationService.evaluateCheck(check, result.output);
    checkResults.push(checkResult);
  }

  // Calculate overall result
  const totalChecks = checkResults.length;
  const passedChecks = checkResults.filter(c => c.passed).length;
  const totalScore = checkResults.reduce((sum, c) => sum + (c.passed ? c.points : 0), 0);
  const maxScore = task.max_score || checkResults.reduce((sum, c) => sum + c.points, 0);
  const passed = passedChecks === totalChecks && totalChecks > 0;

  // Store result
  const taskResult = TaskResultModel.create({
    sessionId: session.id,
    taskId: task.id,
    userId: userId,
    passed,
    score: totalScore,
    maxScore,
    checksPassed: passedChecks,
    checksTotal: totalChecks,
    verificationOutput: allOutput,
    verificationDetails: checkResults,
  });

  res.json({
    success: true,
    verified: true,
    passed,
    score: totalScore,
    maxScore,
    percentage: Math.round((totalScore / maxScore) * 100),
    checks: {
      total: totalChecks,
      passed: passedChecks,
      failed: totalChecks - passedChecks,
    },
    details: checkResults,
    message: passed 
      ? `✅ Task verified successfully! Score: ${totalScore}/${maxScore}` 
      : `❌ Verification failed. ${passedChecks}/${totalChecks} checks passed.`,
    resultId: taskResult.id,
  });
}));

/**
 * GET /api/tasks/session/:sessionId/results
 * Get all verification results for a session
 */
router.get('/session/:sessionId/results', authenticate, asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { sessionId } = req.params;

  // Verify session belongs to user
  const session = SessionModel.findById(sessionId);
  if (!session) {
    throw new NotFoundError('Session not found');
  }

  if (session.user_id !== userId) {
    throw new ValidationError('Access denied');
  }

  // Get all task results
  const results = TaskResultModel.findBySession(sessionId);
  const stats = TaskResultModel.getSessionStats(sessionId);

  res.json({
    success: true,
    sessionId,
    results,
    stats: {
      totalAttempts: stats.total_attempts || 0,
      tasksPassed: stats.tasks_passed || 0,
      totalScore: stats.total_score || 0,
      maxPossibleScore: stats.max_possible_score || 0,
      averagePercentage: Math.round(stats.avg_percentage || 0),
    },
  });
}));

/**
 * GET /api/tasks/session/:sessionId/score
 * Get final score summary for a session
 */
router.get('/session/:sessionId/score', authenticate, asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { sessionId } = req.params;

  // Verify session belongs to user
  const session = SessionModel.findById(sessionId);
  if (!session) {
    throw new NotFoundError('Session not found');
  }

  if (session.user_id !== userId) {
    throw new ValidationError('Access denied');
  }

  const breakdown = TaskResultModel.getSessionBreakdown(sessionId);
  const stats = TaskResultModel.getSessionStats(sessionId);

  res.json({
    success: true,
    sessionId,
    summary: {
      totalTasks: breakdown.length,
      tasksPassed: stats.tasks_passed || 0,
      tasksFailed: (stats.total_attempts || 0) - (stats.tasks_passed || 0),
      totalScore: stats.total_score || 0,
      maxPossibleScore: stats.max_possible_score || 0,
      percentage: Math.round(stats.avg_percentage || 0),
      grade: calculateGrade(stats.avg_percentage || 0),
    },
    breakdown: breakdown.map(item => ({
      taskId: item.task_id,
      title: item.title,
      difficulty: item.difficulty,
      category: item.category,
      passed: !!item.passed,
      score: item.score,
      maxScore: item.max_score,
      checksPassedRatio: `${item.checks_passed}/${item.checks_total}`,
      verifiedAt: item.verified_at,
    })),
  });
}));

// Helper function to calculate grade
function calculateGrade(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

export default router;



