'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  Trophy, 
  Target, 
  CheckCircle, 
  XCircle, 
  Clock,
  BarChart3,
  Calendar,
  Award,
  ArrowLeft
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/lib/store';
import { sessionApi } from '@/lib/api';

interface ProgressData {
  overview: {
    totalSessions: number;
    completedSessions: number;
    activeSessions: number;
    totalScore: number;
    totalPossibleScore: number;
    averageScore: number;
    totalTasksAttempted: number;
    tasksPassed: number;
    passRate: number;
    lastSession: string | null;
  };
  recentSessions: Array<{
    id: string;
    status: string;
    startTime: string;
    completedAt: string | null;
    tasksCompleted: number;
    score: number;
    maxScore: number;
    scorePercentage: number;
    tasksPassed: number;
  }>;
  byDifficulty: Array<{
    difficulty: string;
    attempted: number;
    passed: number;
    passRate: number;
    avgScore: number;
  }>;
  byCategory: Array<{
    category: string;
    attempted: number;
    passed: number;
    passRate: number;
    avgScore: number;
  }>;
}

export default function ProgressPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadProgress();
  }, [isAuthenticated, router]);

  const loadProgress = async () => {
    try {
      setIsLoading(true);
      const result = await sessionApi.getProgress();
      if (result.success) {
        setProgress(result.progress);
      }
    } catch (error) {
      console.error('Failed to load progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'hard': return 'text-red-400';
      default: return 'text-terminal-muted';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen bg-terminal-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-terminal-bg flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-terminal-muted opacity-50" />
          <p className="text-terminal-muted">No progress data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-terminal-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-terminal-surface border-b border-terminal-border backdrop-blur-sm bg-opacity-95">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-terminal-border rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-terminal-accent" />
                <div>
                  <h1 className="text-2xl font-bold">My Progress</h1>
                  <p className="text-sm text-terminal-muted">Track your CKAD practice journey</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Sessions */}
          <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              <span className="text-2xl font-bold">{progress.overview.completedSessions}</span>
            </div>
            <p className="text-sm text-terminal-muted">Completed Sessions</p>
            <p className="text-xs text-terminal-muted mt-1">
              {progress.overview.totalSessions} total
            </p>
          </div>

          {/* Average Score */}
          <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-5 h-5 text-terminal-accent" />
              <span className={clsx('text-2xl font-bold', getScoreColor(progress.overview.averageScore))}>
                {progress.overview.averageScore}%
              </span>
            </div>
            <p className="text-sm text-terminal-muted">Average Score</p>
            <p className="text-xs text-terminal-muted mt-1">
              {progress.overview.totalScore} / {progress.overview.totalPossibleScore} points
            </p>
          </div>

          {/* Pass Rate */}
          <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className={clsx('text-2xl font-bold', getScoreColor(progress.overview.passRate))}>
                {progress.overview.passRate}%
              </span>
            </div>
            <p className="text-sm text-terminal-muted">Pass Rate</p>
            <p className="text-xs text-terminal-muted mt-1">
              {progress.overview.tasksPassed} / {progress.overview.totalTasksAttempted} tasks
            </p>
          </div>

          {/* Last Session */}
          <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-purple-400" />
              <Award className="w-6 h-6 text-yellow-400" />
            </div>
            <p className="text-sm text-terminal-muted">Last Practice</p>
            <p className="text-xs text-terminal-muted mt-1">
              {formatDate(progress.overview.lastSession)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Performance by Difficulty */}
          <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-terminal-accent" />
              <h2 className="text-lg font-bold">Performance by Difficulty</h2>
            </div>
            <div className="space-y-4">
              {progress.byDifficulty.map((stat) => (
                <div key={stat.difficulty} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={clsx('font-semibold capitalize', getDifficultyColor(stat.difficulty))}>
                      {stat.difficulty}
                    </span>
                    <span className="text-sm text-terminal-muted">
                      {stat.passed} / {stat.attempted} passed
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-terminal-bg rounded-full overflow-hidden">
                      <div 
                        className={clsx(
                          'h-full transition-all',
                          stat.passRate >= 70 ? 'bg-green-500' :
                          stat.passRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        )}
                        style={{ width: `${stat.passRate}%` }}
                      />
                    </div>
                    <span className={clsx('text-sm font-semibold w-12 text-right', getScoreColor(stat.passRate))}>
                      {stat.passRate}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-terminal-muted">
                    <span>Pass Rate</span>
                    <span>Avg Score: {stat.avgScore}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance by Category */}
          <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-terminal-accent" />
              <h2 className="text-lg font-bold">Performance by Category</h2>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {progress.byCategory.map((stat) => (
                <div key={stat.category} className="bg-terminal-bg rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{stat.category}</span>
                    <span className={clsx('text-sm font-bold', getScoreColor(stat.passRate))}>
                      {stat.passRate}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-terminal-border rounded-full overflow-hidden">
                      <div 
                        className={clsx(
                          'h-full',
                          stat.passRate >= 70 ? 'bg-green-500' :
                          stat.passRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        )}
                        style={{ width: `${stat.passRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-terminal-muted mt-1">
                    <span>{stat.passed}/{stat.attempted} passed</span>
                    <span>Avg: {stat.avgScore}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-terminal-accent" />
            <h2 className="text-lg font-bold">Recent Sessions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-terminal-border text-sm text-terminal-muted">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-center py-3 px-4">Tasks</th>
                  <th className="text-center py-3 px-4">Passed</th>
                  <th className="text-right py-3 px-4">Score</th>
                  <th className="text-right py-3 px-4">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border">
                {progress.recentSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-terminal-muted">
                      No sessions yet. Start practicing!
                    </td>
                  </tr>
                ) : (
                  progress.recentSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-terminal-bg/50 transition-colors">
                      <td className="py-3 px-4 text-sm">
                        {formatDate(session.completedAt || session.startTime)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={clsx(
                          'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                          session.status === 'completed' 
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        )}>
                          {session.status === 'completed' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {session.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-sm">
                        {session.tasksCompleted}
                      </td>
                      <td className="py-3 px-4 text-center text-sm">
                        {session.tasksPassed}
                      </td>
                      <td className="py-3 px-4 text-right text-sm">
                        {session.score} / {session.maxScore}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={clsx('text-sm font-bold', getScoreColor(session.scorePercentage))}>
                          {session.scorePercentage}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
