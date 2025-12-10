'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Play,
  Square,
  LogOut,
  Loader2,
  Server,
  Activity,
  AlertCircle,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore, useSessionStore } from '@/lib/store';
import { sessionApi, authApi, platformApi } from '@/lib/api';
import Timer from '@/components/Timer';
import Terminal from '@/components/Terminal';
import TaskPanel from '@/components/TaskPanel';

export default function DashboardPage() {
  const router = useRouter();
  const { user, accessToken, isAuthenticated, logout } = useAuthStore();
  const { session, isLoading, error, setSession, setLoading, setError, updateRemainingTime } =
    useSessionStore();

  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [platformStatus, setPlatformStatus] = useState<any>(null);

  // Check auth on mount
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Load session status on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadSessionStatus();
      loadPlatformStatus();
    }
  }, [isAuthenticated]);

  // Poll session status every 30 seconds
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      loadSessionStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [session]);

  const loadSessionStatus = async () => {
    try {
      setLoading(true);
      const result = await sessionApi.status();
      if (result.success) {
        if (result.hasActiveSession) {
          setSession({
            id: result.session.id,
            clusterName: result.session.clusterName,
            status: result.session.status,
            startTime: result.session.startTime,
            ttlMinutes: result.session.ttlMinutes,
            remainingMinutes: result.session.remainingMinutes,
            extended: result.session.extended,
          });
        } else {
          setSession(null);
        }
      }
    } catch (err: any) {
      if (err.message === 'Unauthorized') {
        logout();
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPlatformStatus = async () => {
    try {
      const result = await platformApi.status();
      setPlatformStatus(result);
    } catch (err) {
      console.error('Failed to load platform status:', err);
    }
  };

  const handleStartSession = async () => {
    try {
      setIsStarting(true);
      setError(null);
      
      console.log('Starting session...');
      const result = await sessionApi.start();
      console.log('Session start result:', result);

      if (result.success) {
        setSession({
          id: result.session.id,
          clusterName: result.session.clusterName,
          status: result.session.status,
          startTime: result.session.startTime,
          ttlMinutes: result.session.ttlMinutes,
          remainingMinutes: result.session.remainingMinutes,
          extended: result.session.extended,
        });
        toast.success('Practice session started!');
      } else {
        const errorMsg = result.message || result.error || 'Failed to start session';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: any) {
      console.error('Session start error:', err);
      const errorMsg = err.message || 'Failed to start session. Check console for details.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopSession = async () => {
    if (!confirm('Are you sure you want to end your session? All progress will be lost.')) {
      return;
    }

    try {
      setIsStopping(true);
      const result = await sessionApi.stop();

      if (result.success) {
        setSession(null);
        toast.success('Session ended');
      } else {
        toast.error(result.message || 'Failed to end session');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to end session');
    } finally {
      setIsStopping(false);
    }
  };

  const handleExtendSession = async () => {
    try {
      setIsExtending(true);
      const result = await sessionApi.extend();

      if (result.success) {
        updateRemainingTime(result.session.remainingMinutes);
        setSession({
          ...session!,
          ttlMinutes: result.session.ttlMinutes,
          remainingMinutes: result.session.remainingMinutes,
          extended: true,
        });
        toast.success('Session extended by 30 minutes!');
      } else {
        toast.error(result.message || 'Failed to extend session');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to extend session');
    } finally {
      setIsExtending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Ignore errors on logout
    } finally {
      logout();
      router.push('/login');
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-terminal-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-terminal-surface border-b border-terminal-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-terminal-accent" fill="currentColor">
              <path d="M12 0L1.5 6v12L12 24l10.5-6V6L12 0zm0 2.25l8.25 4.69v9.38L12 21l-8.25-4.69V6.94L12 2.25zM12 6a1.5 1.5 0 00-1.5 1.5v3.75L7.5 13.5a1.5 1.5 0 001.5 2.598l3-1.732 3 1.732a1.5 1.5 0 001.5-2.598l-3-1.732V7.5A1.5 1.5 0 0012 6z"/>
            </svg>
            <span className="text-xl font-bold font-display">
              <span className="text-terminal-accent">CKAD</span> Practice
            </span>
          </div>

          {/* Platform Status */}
          {platformStatus && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-terminal-bg rounded-lg text-sm">
              <Activity className="w-4 h-4 text-green-500" />
              <span className="text-terminal-muted">
                {platformStatus.capacity?.availableSlots || 0} slots available
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Session Timer */}
          {session && (
            <Timer
              remainingMinutes={session.remainingMinutes}
              onExtend={handleExtendSession}
              canExtend={!session.extended}
              isExtending={isExtending}
            />
          )}

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/progress')}
              className="flex items-center gap-2 px-3 py-2 bg-terminal-bg border border-terminal-border rounded-lg hover:border-terminal-accent transition-colors"
              title="View Progress"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Progress</span>
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-terminal-muted">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-terminal-border rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-terminal-muted hover:text-terminal-accent" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        {!session ? (
          // No Active Session - Show Start Button
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-terminal-surface border border-terminal-border flex items-center justify-center">
                <Server className="w-12 h-12 text-terminal-accent" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Ready to Practice?</h2>
              <p className="text-terminal-muted mb-8">
                Start a new CKAD practice session. You'll get 20 random questions to complete 
                in {platformStatus?.sessionConfig?.defaultTTLMinutes || 60} minutes, just like the real exam.
              </p>

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 mb-6 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleStartSession}
                disabled={isStarting || isLoading}
                className={clsx(
                  'inline-flex items-center gap-3 px-8 py-4 bg-terminal-accent text-terminal-bg font-semibold rounded-xl transition-all btn-glow',
                  'hover:bg-terminal-accent/90 disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating cluster...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Start Practice Session
                  </>
                )}
              </button>

              {isStarting && (
                <p className="text-sm text-terminal-muted mt-4 animate-pulse">
                  This may take up to 60 seconds...
                </p>
              )}

              {/* Info cards */}
              <div className="grid grid-cols-3 gap-4 mt-12 text-left">
                <div className="p-4 bg-terminal-surface rounded-xl border border-terminal-border">
                  <div className="text-2xl font-bold text-terminal-accent mb-1">20</div>
                  <div className="text-xs text-terminal-muted">Random questions</div>
                </div>
                <div className="p-4 bg-terminal-surface rounded-xl border border-terminal-border">
                  <div className="text-2xl font-bold text-terminal-accent mb-1">
                    {platformStatus?.sessionConfig?.defaultTTLMinutes || 60}
                  </div>
                  <div className="text-xs text-terminal-muted">Minutes to complete</div>
                </div>
                <div className="p-4 bg-terminal-surface rounded-xl border border-terminal-border">
                  <div className="text-2xl font-bold text-terminal-accent mb-1">1</div>
                  <div className="text-xs text-terminal-muted">K8s cluster</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Active Session - Show Question + Terminal Side by Side
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Left: Question Panel */}
            <div className="w-[480px] flex-shrink-0">
              <TaskPanel />
            </div>

            {/* Right: Terminal */}
            <div className="flex-1 min-w-0">
              <Terminal
                sessionId={session.id}
                wsUrl={`/ws/terminal?sessionId=${session.id}`}
                accessToken={accessToken!}
              />
            </div>
          </div>
        )}

        {/* Session Controls (when active) */}
        {session && (
          <div className="flex items-center justify-between px-4 py-3 bg-terminal-surface border border-terminal-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm">
                  Cluster: <code className="text-terminal-accent">{session.clusterName}</code>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadSessionStatus}
                className="p-2 hover:bg-terminal-border rounded-lg transition-colors"
                title="Refresh status"
              >
                <RefreshCw className="w-4 h-4 text-terminal-muted" />
              </button>
              <button
                onClick={handleStopSession}
                disabled={isStopping}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {isStopping ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                End Session
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}



