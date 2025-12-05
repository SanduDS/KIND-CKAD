'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  BookOpen, 
  ChevronRight, 
  ChevronDown,
  Loader2,
  Tag,
  CheckCircle2,
  Circle,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { tasksApi } from '@/lib/api';
import { useTasksStore } from '@/lib/store';

interface Task {
  id: number;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  body?: string;
}

export default function TaskPanel() {
  const { tasks, selectedTask, categories, setTasks, setSelectedTask, setCategories } = useTasksStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const [tasksResult, categoriesResult] = await Promise.all([
        tasksApi.list(),
        tasksApi.categories(),
      ]);

      if (tasksResult.success) {
        setTasks(tasksResult.tasks);
      }
      if (categoriesResult.success) {
        setCategories(categoriesResult.categories);
        // Expand first category by default
        if (categoriesResult.categories.length > 0) {
          setExpandedCategories(new Set([categoriesResult.categories[0]]));
        }
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTaskDetails = async (taskId: number) => {
    try {
      setIsLoadingTask(true);
      const result = await tasksApi.get(taskId);
      if (result.success) {
        setSelectedTask(result.task);
      }
    } catch (error) {
      console.error('Failed to load task:', error);
    } finally {
      setIsLoadingTask(false);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleTaskCompletion = (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-400 bg-green-500/10';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/10';
      case 'hard':
        return 'text-red-400 bg-red-500/10';
      default:
        return 'text-terminal-muted bg-terminal-surface';
    }
  };

  const groupedTasks = tasks.reduce((acc, task) => {
    const category = task.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-terminal-surface">
        <Loader2 className="w-6 h-6 text-terminal-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden">
      {/* Task List Sidebar */}
      <div
        className={clsx(
          'border-r border-terminal-border transition-all overflow-hidden',
          isPanelOpen ? 'w-72' : 'w-0'
        )}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-terminal-accent" />
              <span className="font-medium">Practice Tasks</span>
            </div>
            <span className="text-xs text-terminal-muted">
              {completedTasks.size}/{tasks.length}
            </span>
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto py-2">
            {Object.entries(groupedTasks).map(([category, categoryTasks]) => (
              <div key={category} className="mb-1">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-terminal-border/50 transition-colors text-left"
                >
                  {expandedCategories.has(category) ? (
                    <ChevronDown className="w-4 h-4 text-terminal-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-terminal-muted" />
                  )}
                  <Tag className="w-3 h-3 text-terminal-accent" />
                  <span className="text-sm font-medium">{category}</span>
                  <span className="text-xs text-terminal-muted ml-auto">
                    {categoryTasks.length}
                  </span>
                </button>

                {/* Tasks in Category */}
                {expandedCategories.has(category) && (
                  <div className="ml-4">
                    {categoryTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => loadTaskDetails(task.id)}
                        className={clsx(
                          'w-full flex items-center gap-2 px-4 py-2 text-left transition-colors',
                          selectedTask?.id === task.id
                            ? 'bg-terminal-accent/10 border-l-2 border-terminal-accent'
                            : 'hover:bg-terminal-border/50'
                        )}
                      >
                        <button
                          onClick={(e) => toggleTaskCompletion(task.id, e)}
                          className="flex-shrink-0"
                        >
                          {completedTasks.has(task.id) ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-terminal-muted hover:text-terminal-accent" />
                          )}
                        </button>
                        <span
                          className={clsx('text-sm truncate flex-1', {
                            'line-through text-terminal-muted': completedTasks.has(task.id),
                          })}
                        >
                          {task.title}
                        </span>
                        <span
                          className={clsx(
                            'text-xs px-1.5 py-0.5 rounded',
                            getDifficultyColor(task.difficulty)
                          )}
                        >
                          {task.difficulty}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task Detail Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="p-1 hover:bg-terminal-border rounded transition-colors"
          >
            {isPanelOpen ? (
              <ChevronRight className="w-4 h-4 text-terminal-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-terminal-muted" />
            )}
          </button>
          
          {selectedTask && (
            <div className="flex items-center gap-3 flex-1 ml-2">
              <span className="font-medium truncate">{selectedTask.title}</span>
              <span
                className={clsx(
                  'text-xs px-2 py-0.5 rounded',
                  getDifficultyColor(selectedTask.difficulty)
                )}
              >
                {selectedTask.difficulty}
              </span>
            </div>
          )}

          {selectedTask && (
            <button
              onClick={() => setSelectedTask(null)}
              className="p-1 hover:bg-terminal-border rounded transition-colors"
            >
              <X className="w-4 h-4 text-terminal-muted" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoadingTask ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-terminal-accent animate-spin" />
            </div>
          ) : selectedTask?.body ? (
            <div className="markdown-body prose prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selectedTask.body}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-terminal-muted">
              <BookOpen className="w-12 h-12 mb-4 opacity-50" />
              <p>Select a task to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



