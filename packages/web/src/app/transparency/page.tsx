'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatINR, formatRelativeTime, formatDateTime } from '@/lib/utils';
import type { PoolState, PoolLedgerEntry, SystemParameters, EventLogEntry } from '@/lib/types';

type Tab = 'pool' | 'parameters' | 'events';

const PARAM_LABELS: Record<string, { label: string; format: (v: unknown) => string }> = {
  baseDeliveryFee: { label: 'Base Delivery Fee', format: (v) => formatINR(v as number) },
  perKmRate: { label: 'Per-km Rate', format: (v) => formatINR(v as number) },
  poolContributionRate: { label: 'Pool Contribution Rate', format: (v) => `${v}%` },
  infraFeeRate: { label: 'Coop Infrastructure Fee', format: (v) => `${v}%` },
  dailyMinimumGuarantee: { label: 'Daily Minimum Guarantee', format: (v) => formatINR(v as number) },
  defaultQuorum: { label: 'Default Voting Quorum', format: (v) => `${v}%` },
  votingPeriodHours: { label: 'Voting Period', format: (v) => `${v} hours` },
  restaurantAcceptTimeout: { label: 'Restaurant Accept Timeout', format: (v) => `${v} minutes` },
  workerPickupTimeout: { label: 'Worker Pickup Timeout', format: (v) => `${v} minutes` },
};

const LEDGER_TYPE_LABELS: Record<string, string> = {
  contribution: 'Delivery Contribution',
  topup: 'Worker Top-up',
  infra_fee: 'Infra Fee Debit',
  adjustment: 'Manual Adjustment',
};

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

