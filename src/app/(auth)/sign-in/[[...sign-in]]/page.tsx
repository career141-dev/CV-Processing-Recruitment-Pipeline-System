'use client';

import * as React from 'react';
import { useSignIn } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignInPage() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [emailError, setEmailError] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [rememberMe, setRememberMe] = React.useState(false);

  const handleEmailBlur = () => {
    if (!emailAddress) {
      setEmailError('Email is required');
    } else if (!/\S+@\S+\.\S+/.test(emailAddress)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handlePasswordBlur = () => {
    if (!password) {
      setPasswordError('Password is required');
    } else {
      setPasswordError('');
    }
  };
  const router = useRouter();
  const loading = fetchStatus === 'fetching';

  const [needsMfa, setNeedsMfa] = React.useState(false);
  const [code, setCode] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setError('');
    
    const { error: signInError } = await signIn.password({
      identifier: emailAddress,
      password,
    });
    
    if (signInError) {
      setError((signInError as any).errors?.[0]?.longMessage || signInError.message || 'Invalid email or password');
      return;
    }

    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => router.push(decorateUrl('/dashboard')),
      });
    } else if (signIn.status === 'needs_second_factor') {
      setNeedsMfa(true);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setError('');
    
    const { error: mfaError } = await signIn.mfa.verifyTOTP({ code });
    if (mfaError) {
      setError((mfaError as any).errors?.[0]?.longMessage || mfaError.message || 'Invalid code');
      return;
    }

    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => router.push(decorateUrl('/dashboard')),
      });
    }
  };

  const handleGoogleSignIn = async () => {
    if (!signIn) return;
    const { error: ssoError } = await signIn.sso({
      strategy: 'oauth_google',
      redirectUrl: '/dashboard',
      redirectCallbackUrl: '/sso-callback',
    });
    if (ssoError) {
      setError((ssoError as any).errors?.[0]?.longMessage || ssoError.message || 'Google sign in failed');
    }
  };


  if (needsMfa) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md bg-surface-container rounded-2xl shadow-lg p-8 space-y-6">
          <div className="text-center">
            <h1 className="font-display text-display text-text-primary">Two-Factor Auth</h1>
            <p className="mt-2 font-body text-body text-text-secondary">Enter the code from your authenticator app.</p>
          </div>
          {error && <div className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</div>}
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-center text-xl tracking-widest"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-on-primary font-semibold disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md bg-surface-container rounded-2xl shadow-lg p-8 space-y-6">

        {/* Header */}
        <div className="text-center">
          <h1 className="font-display text-display text-text-primary">Sign in to Career141</h1>
          <p className="mt-2 font-body text-body text-text-secondary">Recruitment Intelligence Platform</p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">
            {error}
          </div>
        )}

        {/* Google Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={!signIn}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-border rounded-lg bg-surface hover:bg-surface-container-low transition-colors font-semibold text-text-primary disabled:opacity-50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-surface-container font-body text-body text-text-secondary">or</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">Email address</label>
            <input
              id="email"
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              onBlur={handleEmailBlur}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={`w-full px-4 py-2.5 rounded-lg border bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${emailError ? 'border-error' : 'border-border'}`}
            />
            {emailError && <p className="mt-1 text-sm text-error">{emailError}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-text-primary">Password</label>
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={handlePasswordBlur}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 rounded-lg border bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${passwordError ? 'border-error' : 'border-border'}`}
            />
            {passwordError && <p className="mt-1 text-sm text-error">{passwordError}</p>}
          </div>
          
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary bg-surface"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-text-secondary">
              Remember for 30 days
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !signIn}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary-container text-on-primary font-semibold hover:bg-on-primary-fixed-variant transition-colors disabled:opacity-50"
          >
            {loading && (
              <svg className="animate-spin h-5 w-5 text-on-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Sign up link */}
        <p className="text-center text-sm text-text-secondary">
          New to Career141?{' '}
          <Link href="/sign-up" className="text-primary font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
