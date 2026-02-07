import type { OrderStatus } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'created', label: 'Order Placed' },
  { status: 'payment_held', label: 'Payment Secured' },
  { status: 'restaurant_accepted', label: 'Restaurant Accepted' },
  { status: 'posted_to_board', label: 'Finding Worker' },
  { status: 'worker_claimed', label: 'Worker Assigned' },
  { status: 'picked_up', label: 'Picked Up' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'settled', label: 'Payment Settled' },
];

const STATUS_ORDER: Record<string, number> = {};
STEPS.forEach((s, i) => { STATUS_ORDER[s.status] = i; });

interface OrderTimelineProps {
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export default function OrderTimeline({ status, createdAt, updatedAt }: OrderTimelineProps) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-error">
        <span className="inline-block w-3 h-3 bg-error rounded-full" />
        <span className="font-medium">Order Cancelled</span>
        <span className="text-sm text-gray-500 ml-auto">{formatDateTime(updatedAt)}</span>
      </div>
    );
  }

  if (status === 'restaurant_rejected') {
    return (
      <div className="flex items-center gap-2 text-error">
        <span className="inline-block w-3 h-3 bg-error rounded-full" />
        <span className="font-medium">Restaurant Rejected</span>
        <span className="text-sm text-gray-500 ml-auto">{formatDateTime(updatedAt)}</span>
      </div>
    );
  }

  const currentIdx = STATUS_ORDER[status] ?? -1;

  return (
    <div className="space-y-0">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isPending = i > currentIdx;

        return (
          <div key={step.status} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  isCompleted
                    ? 'bg-success border-success'
                    : isCurrent
                      ? 'bg-coop-amber-500 border-coop-amber-500 animate-pulse'
                      : 'bg-gray-200 border-gray-300'
                }`}
              />
              {i < STEPS.length - 1 && (
                <div
                  className={`w-0.5 h-6 ${
                    isCompleted ? 'bg-success' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
            <div className={`pb-4 ${isPending ? 'text-gray-400' : ''}`}>
              <span className={`text-sm font-medium ${isCurrent ? 'text-coop-amber-900' : ''}`}>
                {step.label}
              </span>
              {(isCompleted || isCurrent) && (
                <span className="ml-2 text-xs text-gray-500">
                  {i === 0 ? formatDateTime(createdAt) : isCurrent ? formatDateTime(updatedAt) : ''}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
