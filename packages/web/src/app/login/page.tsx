'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const ROLE_REDIRECTS: Record<string, string> = {
  customer: '/customer/restaurants',
  restaurant: '/restaurant/dashboard',
  worker: '/worker/jobs',
  coop_admin: '/transparency',
};

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      const stored = localStorage.getItem('opencoop_user');
      const user = stored ? JSON.parse(stored) : null;
      const redirect = user?.role ? ROLE_REDIRECTS[user.role] ?? '/' : '/';
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-12 px-4">
      <div className="card max-w-md w-full">
        <h1 className="text-2xl font-bold text-coop-green-900 mb-6 text-center">
          Welcome Back
        </h1>

        {error && (
          <div className="bg-red-50 text-error rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          New to OpenCoop?{' '}
          <Link href="/register" className="text-coop-green-700 font-medium hover:underline">
            Create an account
          </Link>
        </p>

        <div className="mt-4 border-t pt-4">
          <p className="text-xs text-gray-400 text-center">Test accounts:</p>
          <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-gray-500">
            <span>customer@example.com</span>
            <span>restaurant@example.com</span>
            <span>worker@example.com</span>
            <span>admin@example.com</span>
          </div>
          <p className="text-xs text-gray-400 text-center mt-1">Password: password123</p>
        </div>
      </div>
    </div>
  );
}
