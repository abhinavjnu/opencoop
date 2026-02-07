'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import type { WorkerDailyEarnings } from '@/lib/types';

export default function EarningsPage() {
  const [today, setToday] = useState<WorkerDailyEarnings | null>(null);
  const [history, setHistory] = useState<WorkerDailyEarnings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.workers.earningsToday(), api.workers.earnings()])
      .then(([t, h]) => {
        setToday(t);
        setHistory(h);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="card h-40 bg-gray-100" />
          <div className="card h-60 bg-gray-100" />
        </div>
      </div>
    );
  }

  const dailyMinimum = 60000;
  const todayEarnings = today?.totalEarnings ?? 0;
  const progressPct = Math.min(100, (todayEarnings / dailyMinimum) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-coop-green-900 mb-8">Earnings</h1>

      {error && (
        <div className="bg-red-50 text-error rounded-lg p-3 mb-6 text-sm">{error}</div>
      )}

      <div className="card mb-8">
        <h2 className="text-xl font-semibold text-coop-green-900 mb-4">Today</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500">Deliveries</p>
            <p className="text-2xl font-bold text-coop-green-900">{today?.deliveriesCompleted ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Delivery Fees</p>
            <p className="text-2xl font-bold text-coop-green-900">{formatINR(today?.deliveryFees ?? 0)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tips</p>
            <p className="text-2xl font-bold text-coop-amber-900">{formatINR(today?.tips ?? 0)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-coop-green-900">{formatINR(todayEarnings)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Daily minimum guarantee</span>
            <span className="font-medium">{formatINR(dailyMinimum)}</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                progressPct >= 100 ? 'bg-coop-green-600' : 'bg-coop-amber-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {progressPct >= 100
              ? 'You have earned above the daily minimum!'
              : `${formatINR(dailyMinimum - todayEarnings)} below minimum — the pool covers the gap at end of day.`}
          </p>
          {(today?.poolTopup ?? 0) > 0 && (
            <p className="text-sm text-coop-green-700 font-medium">
              Pool top-up: {formatINR(today!.poolTopup)}
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold text-coop-green-900 mb-4">History</h2>
        {history.length === 0 ? (
          <p className="text-gray-500 text-sm">No earnings history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2">Deliveries</th>
                  <th className="pb-2">Fees</th>
                  <th className="pb-2">Tips</th>
                  <th className="pb-2">Pool Top-up</th>
                  <th className="pb-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {history.map((day, idx) => (
                  <tr key={idx} className="border-b last:border-b-0">
                    <td className="py-2">{day.deliveriesCompleted}</td>
                    <td className="py-2">{formatINR(day.deliveryFees)}</td>
                    <td className="py-2">{formatINR(day.tips)}</td>
                    <td className="py-2 text-coop-green-700">{day.poolTopup > 0 ? formatINR(day.poolTopup) : '—'}</td>
                    <td className="py-2 font-medium">{formatINR(day.totalEarnings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
