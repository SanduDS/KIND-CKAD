'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  BookOpen, 
  Loader2,
  CheckCircle2,
  ChevronRight,
  Trophy,
  Clock,
  Target
} from 'lucide-react';
import { clsx } from 'clsx';
import { tasksApi } from '@/lib/api';
import { toast } from 'sonner';

interface Task {
  id: number;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  body: string;
}

interface Progress {
  current: number;
  total: number;
  completed: number;
  percentage: number;
}

export default function TaskPanel() {
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    loadCurrentTask();
  }, []);

  const loadCurrentTask = async () => {
    try {
      setIsLoading(true);
      const result = await tasksApi.getCurrent();
      
      if (result.success) {
        setCurrentTask(result.task);
        setProgress(result.progress);
        setIsCompleted(false);
      }
    } catch (error: any) {
      console.error('Failed to load current task:', error);
      if (error.message?.includes('No active session')) {
        // No active session - wait for user to start one
        setCurrentTask(null);
        setProgress(null);
      } else {
        toast.error('Failed to load question');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!currentTask) return;

    try {
      setIsCompleting(true);
      const result = await tasksApi.complete(currentTask.id);

      if (result.success) {
        toast.success(result.message);
        
        if (result.nextTask) {
          // Load next task
          setCurrentTask(result.nextTask);
          setProgress(result.progress);
          setIsCompleted(false);
        } else {
          // All tasks completed!
          setIsCompleted(true);
        }
      }
    } catch (error: any) {
      console.error('Failed to complete task:', error);
      
      // Handle specific error cases
      if (error.message?.includes('Cannot complete task')) {
        toast.error('Please complete tasks in order');
      } else if (error.message?.includes('No active session')) {
        toast.error('Session expired. Please start a new session.');
      } else {
        toast.error(error.message || 'Failed to mark task as complete');
      }
    } finally {
      setIsCompleting(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-400 bg-green-400/10 border border-green-400/30';
      case 'medium':
        return 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/30';
      case 'hard':
        return 'text-red-400 bg-red-400/10 border border-red-400/30';
      default:
        return 'text-terminal-muted bg-terminal-border';
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-terminal-surface border border-terminal-border rounded-xl">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-terminal-accent animate-spin" />
        </div>
      </div>
    );
  }

  if (!currentTask || !progress) {
    return (
      <div className="h-full flex flex-col bg-terminal-surface border border-terminal-border rounded-xl">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-terminal-muted">
          <BookOpen className="w-16 h-16 mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No Active Session</h3>
          <p className="text-sm">Start a practice session to get your exam questions</p>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="h-full flex flex-col bg-terminal-surface border border-terminal-border rounded-xl">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 mb-6 rounded-full bg-terminal-accent/20 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-terminal-accent" />
          </div>
          <h3 className="text-2xl font-bold mb-2">Congratulations! 🎉</h3>
          <p className="text-terminal-muted mb-6">
            You've completed all {progress.total} questions!
          </p>
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
            <div className="p-4 bg-terminal-bg rounded-xl border border-terminal-border">
              <div className="text-3xl font-bold text-terminal-accent mb-1">
                {progress.completed}
              </div>
              <div className="text-xs text-terminal-muted">Completed</div>
            </div>
            <div className="p-4 bg-terminal-bg rounded-xl border border-terminal-border">
              <div className="text-3xl font-bold text-terminal-accent mb-1">
                {progress.percentage}%
              </div>
              <div className="text-xs text-terminal-muted">Progress</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden">
      {/* Header with Progress */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-terminal-border bg-terminal-bg/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-terminal-accent" />
            <span className="font-semibold">
              Question {progress.current} of {progress.total}
            </span>
          </div>
          <span
            className={clsx(
              'text-xs px-2.5 py-1 rounded-full font-medium',
              getDifficultyColor(currentTask.difficulty)
            )}
          >
            {currentTask.difficulty.toUpperCase()}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-terminal-muted">
            <span>{progress.completed} completed</span>
            <span>{progress.percentage}%</span>
          </div>
          <div className="h-2 bg-terminal-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-terminal-accent transition-all duration-500 ease-out"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Task Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Task Title */}
          <div className="mb-4">
            <div className="flex items-center gap-2 text-xs text-terminal-muted mb-2">
              <span className="px-2 py-1 bg-terminal-bg rounded border border-terminal-border">
                {currentTask.category}
              </span>
            </div>
            <h2 className="text-xl font-bold text-terminal-accent">
              {currentTask.title}
            </h2>
          </div>

          {/* Task Body (Markdown) */}
          <div className="markdown-body prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {currentTask.body}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Footer with Complete Button */}
      <div className="flex-shrink-0 p-4 border-t border-terminal-border bg-terminal-bg/50">
        <button
          onClick={handleCompleteTask}
          disabled={isCompleting}
          className={clsx(
            'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all',
            'bg-terminal-accent text-terminal-bg hover:bg-terminal-accent/90',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isCompleting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Complete & Next Question
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-xs text-terminal-muted text-center mt-3">
          <Clock className="w-3 h-3 inline mr-1" />
          No going back - CKAD exam rules apply
        </p>
      </div>
    </div>
  );
}



