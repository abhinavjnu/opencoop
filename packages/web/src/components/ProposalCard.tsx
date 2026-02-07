import type { Proposal } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';

interface ProposalCardProps {
  proposal: Proposal;
}

const STATUS_STYLES: Record<string, string> = {
  voting: 'bg-coop-amber-100 text-coop-amber-900',
  passed: 'bg-coop-green-100 text-coop-green-900',
  rejected: 'bg-red-100 text-red-800',
  executed: 'bg-blue-100 text-blue-800',
  expired: 'bg-gray-100 text-gray-800',
  draft: 'bg-gray-100 text-gray-600',
};

const CATEGORY_LABELS: Record<string, string> = {
  delivery_fee: 'Delivery Fee',
  pool_rules: 'Pool Rules',
  dispute_policy: 'Dispute Policy',
  membership: 'Membership',
  other: 'Other',
};

export default function ProposalCard({ proposal }: ProposalCardProps) {
  const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.abstentions;
  const forPct = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
  const againstPct = totalVotes > 0 ? (proposal.votesAgainst / totalVotes) * 100 : 0;
  const abstainPct = totalVotes > 0 ? (proposal.abstentions / totalVotes) * 100 : 0;

  const votingEnds = new Date(proposal.votingEndsAt);
  const now = new Date();
  const timeLeftMs = votingEnds.getTime() - now.getTime();
  const hoursLeft = Math.max(0, Math.floor(timeLeftMs / 3600000));
  const isVotingOpen = proposal.status === 'voting' && timeLeftMs > 0;

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`badge ${STATUS_STYLES[proposal.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {proposal.status}
          </span>
          <span className="badge bg-coop-cream text-coop-green-800">
            {CATEGORY_LABELS[proposal.category] ?? proposal.category}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          by {proposal.proposerRole}
        </span>
      </div>

      <h3 className="font-semibold text-coop-green-900 mb-1">{proposal.title}</h3>
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{proposal.description}</p>

      {proposal.parameterChange && (
        <div className="bg-coop-cream rounded-md p-2 mb-3 text-sm">
          <span className="text-gray-600">Change </span>
          <span className="font-medium text-coop-green-800">{proposal.parameterChange.parameter}</span>
          <span className="text-gray-600"> from </span>
          <span className="font-mono text-sm">{String(proposal.parameterChange.currentValue)}</span>
          <span className="text-gray-600"> → </span>
          <span className="font-mono text-sm font-medium text-coop-amber-900">{String(proposal.parameterChange.proposedValue)}</span>
        </div>
      )}

      {totalVotes > 0 && (
        <div className="mb-3">
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-200">
            <div className="bg-coop-green-600" style={{ width: `${forPct}%` }} />
            <div className="bg-error" style={{ width: `${againstPct}%` }} />
            <div className="bg-gray-400" style={{ width: `${abstainPct}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span className="text-coop-green-700">{proposal.votesFor} for</span>
            <span className="text-error">{proposal.votesAgainst} against</span>
            <span>{proposal.abstentions} abstain</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Quorum: {proposal.quorumRequired}%</span>
        {isVotingOpen && (
          <span className="text-coop-amber-800 font-medium">{hoursLeft}h remaining</span>
        )}
        {!isVotingOpen && (
          <span>{formatRelativeTime(proposal.createdAt)}</span>
        )}
      </div>
    </div>
  );
}
