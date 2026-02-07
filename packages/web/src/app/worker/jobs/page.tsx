'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import JobCard from '@/components/JobCard';
import type { JobBoardEntry, Worker } from '@/lib/types';

export default function JobBoardPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobBoardEntry[]>([]);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [w, j] = await Promise.all([api.workers.me(), api.workers.jobs()]);
      setWorker(w);
      setJobs(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function handleClaim(orderId: string) {
    setClaimingId(orderId);
    setError('');
    try {
      const location = worker?.currentLocation ?? { lat: 12.9716, lng: 77.5946 };
      await api.orders.claim(orderId, location);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim');
    } finally {
      setClaimingId(null);
    }
  }

  async function toggleOnline() {
    if (!worker) return;
    setTogglingStatus(true);
    setError('');
    try {
      if (worker.isOnline) {
        await api.workers.goOffline();
      } else {
        await api.workers.goOnline(
          worker.currentLocation ?? { lat: 12.9716, lng: 77.5946 },
          worker.zone,
        );
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setTogglingStatus(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-32 bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-coop-green-900">Job Board</h1>
          <p className="text-sm text-gray-600 mt-1">
            Every job visible. No hidden rankings. Your choice, always.
          </p>
        </div>
        <button
          onClick={toggleOnline}
          disabled={togglingStatus}
          className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
            worker?.isOnline
              ? 'bg-coop-green-600 text-white hover:bg-coop-green-700'
              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
          }`}
        >
          {togglingStatus ? '...' : worker?.isOnline ? '● Online' : '○ Go Online'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-error rounded-lg p-3 mb-6 text-sm">{error}</div>
      )}

      {!worker?.isOnline && (
        <div className="card bg-coop-amber-50 border-coop-amber-200 text-center py-8 mb-6">
          <p className="text-coop-amber-900 font-medium">You are currently offline.</p>
          <p className="text-sm text-coop-amber-800 mt-1">Go online to see available jobs and start earning.</p>
        </div>
      )}

      {worker?.isOnline && jobs.length === 0 && (
        <div className="card text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No jobs available right now</p>
          <p className="text-sm">New jobs appear here as restaurants accept orders. Auto-refreshing every 10 seconds.</p>
        </div>
      )}

      <div className="space-y-4">
        {jobs.map((job) => (
          <JobCard
            key={job.orderId}
            job={job}
            onClaim={handleClaim}
            claiming={claimingId === job.orderId}
          />
        ))}
      </div>
    </div>
  );
}
