'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import ProposalCard from '@/components/ProposalCard';
import type { Proposal } from '@/lib/types';

export default function GovernancePage() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'active'>('active');

  useEffect(() => {
    const fetcher = filter === 'active' ? api.governance.activeProposals : api.governance.proposals;
    fetcher()
      .then(setProposals)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filter]);

  const canPropose = user?.role === 'worker' || user?.role === 'restaurant';

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-40 bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-coop-green-900">Governance</h1>
          <p className="text-sm text-gray-600 mt-1">
            One member, one vote. Shape the cooperative together.
          </p>
        </div>
        {canPropose && (
          <Link href="/governance/new" className="btn-primary">
            New Proposal
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-error rounded-lg p-3 mb-6 text-sm">{error}</div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            filter === 'active' ? 'bg-coop-green-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            filter === 'all' ? 'bg-coop-green-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
      </div>

      {proposals.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No {filter === 'active' ? 'active' : ''} proposals</p>
          {canPropose && <p className="text-sm">Be the first to propose a change.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((p) => (
            <Link key={p.id} href={`/governance/${p.id}`}>
              <div className="hover:shadow-md transition-shadow rounded-xl">
                <ProposalCard proposal={p} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
