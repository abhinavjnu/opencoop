'use client';

import type { JobBoardEntry } from '@/lib/types';
import { formatINR, formatDistance, formatRelativeTime } from '@/lib/utils';

interface JobCardProps {
  job: JobBoardEntry;
  onClaim: (orderId: string) => void;
  claiming?: boolean;
}

export default function JobCard({ job, onClaim, claiming }: JobCardProps) {
  const totalPay = job.deliveryFee + job.tip;
  const readyAt = new Date(job.estimatedReadyAt);
  const isReady = readyAt <= new Date();

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-coop-green-900">{job.restaurantName}</h3>
          <p className="text-sm text-gray-500">Posted {formatRelativeTime(job.postedAt)}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-coop-green-900">{formatINR(totalPay)}</p>
          {job.tip > 0 && (
            <p className="text-xs text-gray-500">incl. {formatINR(job.tip)} tip</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {formatDistance(job.estimatedDistance)}
        </span>
        <span className={`flex items-center gap-1 ${isReady ? 'text-success font-medium' : ''}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isReady ? 'Ready now' : `Ready at ${readyAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
        </span>
      </div>

      <button
        onClick={() => onClaim(job.orderId)}
        disabled={claiming}
        className="btn-primary w-full"
      >
        {claiming ? 'Claiming...' : 'Claim This Job'}
      </button>
    </div>
  );
}
