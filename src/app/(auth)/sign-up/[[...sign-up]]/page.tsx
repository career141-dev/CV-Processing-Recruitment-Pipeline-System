'use client';

import * as React from 'react';
import { useSignUp } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUpPage() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [error, setError] = React.useState('');
  const loading = fetchStatus === 'fetching';
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;
    setError('');
    
    const { error: signUpError } = await signUp.password({ emailAddress, password, firstName, lastName });
    if (signUpError) {
      setError((signUpError as any).errors?.[0]?.longMessage || signUpError.message || 'Failed to create account');
      return;
    }

    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) {
      setError((sendError as any).errors?.[0]?.longMessage || sendError.message || 'Failed to send verification code');
      return;
    }
    
    setPendingVerification(true);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;
    setError('');
    
    const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
    if (verifyError) {
      setError((verifyError as any).errors?.[0]?.longMessage || verifyError.message || 'Invalid verification code');
      return;
    }

    if (signUp.status === 'complete') {
      await signUp.finalize({
        navigate: ({ decorateUrl }) => router.push(decorateUrl('/onboarding')),
      });
    }
  };

  const handleGoogleSignUp = async () => {
    if (!signUp) return;
    const { error: ssoError } = await signUp.sso({
      strategy: 'oauth_google',
      redirectUrl: '/dashboard',
      redirectCallbackUrl: '/sso-callback',
    });
    if (ssoError) {
      setError((ssoError as any).errors?.[0]?.longMessage || ssoError.message || 'Google sign up failed');
    }
  };


  if (pendingVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md bg-surface-container rounded-2xl shadow-lg p-8 space-y-6">
          <div className="text-center">
            <h1 className="font-display text-display text-text-primary">Check your email</h1>
            <p className="mt-2 font-body text-body text-text-secondary">
              We sent a verification code to <strong>{emailAddress}</strong>
            </p>
          </div>
          {error && <div className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</div>}
          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-center text-xl tracking-widest"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary-container text-on-primary font-semibold disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify Email'}
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
          <h1 className="font-display text-display text-text-primary">Create your account</h1>
          <p className="mt-2 font-body text-body text-text-secondary">Join Career141 — Recruitment Intelligence Platform</p>
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
          onClick={handleGoogleSignUp}
          disabled={!signUp}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-text-primary mb-1">First name</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                placeholder="John"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-text-primary mb-1">Last name</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">Email address</label>
            <input
              id="email"
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !signUp}
            className="w-full py-2.5 rounded-lg bg-primary-container text-on-primary font-semibold hover:bg-on-primary-fixed-variant transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Sign in link */}
        <p className="text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
