'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Zap } from 'lucide-react';
import { clsx } from 'clsx';

interface TimerProps {
  remainingMinutes: number;
  onExtend?: () => void;
  canExtend?: boolean;
  isExtending?: boolean;
}

export default function Timer({ 
  remainingMinutes, 
  onExtend, 
  canExtend = false,
  isExtending = false 
}: TimerProps) {
  const [displayMinutes, setDisplayMinutes] = useState(remainingMinutes);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setDisplayMinutes(Math.floor(remainingMinutes));
    setSeconds(Math.round((remainingMinutes % 1) * 60));
  }, [remainingMinutes]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 0) {
          setDisplayMinutes((m) => Math.max(0, m - 1));
          return 59;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const totalSeconds = displayMinutes * 60 + seconds;
  const isWarning = totalSeconds <= 600; // 10 minutes
  const isDanger = totalSeconds <= 300; // 5 minutes
  const isCritical = totalSeconds <= 60; // 1 minute

  const formatTime = () => {
    const mins = String(displayMinutes).padStart(2, '0');
    const secs = String(seconds).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-2 rounded-xl border transition-all',
        {
          'bg-terminal-surface border-terminal-border': !isWarning,
          'bg-yellow-500/10 border-yellow-500/30': isWarning && !isDanger,
          'bg-red-500/10 border-red-500/30 animate-pulse': isDanger && !isCritical,
          'bg-red-500/20 border-red-500/50 animate-pulse': isCritical,
        }
      )}
    >
      {isDanger ? (
        <AlertTriangle
          className={clsx('w-5 h-5', {
            'text-yellow-500': isWarning && !isDanger,
            'text-red-500': isDanger,
          })}
        />
      ) : (
        <Clock className="w-5 h-5 text-terminal-accent" />
      )}

      <div className="flex flex-col">
        <span
          className={clsx('font-mono text-lg font-bold', {
            'text-terminal-accent': !isWarning,
            'text-yellow-500': isWarning && !isDanger,
            'text-red-500': isDanger,
          })}
        >
          {formatTime()}
        </span>
        <span className="text-xs text-terminal-muted">remaining</span>
      </div>

      {canExtend && onExtend && (
        <button
          onClick={onExtend}
          disabled={isExtending}
          className={clsx(
            'ml-2 px-3 py-1 text-sm font-medium rounded-lg transition-all flex items-center gap-1',
            {
              'bg-terminal-accent/10 text-terminal-accent hover:bg-terminal-accent/20': !isDanger,
              'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 animate-pulse': isDanger,
            }
          )}
        >
          <Zap className="w-4 h-4" />
          {isExtending ? 'Extending...' : '+30 min'}
        </button>
      )}

      {/* Warning messages */}
      {isDanger && !isCritical && (
        <span className="text-xs text-red-400 ml-2">Session ending soon!</span>
      )}
      {isCritical && (
        <span className="text-xs text-red-500 font-semibold ml-2 animate-pulse">
          Final minute!
        </span>
      )}
    </div>
  );
}