export default function TransparencyPage() {
  const [tab, setTab] = useState<Tab>('pool');
  const [pool, setPool] = useState<PoolState | null>(null);
  const [ledger, setLedger] = useState<PoolLedgerEntry[]>([]);
  const [params, setParams] = useState<SystemParameters | null>(null);
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.escrow.poolState(),
      api.escrow.poolLedger(50),
      api.governance.parameters(),
      api.events.recent(30),
    ])
      .then(([p, l, par, ev]) => {
        setPool(p);
        setLedger(l);
        setParams(par);
        setEvents(ev);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function handleVerify() {
    if (events.length === 0) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const first = events[0];
      const result = await api.events.verify(first.aggregateType, first.aggregateId);
      setVerifyResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="card h-40 bg-gray-100" />
          <div className="card h-60 bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-coop-green-900">Transparency Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Every rupee auditable. Every decision traceable. No hidden logic.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-error rounded-lg p-3 mb-6 text-sm">{error}</div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-8">
        {([
          { id: 'pool' as Tab, label: 'Worker Guarantee Pool' },
          { id: 'parameters' as Tab, label: 'System Parameters' },
          { id: 'events' as Tab, label: 'Event Log' },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-coop-green-700 text-coop-green-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pool Tab */}
      {tab === 'pool' && (
        <div className="space-y-6">
          {pool && (
            <div className="card">
              <h2 className="text-xl font-semibold text-coop-green-900 mb-6">Pool State</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Balance</p>
                  <p className="text-2xl font-bold text-coop-green-900">{formatINR(pool.balance)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Daily Minimum</p>
                  <p className="text-2xl font-bold text-coop-green-900">{params ? formatINR(params.dailyMinimumGuarantee) : '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contribution Rate</p>
                  <p className="text-2xl font-bold text-coop-amber-900">{params ? `${params.poolContributionRate}%` : '—'}</p>
                  <p className="text-xs text-gray-400 mt-1">of each delivery fee</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Infra Fee Rate</p>
                  <p className="text-2xl font-bold text-coop-amber-900">{params ? `${params.infraFeeRate}%` : '—'}</p>
                  <p className="text-xs text-gray-400 mt-1">of each delivery fee</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">Last updated: {formatDateTime(pool.lastUpdated)}</p>
            </div>
          )}

          <div className="card">
            <h2 className="text-xl font-semibold text-coop-green-900 mb-4">Pool Ledger</h2>
            <p className="text-sm text-gray-500 mb-4">
              Every transaction in and out of the worker guarantee pool.
            </p>

            {ledger.length === 0 ? (
              <p className="text-gray-400 text-sm">No pool transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Amount</th>
                      <th className="pb-2 pr-4">Description</th>
                      <th className="pb-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => {
                      const isCredit = entry.amount > 0;
                      return (
                        <tr key={entry.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-4">
                            <span className={`badge ${
                              isCredit
                                ? 'bg-coop-green-100 text-coop-green-800'
                                : 'bg-coop-amber-100 text-coop-amber-900'
                            }`}>
                              {LEDGER_TYPE_LABELS[entry.type] ?? entry.type}
                            </span>
                          </td>
                          <td className={`py-2 pr-4 font-medium ${
                            isCredit ? 'text-coop-green-700' : 'text-red-600'
                          }`}>
                            {isCredit ? '+' : ''}{formatINR(entry.amount)}
                          </td>
                          <td className="py-2 pr-4 text-gray-600 max-w-[200px] truncate">{entry.description}</td>
                          <td className="py-2 text-gray-500">{formatRelativeTime(entry.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Parameters Tab */}
      {tab === 'parameters' && params && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold text-coop-green-900 mb-2">Governed Parameters</h2>
            <p className="text-sm text-gray-500 mb-6">
              These values are set by cooperative vote. Any member can propose changes via the{' '}
              <a href="/governance/new" className="text-coop-green-700 underline">governance page</a>.
            </p>

            <div className="divide-y divide-gray-100">
              {Object.entries(PARAM_LABELS).map(([key, { label, format }]) => {
                const value = (params as unknown as Record<string, unknown>)[key];
                if (value === undefined) return null;
                return (
                  <div key={key} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-gray-900">{label}</p>
                      <p className="text-xs text-gray-400 font-mono">{key}</p>
                    </div>
                    <p className="text-lg font-semibold text-coop-green-900">{format(value)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-coop-green-50 rounded-xl p-6 border border-coop-green-200">
            <h3 className="font-semibold text-coop-green-900 mb-2">How parameters are changed</h3>
            <ol className="list-decimal list-inside text-sm text-coop-green-800 space-y-1.5">
              <li>Any worker or restaurant member creates a proposal</li>
              <li>All members vote during the voting period ({params.votingPeriodHours} hours)</li>
              <li>If quorum ({params.defaultQuorum}%) is met and majority votes &ldquo;for&rdquo;, the proposal passes</li>
              <li>Passed proposals are executed automatically — the parameter updates on-chain</li>
              <li>Every vote and execution is recorded in the immutable event log</li>
            </ol>
          </div>
        </div>
      )}

      {/* Events Tab */}
      {tab === 'events' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-coop-green-900">Immutable Event Log</h2>
                <p className="text-sm text-gray-500 mt-1">
                  SHA-256 hash chain. Every event links to the previous one. Tamper-evident by design.
                </p>
              </div>
              <button
                onClick={handleVerify}
                disabled={verifying || events.length === 0}
                className="btn-outline text-sm px-4 py-2"
              >
                {verifying ? 'Verifying...' : 'Verify Chain'}
              </button>
            </div>

            {verifyResult && (
              <div className={`rounded-lg p-3 mb-4 text-sm ${
                verifyResult.valid
                  ? 'bg-coop-green-50 text-coop-green-800 border border-coop-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {verifyResult.valid
                  ? `Chain verified — all hashes valid.`
                  : `Chain verification FAILED. Possible tampering detected.`}
              </div>
            )}

            {events.length === 0 ? (
              <p className="text-gray-400 text-sm">No events recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-3">Event</th>
                      <th className="pb-2 pr-3">Aggregate</th>
                      <th className="pb-2 pr-3">Hash</th>
                      <th className="pb-2 pr-3">Prev Hash</th>
                      <th className="pb-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="py-2 pr-3">
                          <span className="badge bg-coop-green-100 text-coop-green-800">{event.eventType}</span>
                        </td>
                        <td className="py-2 pr-3 text-gray-600">
                          <span className="text-xs font-mono">{event.aggregateType}:{event.aggregateId.slice(0, 8)}</span>
                        </td>
                        <td className="py-2 pr-3">
                          <span className="text-xs font-mono text-coop-green-700" title={event.hash}>
                            {truncateHash(event.hash)}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <span className="text-xs font-mono text-gray-400" title={event.previousHash ?? 'genesis'}>
                            {event.previousHash ? truncateHash(event.previousHash) : 'genesis'}
                          </span>
                        </td>
                        <td className="py-2 text-gray-500 whitespace-nowrap">{formatRelativeTime(event.occurredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-coop-green-50 rounded-xl p-6 border border-coop-green-200">
            <h3 className="font-semibold text-coop-green-900 mb-2">How the hash chain works</h3>
            <div className="text-sm text-coop-green-800 space-y-2">
              <p>
                Every event is hashed using SHA-256. The hash input includes the event data
                <strong> plus the previous event&apos;s hash</strong>, creating a chain.
              </p>
              <p>
                If anyone modifies a past event, all subsequent hashes break — making tampering
                immediately detectable by anyone who verifies the chain.
              </p>
              <div className="font-mono text-xs bg-white/60 rounded-lg p-3 mt-3 overflow-x-auto">
                hash(event_N) = SHA-256(event_N.data + hash(event_N-1))
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
