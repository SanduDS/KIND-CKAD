'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    // Wait for client-side hydration
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Redirect after hydration
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [mounted, isAuthenticated, router]);

  // Show loading during hydration
  return (
    <div className="min-h-screen flex items-center justify-center bg-terminal-bg">
      <div className="animate-pulse-glow">
        <div className="w-8 h-8 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}



