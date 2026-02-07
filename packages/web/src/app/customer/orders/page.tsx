'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatINR, formatRelativeTime } from '@/lib/utils';
import type { Order } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  created: 'Created',
  payment_held: 'Payment Held',
  restaurant_accepted: 'Accepted',
  restaurant_rejected: 'Rejected',
  posted_to_board: 'Finding Worker',
  worker_claimed: 'Worker Assigned',
  picked_up: 'Picked Up',
  delivered: 'Delivered',
  settled: 'Settled',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
  dispute_resolved: 'Resolved',
};

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-blue-100 text-blue-800',
  payment_held: 'bg-blue-100 text-blue-800',
  restaurant_accepted: 'bg-coop-green-100 text-coop-green-800',
  restaurant_rejected: 'bg-red-100 text-red-800',
  posted_to_board: 'bg-coop-amber-100 text-coop-amber-900',
  worker_claimed: 'bg-coop-amber-100 text-coop-amber-900',
  picked_up: 'bg-coop-amber-100 text-coop-amber-900',
  delivered: 'bg-coop-green-100 text-coop-green-800',
  settled: 'bg-coop-green-100 text-coop-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
  disputed: 'bg-red-100 text-red-800',
  dispute_resolved: 'bg-blue-100 text-blue-800',
};

export default function OrdersPage() {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    api.orders
      .list()
      .then(setOrders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-24 bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-coop-green-900 mb-8">My Orders</h1>

      {error && (
        <div className="bg-red-50 text-error rounded-lg p-4 mb-6">{error}</div>
      )}

      {orders.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No orders yet</p>
          <Link href="/customer/restaurants" className="btn-primary">
            Browse Restaurants
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link key={order.id} href={`/customer/orders/${order.id}`} className="card block hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatRelativeTime(order.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`badge ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                  <p className="text-sm font-semibold text-coop-green-900 mt-1">
                    {formatINR(order.total)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
