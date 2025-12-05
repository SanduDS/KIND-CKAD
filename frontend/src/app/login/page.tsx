'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Mail, ArrowRight, Loader2, Kubernetes } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      const result = await authApi.sendOTP(email);
      if (result.success) {
        setStep('otp');
        toast.success('OTP sent to your email');
      } else {
        toast.error(result.message || 'Failed to send OTP');
      }
    } catch (error) {
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) return;

    setIsLoading(true);
    try {
      const result = await authApi.verifyOTP(email, otp);
      if (result.success) {
        setAuth(result.user, result.accessToken, result.refreshToken);
        toast.success('Login successful!');
        router.push('/dashboard');
      } else {
        toast.error(result.message || 'Invalid OTP');
      }
    } catch (error) {
      toast.error('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = authApi.getGoogleAuthUrl();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-terminal-bg grid-bg relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-terminal-accent/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-terminal-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo & Title */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-terminal-surface border border-terminal-border mb-6">
            <svg viewBox="0 0 24 24" className="w-12 h-12 text-terminal-accent" fill="currentColor">
              <path d="M12 0L1.5 6v12L12 24l10.5-6V6L12 0zm0 2.25l8.25 4.69v9.38L12 21l-8.25-4.69V6.94L12 2.25zM12 6a1.5 1.5 0 00-1.5 1.5v3.75L7.5 13.5a1.5 1.5 0 001.5 2.598l3-1.732 3 1.732a1.5 1.5 0 001.5-2.598l-3-1.732V7.5A1.5 1.5 0 0012 6z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold font-display mb-2">
            <span className="text-terminal-accent glow-text">CKAD</span> Practice
          </h1>
          <p className="text-terminal-muted">
            Hands-on Kubernetes training environment
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-terminal-surface border border-terminal-border rounded-2xl p-8 shadow-2xl animate-slide-up">
          {step === 'email' ? (
            <>
              <h2 className="text-xl font-semibold mb-6 text-center">
                Sign in to your account
              </h2>

              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="block text-sm text-terminal-muted mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-terminal-muted" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-12 pr-4 py-3 bg-terminal-bg border border-terminal-border rounded-xl text-terminal-text placeholder-terminal-muted focus:border-terminal-accent focus:ring-1 focus:ring-terminal-accent transition-all"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full py-3 bg-terminal-accent text-terminal-bg font-semibold rounded-xl hover:bg-terminal-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all btn-glow flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Continue with Email
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-terminal-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-terminal-surface text-terminal-muted">
                    or continue with
                  </span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                className="w-full py-3 bg-terminal-bg border border-terminal-border rounded-xl hover:border-terminal-accent/50 transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Google</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('email')}
                className="text-terminal-muted hover:text-terminal-text mb-4 text-sm flex items-center gap-1"
              >
                ← Back
              </button>

              <h2 className="text-xl font-semibold mb-2">Enter verification code</h2>
              <p className="text-terminal-muted text-sm mb-6">
                We sent a 6-digit code to <span className="text-terminal-accent">{email}</span>
              </p>

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 bg-terminal-bg border border-terminal-border rounded-xl text-terminal-text placeholder-terminal-muted focus:border-terminal-accent focus:ring-1 focus:ring-terminal-accent transition-all"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  className="w-full py-3 bg-terminal-accent text-terminal-bg font-semibold rounded-xl hover:bg-terminal-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all btn-glow flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Verify & Sign In'
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={isLoading}
                  className="w-full py-2 text-terminal-muted hover:text-terminal-accent text-sm transition-colors"
                >
                  Didn't receive the code? Resend
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-terminal-muted text-sm mt-8">
          Practice Kubernetes in a safe, timed environment
        </p>
      </div>
    </div>
  );
}

