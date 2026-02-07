'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/utils';
import type { Proposal, Vote } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  voting: 'bg-coop-amber-100 text-coop-amber-900',
  passed: 'bg-coop-green-100 text-coop-green-900',
  rejected: 'bg-red-100 text-red-800',
  executed: 'bg-blue-100 text-blue-800',
  expired: 'bg-gray-100 text-gray-800',
  draft: 'bg-gray-100 text-gray-600',
};

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [proposal, setProposal] = useState<(Proposal & { votes: Vote[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voting, setVoting] = useState(false);
  const [myVote, setMyVote] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.governance
      .getProposal(id)
      .then((p) => {
        setProposal(p);
        const existing = p.votes.find((v: Vote) => v.voterId === user?.userId);
        if (existing) setMyVote(existing.vote);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, user?.userId]);

  async function handleVote(vote: 'for' | 'against' | 'abstain') {
    if (!id) return;
    setVoting(true);
    setError('');
    try {
      await api.governance.vote(id, vote);
      setMyVote(vote);
      const updated = await api.governance.getProposal(id);
      setProposal(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to vote');
    } finally {
      setVoting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="card h-48 bg-gray-100" />
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-red-50 text-error rounded-lg p-4">{error || 'Proposal not found'}</div>
      </div>
    );
  }

  const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.abstentions;
  const forPct = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
  const againstPct = totalVotes > 0 ? (proposal.votesAgainst / totalVotes) * 100 : 0;
  const abstainPct = totalVotes > 0 ? (proposal.abstentions / totalVotes) * 100 : 0;

  const canVote =
    proposal.status === 'voting' &&
    !myVote &&
    (user?.role === 'worker' || user?.role === 'restaurant');

  const votingEnds = new Date(proposal.votingEndsAt);
  const isVotingOpen = proposal.status === 'voting' && votingEnds > new Date();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-4">
        <span className={`badge ${STATUS_STYLES[proposal.status] ?? 'bg-gray-100'}`}>
          {proposal.status}
        </span>
        <span className="badge bg-coop-cream text-coop-green-800">{proposal.category.replace(/_/g, ' ')}</span>
      </div>

      <h1 className="text-3xl font-bold text-coop-green-900 mb-2">{proposal.title}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Proposed by {proposal.proposerRole} · {formatDateTime(proposal.createdAt)}
      </p>

      <div className="card mb-8">
        <p className="text-gray-700 whitespace-pre-wrap">{proposal.description}</p>
      </div>

      {proposal.parameterChange && (
        <div className="card mb-8 bg-coop-cream">
          <h2 className="font-semibold text-coop-green-900 mb-3">Parameter Change</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 uppercase">Parameter</p>
              <p className="font-mono font-medium">{proposal.parameterChange.parameter}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Current</p>
              <p className="font-mono">{String(proposal.parameterChange.currentValue)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Proposed</p>
              <p className="font-mono font-medium text-coop-amber-900">{String(proposal.parameterChange.proposedValue)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-8">
        <h2 className="font-semibold text-coop-green-900 mb-4">Votes ({totalVotes} total)</h2>

        {totalVotes > 0 && (
          <div className="mb-4">
            <div className="flex h-4 rounded-full overflow-hidden bg-gray-200">
              <div className="bg-coop-green-600" style={{ width: `${forPct}%` }} />
              <div className="bg-error" style={{ width: `${againstPct}%` }} />
              <div className="bg-gray-400" style={{ width: `${abstainPct}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-coop-green-700 font-medium">{proposal.votesFor} for ({forPct.toFixed(0)}%)</span>
              <span className="text-error font-medium">{proposal.votesAgainst} against ({againstPct.toFixed(0)}%)</span>
              <span className="text-gray-500">{proposal.abstentions} abstain ({abstainPct.toFixed(0)}%)</span>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-500 mb-4">Quorum required: {proposal.quorumRequired}%</p>

        {isVotingOpen && (
          <p className="text-sm text-coop-amber-800 mb-4">
            Voting ends: {formatDateTime(proposal.votingEndsAt)}
          </p>
        )}

        {myVote && (
          <div className="bg-coop-green-50 rounded-lg p-3 text-sm text-coop-green-800">
            You voted: <span className="font-semibold">{myVote}</span>
          </div>
        )}

        {canVote && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => handleVote('for')}
              disabled={voting}
              className="flex-1 py-2.5 rounded-lg bg-coop-green-600 text-white font-medium hover:bg-coop-green-700 disabled:opacity-50"
            >
              Vote For
            </button>
            <button
              onClick={() => handleVote('against')}
              disabled={voting}
              className="flex-1 py-2.5 rounded-lg bg-error text-white font-medium hover:bg-red-700 disabled:opacity-50"
            >
              Vote Against
            </button>
            <button
              onClick={() => handleVote('abstain')}
              disabled={voting}
              className="flex-1 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 disabled:opacity-50"
            >
              Abstain
            </button>
          </div>
        )}
      </div>

      {proposal.votes.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-coop-green-900 mb-4">Vote Log</h2>
          <div className="space-y-2">
            {proposal.votes.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-sm py-1 border-b last:border-b-0">
                <span className="text-gray-600">{v.voterRole}</span>
                <span className={`font-medium ${
                  v.vote === 'for' ? 'text-coop-green-700' :
                  v.vote === 'against' ? 'text-error' : 'text-gray-500'
                }`}>
                  {v.vote}
                </span>
                <span className="text-xs text-gray-400">{formatDateTime(v.castAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
