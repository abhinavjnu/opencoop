'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useState } from 'react';

const NAV_LINKS: Record<string, { href: string; label: string }[]> = {
  customer: [
    { href: '/customer/restaurants', label: 'Browse Restaurants' },
    { href: '/customer/orders', label: 'My Orders' },
  ],
  restaurant: [
    { href: '/restaurant/dashboard', label: 'Dashboard' },
    { href: '/restaurant/menu', label: 'Menu' },
  ],
  worker: [
    { href: '/worker/jobs', label: 'Job Board' },
    { href: '/worker/earnings', label: 'Earnings' },
  ],
  coop_admin: [
    { href: '/customer/restaurants', label: 'Browse' },
  ],
};

const SHARED_LINKS = [
  { href: '/governance', label: 'Governance' },
  { href: '/transparency', label: 'Transparency' },
];

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const roleLinks = user ? (NAV_LINKS[user.role] ?? []) : [];
  const allLinks = isAuthenticated ? [...roleLinks, ...SHARED_LINKS] : [];

  return (
    <header className="bg-coop-green-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-coop-amber-400">⬡</span>
            <span>OpenCoop</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {allLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-md text-sm font-medium text-coop-green-100 hover:text-white hover:bg-coop-green-800 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-coop-green-200">
                  {user?.name ?? user?.email}
                  <span className="ml-1.5 text-xs bg-coop-amber-900 text-white px-2 py-0.5 rounded-full">
                    {user?.role}
                  </span>
                </span>
                <button
                  onClick={logout}
                  className="text-sm text-coop-green-200 hover:text-white transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-coop-green-100 hover:text-white transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-sm bg-coop-amber-900 text-white px-4 py-1.5 rounded-lg hover:bg-coop-amber-800 transition-colors"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-md hover:bg-coop-green-800"
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-1">
            {allLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-3 py-2 rounded-md text-sm font-medium text-coop-green-100 hover:text-white hover:bg-coop-green-800"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-coop-green-700 mt-2 pt-2">
              {isAuthenticated ? (
                <>
                  <span className="block px-3 py-1 text-sm text-coop-green-200">
                    {user?.name ?? user?.email} ({user?.role})
                  </span>
                  <button
                    onClick={logout}
                    className="block w-full text-left px-3 py-2 text-sm text-coop-green-200 hover:text-white"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="block px-3 py-2 text-sm text-coop-green-100 hover:text-white" onClick={() => setMobileOpen(false)}>Login</Link>
                  <Link href="/register" className="block px-3 py-2 text-sm text-coop-green-100 hover:text-white" onClick={() => setMobileOpen(false)}>Register</Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
