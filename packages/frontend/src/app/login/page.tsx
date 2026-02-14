'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    tenantName: '',
    tenantSlug: '',
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const res = await api.post<any>('/auth/login', {
          email: form.email,
          password: form.password,
          tenantSlug: form.tenantSlug,
        });

        if (res.success && res.data) {
          api.setToken(res.data.tokens.accessToken);
          localStorage.setItem('ff_refresh_token', res.data.tokens.refreshToken);
          setUser(res.data.user, res.data.tenant);
          router.push('/dashboard');
        }
      } else {
        const res = await api.post<any>('/auth/register', {
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          tenantName: form.tenantName,
          tenantSlug: form.tenantSlug,
        });

        if (res.success && res.data) {
          api.setToken(res.data.tokens.accessToken);
          localStorage.setItem('ff_refresh_token', res.data.tokens.refreshToken);
          setUser(res.data.user, res.data.tenant);
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-secondary)] py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-600">FlowForge</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Enterprise Workflow Automation Platform
          </p>
        </div>

        <div className="card">
          <div className="flex mb-6 border-b border-[var(--color-border)]">
            <button
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                isLogin
                  ? 'text-brand-600 border-b-2 border-brand-600'
                  : 'text-[var(--color-text-muted)]'
              }`}
              onClick={() => setIsLogin(true)}
            >
              Sign In
            </button>
            <button
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                !isLogin
                  ? 'text-brand-600 border-b-2 border-brand-600'
                  : 'text-[var(--color-text-muted)]'
              }`}
              onClick={() => setIsLogin(false)}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">First Name</label>
                    <input
                      type="text"
                      className="input-field"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      required={!isLogin}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Last Name</label>
                    <input
                      type="text"
                      className="input-field"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      required={!isLogin}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Organization Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={form.tenantName}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tenantName: e.target.value,
                        tenantSlug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                      })
                    }
                    required={!isLogin}
                    placeholder="Acme Corp"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className="input-field"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                className="input-field"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                placeholder="Min. 8 characters"
              />
            </div>

            {isLogin && (
              <div>
                <label className="block text-sm font-medium mb-1">Organization Slug</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.tenantSlug}
                  onChange={(e) => setForm({ ...form, tenantSlug: e.target.value })}
                  required
                  placeholder="acme-corp"
                />
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
