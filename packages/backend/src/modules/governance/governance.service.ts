import { db } from '../../db/index.js';
import { proposals, votes, users, systemParameters } from '../../db/schema.js';
import { eq, and, or, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { eventBus } from '../events/event-bus.js';
import type { ProposalCategory } from '@openfood/shared';
import pino from 'pino';

const logger = pino({ name: 'governance-service' });

interface CreateProposalInput {
  proposedBy: string;
  proposerRole: 'worker' | 'restaurant';
  title: string;
  description: string;
  category: ProposalCategory;
  parameterChange?: {
    parameter: string;
    currentValue: unknown;
    proposedValue: unknown;
  };
}

export const governanceService = {
  async createProposal(input: CreateProposalInput) {
    const proposalId = uuid();
    const now = new Date();
    const votingPeriodHours = 72;
    const votingEndsAt = new Date(now.getTime() + votingPeriodHours * 60 * 60 * 1000);

    await db.insert(proposals).values({
      id: proposalId,
      proposedBy: input.proposedBy,
      proposerRole: input.proposerRole,
      title: input.title,
      description: input.description,
      category: input.category,
      parameterChange: input.parameterChange ?? null,
      status: 'voting',
      quorumRequired: 30,
      votingStartedAt: now,
      votingEndsAt,
      createdAt: now,
      updatedAt: now,
    });

    await eventBus.emit({
      type: 'governance.proposal_created',
      aggregateId: proposalId,
      aggregateType: 'governance',
      actor: { id: input.proposedBy, role: input.proposerRole },
      data: {
        proposalId,
        proposedBy: input.proposedBy,
        proposerRole: input.proposerRole,
        title: input.title,
        description: input.description,
        category: input.category,
        parameterChange: input.parameterChange ?? null,
        votingEndsAt: votingEndsAt.toISOString(),
        quorumRequired: 30,
      },
    });

    logger.info({ proposalId, title: input.title }, 'Proposal created');

    return { proposalId, votingEndsAt };
  },

  async castVote(proposalId: string, voterId: string, voterRole: 'worker' | 'restaurant', vote: 'for' | 'against' | 'abstain') {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'voting') throw new Error('Proposal is not in voting period');

    if (proposal.votingEndsAt && new Date() > proposal.votingEndsAt) {
      throw new Error('Voting period has ended');
    }

    const existingVote = await db
      .select()
      .from(votes)
      .where(and(eq(votes.proposalId, proposalId), eq(votes.voterId, voterId)))
      .limit(1);

    if (existingVote[0]) {
      throw new Error('Already voted on this proposal');
    }

    const voteId = uuid();

    await db.insert(votes).values({
      id: voteId,
      proposalId,
      voterId,
      voterRole,
      vote,
    });

    const updateField = vote === 'for' ? 'votesFor' : vote === 'against' ? 'votesAgainst' : 'abstentions';
    await db.execute(sql`
      UPDATE proposals
      SET ${sql.identifier(updateField === 'votesFor' ? 'votes_for' : updateField === 'votesAgainst' ? 'votes_against' : 'abstentions')} =
          ${sql.identifier(updateField === 'votesFor' ? 'votes_for' : updateField === 'votesAgainst' ? 'votes_against' : 'abstentions')} + 1,
          updated_at = NOW()
      WHERE id = ${proposalId}
    `);

    await eventBus.emit({
      type: 'governance.vote_cast',
      aggregateId: proposalId,
      aggregateType: 'governance',
      actor: { id: voterId, role: voterRole },
      data: { proposalId, voterId, voterRole, vote },
    });

    return { voteId, proposalId, vote };
  },

  async tallyProposal(proposalId: string) {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'voting') throw new Error('Proposal is not in voting period');

    const eligibleVoters = await db
      .select()
      .from(users)
      .where(or(eq(users.role, 'worker'), eq(users.role, 'restaurant')));

    const totalEligible = eligibleVoters.length;
    const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.abstentions;
    const quorumPercent = totalEligible > 0 ? (totalVotes / totalEligible) * 100 : 0;
    const quorumReached = quorumPercent >= proposal.quorumRequired;

    const majorityFor = proposal.votesFor > proposal.votesAgainst;
    const passed = quorumReached && majorityFor;

    const now = new Date();
    const newStatus = passed ? 'passed' : 'rejected';

    await db
      .update(proposals)
      .set({ status: newStatus as 'passed' | 'rejected', updatedAt: now })
      .where(eq(proposals.id, proposalId));

    if (passed) {
      await eventBus.emit({
        type: 'governance.proposal_passed',
        aggregateId: proposalId,
        aggregateType: 'governance',
        actor: { id: 'system', role: 'system' },
        data: {
          proposalId,
          votesFor: proposal.votesFor,
          votesAgainst: proposal.votesAgainst,
          abstentions: proposal.abstentions,
          quorumReached,
          passedAt: now.toISOString(),
        },
      });

      if (proposal.parameterChange) {
        await this.executeProposal(proposalId);
      }
    } else {
      const reason = !quorumReached ? 'quorum_not_reached' : 'majority_against';

      await eventBus.emit({
        type: 'governance.proposal_rejected',
        aggregateId: proposalId,
        aggregateType: 'governance',
        actor: { id: 'system', role: 'system' },
        data: {
          proposalId,
          votesFor: proposal.votesFor,
          votesAgainst: proposal.votesAgainst,
          abstentions: proposal.abstentions,
          reason,
        },
      });
    }

    return {
      proposalId,
      status: newStatus,
      votesFor: proposal.votesFor,
      votesAgainst: proposal.votesAgainst,
      abstentions: proposal.abstentions,
      quorumPercent,
      quorumReached,
    };
  },

  async executeProposal(proposalId: string) {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'passed') throw new Error('Proposal has not passed');

    const paramChange = proposal.parameterChange as {
      parameter: string;
      currentValue: unknown;
      proposedValue: unknown;
    } | null;

    if (!paramChange) {
      throw new Error('No parameter change defined');
    }

    const validParameters = [
      'base_delivery_fee', 'per_km_rate', 'pool_contribution_rate',
      'infra_fee_rate', 'daily_minimum_guarantee', 'default_quorum',
      'voting_period_hours', 'restaurant_accept_timeout', 'worker_pickup_timeout',
    ];

    if (!validParameters.includes(paramChange.parameter)) {
      throw new Error(`Invalid parameter: ${paramChange.parameter}`);
    }

    const now = new Date();

    await db.execute(sql`
      UPDATE system_parameters
      SET ${sql.identifier(paramChange.parameter)} = ${paramChange.proposedValue as number},
          updated_at = NOW(),
          updated_by_proposal = ${proposalId}
      WHERE id = 1
    `);

    await db
      .update(proposals)
      .set({ status: 'executed', executedAt: now, updatedAt: now })
      .where(eq(proposals.id, proposalId));

    await eventBus.emit({
      type: 'governance.proposal_executed',
      aggregateId: proposalId,
      aggregateType: 'governance',
      actor: { id: 'system', role: 'system' },
      data: {
        proposalId,
        parameterChanged: paramChange.parameter,
        oldValue: paramChange.currentValue,
        newValue: paramChange.proposedValue,
        executedAt: now.toISOString(),
      },
    });

    logger.info({
      proposalId,
      parameter: paramChange.parameter,
      oldValue: paramChange.currentValue,
      newValue: paramChange.proposedValue,
    }, 'Governance proposal executed');

    return { proposalId, status: 'executed', parameterChanged: paramChange.parameter };
  },

  async getProposal(proposalId: string) {
    const result = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    return result[0] ?? null;
  },

  async getActiveProposals() {
    return db
      .select()
      .from(proposals)
      .where(eq(proposals.status, 'voting'))
      .orderBy(proposals.createdAt);
  },

  async getAllProposals(limit = 50) {
    return db
      .select()
      .from(proposals)
      .orderBy(sql`created_at DESC`)
      .limit(limit);
  },

  async getVotesForProposal(proposalId: string) {
    return db
      .select()
      .from(votes)
      .where(eq(votes.proposalId, proposalId));
  },

  async getSystemParameters() {
    const result = await db
      .select()
      .from(systemParameters)
      .where(eq(systemParameters.id, 1))
      .limit(1);

    return result[0] ?? null;
  },
};
