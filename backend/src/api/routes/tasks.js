import { Router } from 'express';
import TaskModel from '../../models/task.js';
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

export default router;

