import { Router } from 'express';
import TaskModel from '../../models/task.js';
import SessionModel from '../../models/session.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';

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
 */
router.get('/session/current', authenticate, asyncHandler(async (req, res) => {
  const userId = req.userId;
  
  // Get active session
  const session = SessionModel.findActiveByUserId(userId);
  if (!session) {
    throw new NotFoundError('No active session found');
  }

  // Get user's task progress from session
  const currentTaskId = session.current_task_id || 1;
  const completedTasks = session.completed_tasks ? JSON.parse(session.completed_tasks) : [];
  
  const task = TaskModel.findById(currentTaskId);
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  const allTasks = TaskModel.findAll();
  const progress = {
    current: currentTaskId,
    total: allTasks.length,
    completed: completedTasks.length,
    percentage: Math.round((completedTasks.length / allTasks.length) * 100)
  };

  res.json({
    success: true,
    task,
    progress,
  });
}));

/**
 * POST /api/tasks/session/complete
 * Mark current task as complete and move to next
 */
router.post('/session/complete', authenticate, asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { taskId } = req.body;
  
  // Get active session
  const session = SessionModel.findActiveByUserId(userId);
  if (!session) {
    throw new NotFoundError('No active session found');
  }

  const completedTasks = session.completed_tasks ? JSON.parse(session.completed_tasks) : [];
  
  // Add current task to completed if not already there
  if (!completedTasks.includes(taskId)) {
    completedTasks.push(taskId);
  }

  // Get all tasks to find next one
  const allTasks = TaskModel.findAll();
  const nextTaskId = taskId + 1;
  
  // Update session with progress
  SessionModel.updateTaskProgress(session.id, nextTaskId, JSON.stringify(completedTasks));

  const hasMore = nextTaskId <= allTasks.length;
  const nextTask = hasMore ? TaskModel.findById(nextTaskId) : null;

  res.json({
    success: true,
    message: hasMore ? 'Task completed! Moving to next question.' : 'All tasks completed!',
    nextTask: hasMore ? nextTask : null,
    progress: {
      current: nextTaskId,
      total: allTasks.length,
      completed: completedTasks.length,
      percentage: Math.round((completedTasks.length / allTasks.length) * 100)
    }
  });
}));

export default router;



