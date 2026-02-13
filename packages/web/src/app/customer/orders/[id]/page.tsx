'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import OrderTimeline from '@/components/OrderTimeline';
import FeeBreakdown from '@/components/FeeBreakdown';
import type { Order } from '@/lib/types';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.orders
      .get(id)
      .then(setOrder)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCancel() {
    if (!order) return;
    setCancelling(true);
    try {
      await api.orders.cancel(order.id, 'Customer cancelled');
      const refreshed = await api.orders.get(order.id);
      setOrder(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="card h-48 bg-gray-100" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-red-50 text-error rounded-lg p-4">{error || 'Order not found'}</div>
      </div>
    );
  }

  const canCancel = ['created', 'payment_held', 'restaurant_accepted', 'posted_to_board'].includes(order.status);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-coop-green-900 mb-2">Order Details</h1>
      <p className="text-sm text-gray-500 mb-8">Order {order.id.slice(0, 8)}...</p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-coop-green-900 mb-4">Order Status</h2>
            <OrderTimeline
              status={order.status}
              createdAt={order.createdAt}
              updatedAt={order.updatedAt}
            />
          </div>

          <div className="card">
            <h2 className="font-semibold text-coop-green-900 mb-4">Items</h2>
            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{item.quantity}× {item.name}</span>
                  <span className="font-medium">{formatINR(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full py-2.5 rounded-lg border-2 border-error text-error font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </button>
          )}
        </div>

        <div>
          <FeeBreakdown
            subtotal={order.subtotal}
            deliveryFee={order.deliveryFee}
            tip={order.tip}
            total={order.total}
          />
        </div>
      </div>
    </div>
  );
}
