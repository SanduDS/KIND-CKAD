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

export default router;



