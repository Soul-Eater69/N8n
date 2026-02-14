'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Ticket,
  User,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      firstName?: string;
      lastName?: string;
      role: string;
    };
    accessToken: string;
    refreshToken: string;
  };
}

type AuthMode = 'login' | 'register';

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  function resetForm() {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setError(null);
  }

  function toggleMode() {
    setMode(mode === 'login' ? 'register' : 'login');
    resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let res: AuthResponse;

      if (mode === 'login') {
        res = await api.post<AuthResponse>('/auth/login', {
          email,
          password,
        });
      } else {
        res = await api.post<AuthResponse>('/auth/register', {
          email,
          password,
          firstName,
          lastName,
        });
      }

      const { user, accessToken, refreshToken } = res.data;

      // Store tokens
      api.setTokens({ accessToken, refreshToken });

      // Update auth store
      setAuth(
        {
          id: user.id,
          email: user.email,
          name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          role: user.role,
        },
        { accessToken, refreshToken },
      );

      // Redirect to events
      router.push('/events');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : mode === 'login'
            ? 'Invalid email or password.'
            : 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-light flex">
      {/* Left panel - decorative */}
      <div className="hidden lg:flex lg:w-1/2 hero-gradient relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 hero-mesh opacity-30" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

        <div className="relative text-center px-12 max-w-lg">
          <div className="flex items-center justify-center gap-3 text-white font-bold text-3xl mb-6">
            <Ticket className="w-10 h-10" />
            StageRush
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Your front-row seat to the best events
          </h2>
          <p className="text-white/60 leading-relaxed">
            Join our fair queue system and get tickets without competing with bots. Real fans, real tickets, real experiences.
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-brand-700 font-bold text-2xl"
            >
              <Ticket className="w-8 h-8" />
              StageRush
            </Link>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-extrabold text-gray-900">
              {mode === 'login' ? 'Welcome back' : 'Create an account'}
            </h1>
            <p className="text-gray-500 mt-2 text-sm">
              {mode === 'login'
                ? 'Sign in to access your tickets and queue positions'
                : 'Sign up to start buying tickets to amazing events'}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => mode !== 'login' && toggleMode()}
              className={cn(
                'flex-1 text-sm font-semibold py-2.5 rounded-md transition-all',
                mode === 'login'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => mode !== 'register' && toggleMode()}
              className={cn(
                'flex-1 text-sm font-semibold py-2.5 rounded-md transition-all',
                mode === 'register'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              Register
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                    <input
                      id="firstName"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="input-field pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                    <input
                      id="lastName"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="input-field pl-10"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field pl-10"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === 'register' ? 'Min. 8 characters' : 'Your password'
                  }
                  className="input-field pl-10 pr-10"
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4.5 h-4.5" />
                  ) : (
                    <Eye className="w-4.5 h-4.5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-base py-3.5 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Bottom link */}
          <p className="text-center text-sm text-gray-500 mt-6">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={toggleMode}
                  className="text-brand-600 font-semibold hover:text-brand-700 transition-colors"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={toggleMode}
                  className="text-brand-600 font-semibold hover:text-brand-700 transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </p>

          {/* Back to home */}
          <div className="text-center mt-4">
            <Link
              href="/"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Back to StageRush home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
