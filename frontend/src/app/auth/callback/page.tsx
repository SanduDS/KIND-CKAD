'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const handleCallback = async () => {
      const accessToken = searchParams.get('accessToken');
      const refreshToken = searchParams.get('refreshToken');
      const error = searchParams.get('error');

      if (error) {
        toast.error('Authentication failed. Please try again.');
        router.push('/login');
        return;
      }

      if (accessToken && refreshToken) {
        try {
          // Temporarily store tokens
          localStorage.setItem(
            'ckad-auth',
            JSON.stringify({
              state: { accessToken, refreshToken, isAuthenticated: true },
            })
          );

          // Fetch user info
          const result = await authApi.getMe();
          if (result.success) {
            setAuth(result.user, accessToken, refreshToken);
            toast.success('Login successful!');
            router.push('/dashboard');
          } else {
            throw new Error('Failed to get user info');
          }
        } catch (error) {
          toast.error('Authentication failed. Please try again.');
          localStorage.removeItem('ckad-auth');
          router.push('/login');
        }
      } else {
        router.push('/login');
      }
    };

    handleCallback();
  }, [searchParams, router, setAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-terminal-bg">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-terminal-muted">Completing authentication...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-terminal-bg">
          <div className="w-12 h-12 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}

