'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import OrderTimeline from '@/components/OrderTimeline';
import type { Order, Worker } from '@/lib/types';

export default function ActiveDeliveryPage() {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [w, active] = await Promise.all([api.workers.me(), api.workers.activeOrder()]);
      setWorker(w);
      setOrder(active ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function handlePickup() {
    if (!order || !worker) return;
    setActing(true);
    setError('');
    try {
      const location = worker.currentLocation ?? { lat: 12.9716, lng: 77.5946 };
      await api.orders.pickup(order.id, location);
      const refreshed = await api.orders.get(order.id);
      setOrder(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark pickup');
    } finally {
      setActing(false);
    }
  }

  async function handleDeliver() {
    if (!order || !worker) return;
    setActing(true);
    setError('');
    try {
      const location = worker.currentLocation ?? { lat: 12.9716, lng: 77.5946 };
      await api.orders.deliver(order.id, {
        workerLocation: location,
        signatureConfirmation: true,
      });
      const refreshed = await api.orders.get(order.id);
      setOrder(refreshed);
      if (refreshed.status === 'delivered' || refreshed.status === 'settled') {
        router.push('/worker/earnings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm delivery');
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="card h-40 bg-gray-100" />
          <div className="card h-60 bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="card text-center py-16">
          <div className="text-4xl mb-4">🛵</div>
          <h2 className="text-xl font-semibold text-coop-green-900 mb-2">No active delivery</h2>
          <p className="text-gray-500 mb-6">Claim a job from the board to start a delivery.</p>
          <a href="/worker/jobs" className="btn-primary inline-block">
            Go to Job Board
          </a>
        </div>
      </div>
    );
  }

  const isClaimed = order.status === 'worker_claimed';
  const isPickedUp = order.status === 'picked_up';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-coop-green-900 mb-2">Active Delivery</h1>
      <p className="text-sm text-gray-500 mb-8">Order #{order.id.slice(0, 8)}</p>

      {error && (
        <div className="bg-red-50 text-error rounded-lg p-3 mb-6 text-sm">{error}</div>
      )}

      {/* Action Card */}
      <div className={`card mb-6 border-2 ${
        isClaimed ? 'border-coop-amber-400 bg-coop-amber-50' : 'border-coop-green-400 bg-coop-green-50'
      }`}>
        <div className="text-center py-4">
          {isClaimed && (
            <>
              <p className="text-lg font-semibold text-coop-amber-900 mb-2">Head to the restaurant</p>
              <p className="text-sm text-coop-amber-800 mb-4">
                Pick up the order and confirm when you have it.
              </p>
              <button
                onClick={handlePickup}
                disabled={acting}
                className="btn-secondary text-lg px-8 py-3"
              >
                {acting ? 'Confirming...' : 'Confirm Pickup'}
              </button>
            </>
          )}
          {isPickedUp && (
            <>
              <p className="text-lg font-semibold text-coop-green-900 mb-2">Deliver to customer</p>
              <p className="text-sm text-coop-green-800 mb-4">
                Drop off the order and confirm delivery.
              </p>
              <button
                onClick={handleDeliver}
                disabled={acting}
                className="btn-primary text-lg px-8 py-3"
              >
                {acting ? 'Confirming...' : 'Confirm Delivery'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Order Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3 className="font-semibold text-coop-green-900 mb-3">Pickup</h3>
          <p className="text-sm text-gray-700">{order.pickupAddress.street}</p>
          <p className="text-sm text-gray-500">{order.pickupAddress.city} {order.pickupAddress.postalCode}</p>
          {order.estimatedPrepTime && (
            <p className="text-xs text-coop-amber-800 mt-2">
              Est. prep: {order.estimatedPrepTime} min
            </p>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-coop-green-900 mb-3">Drop-off</h3>
          <p className="text-sm text-gray-700">{order.deliveryAddress.street}</p>
          <p className="text-sm text-gray-500">{order.deliveryAddress.city} {order.deliveryAddress.postalCode}</p>
        </div>
      </div>

      {/* Items */}
      <div className="card mb-6">
        <h3 className="font-semibold text-coop-green-900 mb-3">Order Items</h3>
        <div className="space-y-2">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {item.quantity}× {item.name}
              </span>
              <span className="font-medium">{formatINR(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="border-t mt-3 pt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span>{formatINR(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Delivery fee</span>
            <span>{formatINR(order.deliveryFee)}</span>
          </div>
          {order.tip > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Tip</span>
              <span className="text-coop-amber-900">{formatINR(order.tip)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold pt-1">
            <span>Total</span>
            <span>{formatINR(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Your Earnings from this order */}
      <div className="card mb-6 bg-coop-green-50 border-coop-green-200">
        <h3 className="font-semibold text-coop-green-900 mb-3">Your Earnings (this order)</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-coop-green-700">Delivery fee (after pool + infra)</span>
            <span className="font-medium text-coop-green-900">
              {formatINR(Math.round(order.deliveryFee * 0.8))}
            </span>
          </div>
          {order.tip > 0 && (
            <div className="flex justify-between">
              <span className="text-coop-green-700">Tip (100% yours)</span>
              <span className="font-medium text-coop-green-900">{formatINR(order.tip)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold border-t border-coop-green-200 pt-1.5">
            <span className="text-coop-green-900">You receive</span>
            <span className="text-coop-green-900">
              {formatINR(Math.round(order.deliveryFee * 0.8) + order.tip)}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <h3 className="font-semibold text-coop-green-900 mb-4">Order Progress</h3>
        <OrderTimeline
          status={order.status}
          createdAt={order.createdAt}
          updatedAt={order.updatedAt}
        />
      </div>
    </div>
  );
}
