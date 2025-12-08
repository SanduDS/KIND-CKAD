'use client';

import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, TrendingUp, User, Calendar } from 'lucide-react';
import { clsx } from 'clsx';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  email: string;
  totalSessions: number;
  completedSessions: number;
  totalScore: number;
  totalPossibleScore: number;
  averageScore: number;
  passRate: number;
  lastActivity: string;
}

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('/api/session/leaderboard?limit=10');
      const data = await response.json();
      if (data.success) {
        setLeaderboard(data.leaderboard);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-terminal-muted">#{rank}</span>;
    }
  };

  const getRankBgColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 2:
        return 'bg-gray-500/10 border-gray-500/30';
      case 3:
        return 'bg-amber-600/10 border-amber-600/30';
      default:
        return 'bg-terminal-bg border-terminal-border';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-terminal-border rounded w-1/3"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-terminal-border rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-terminal-border bg-terminal-bg/50">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-terminal-accent" />
          <h2 className="text-xl font-bold">Leaderboard</h2>
        </div>
        <p className="text-sm text-terminal-muted mt-1">
          Top performers by total score
        </p>
      </div>

      {/* Leaderboard List */}
      <div className="divide-y divide-terminal-border">
        {leaderboard.length === 0 ? (
          <div className="px-6 py-12 text-center text-terminal-muted">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No completed sessions yet</p>
            <p className="text-sm mt-1">Be the first to complete a practice exam!</p>
          </div>
        ) : (
          leaderboard.map((entry) => (
            <div
              key={entry.userId}
              className={clsx(
                'px-6 py-4 flex items-center gap-4 transition-all hover:bg-terminal-bg/30',
                getRankBgColor(entry.rank)
              )}
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-12 flex items-center justify-center">
                {getRankIcon(entry.rank)}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-terminal-muted flex-shrink-0" />
                  <p className="font-semibold truncate">{entry.name}</p>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-terminal-muted">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(entry.lastActivity)}
                  </span>
                  <span>{entry.completedSessions} sessions</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 text-right">
                {/* Total Score */}
                <div>
                  <div className="text-2xl font-bold text-terminal-accent">
                    {entry.totalScore}
                  </div>
                  <div className="text-xs text-terminal-muted">points</div>
                </div>

                {/* Average */}
                <div>
                  <div className="text-lg font-semibold">
                    {entry.averageScore}%
                  </div>
                  <div className="text-xs text-terminal-muted">avg score</div>
                </div>

                {/* Pass Rate */}
                <div>
                  <div className={clsx(
                    'text-lg font-semibold',
                    entry.passRate >= 70 ? 'text-green-400' : 'text-yellow-400'
                  )}>
                    {entry.passRate}%
                  </div>
                  <div className="text-xs text-terminal-muted">pass rate</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-terminal-border bg-terminal-bg/30 text-center text-xs text-terminal-muted">
        Updated in real-time • Complete sessions to appear on the leaderboard
      </div>
    </div>
  );
}
