'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatINR, formatRelativeTime } from '@/lib/utils';
import type { Order, Restaurant } from '@/lib/types';

const ACTIVE_STATUSES = ['payment_held', 'restaurant_accepted', 'posted_to_board', 'worker_claimed', 'picked_up'];

export default function RestaurantDashboard() {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const restaurants = await api.restaurants.list();
      const myRestaurant = restaurants.find((r: Restaurant) => r.userId === user?.userId) ?? null;
      if (myRestaurant) {
        setRestaurant(myRestaurant);
        const orderList = await api.restaurants.getOrders(myRestaurant.id);
        setOrders(orderList);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAccept(orderId: string) {
    try {
      await api.orders.accept(orderId, restaurant?.averagePrepTime ?? 20);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept');
    }
  }

  async function handleReject(orderId: string) {
    try {
      await api.orders.reject(orderId, 'Restaurant rejected');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    }
  }

  async function toggleOpen() {
    if (!restaurant) return;
    try {
      const result = await api.restaurants.updateStatus(restaurant.id, !restaurant.isOpen);
      setRestaurant({ ...restaurant, isOpen: result.isOpen });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card h-32 bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="card text-center py-12 text-gray-500">
          No restaurant profile found. Please register your restaurant first.
        </div>
      </div>
    );
  }

  const pendingOrders = orders.filter((o) => o.status === 'payment_held');
  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status) && o.status !== 'payment_held');
  const pastOrders = orders.filter((o) => !ACTIVE_STATUSES.includes(o.status) && o.status !== 'payment_held');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-coop-green-900">{restaurant.name}</h1>
          <p className="text-sm text-coop-green-700 font-medium mt-1">
            You keep 100% of food revenue. Zero commissions.
          </p>
        </div>
        <button onClick={toggleOpen} className={`px-4 py-2 rounded-lg font-medium ${restaurant.isOpen ? 'bg-coop-green-100 text-coop-green-800' : 'bg-gray-200 text-gray-600'}`}>
          {restaurant.isOpen ? '● Open' : '○ Closed'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-error rounded-lg p-3 mb-6 text-sm">{error}</div>
      )}

      {pendingOrders.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-coop-amber-900 mb-4">
            Incoming Orders ({pendingOrders.length})
          </h2>
          <div className="space-y-4">
            {pendingOrders.map((order) => (
              <div key={order.id} className="card border-coop-amber-300 border-2">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium">{order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
                    <p className="text-sm text-gray-500 mt-1">{formatRelativeTime(order.createdAt)}</p>
                  </div>
                  <p className="font-bold text-coop-green-900">{formatINR(order.subtotal)}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleAccept(order.id)} className="btn-primary flex-1">Accept</button>
                  <button onClick={() => handleReject(order.id)} className="btn-outline flex-1 border-error text-error hover:bg-red-50">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeOrders.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-coop-green-900 mb-4">
            Active Orders ({activeOrders.length})
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {activeOrders.map((order) => (
              <div key={order.id} className="card">
                <div className="flex justify-between mb-2">
                  <p className="font-medium text-sm">{order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
                  <span className="badge bg-coop-green-100 text-coop-green-800 text-xs">
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{formatINR(order.subtotal)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Past Orders ({pastOrders.length})</h2>
        {pastOrders.length === 0 ? (
          <p className="text-gray-500 text-sm">No past orders yet.</p>
        ) : (
          <div className="space-y-2">
            {pastOrders.slice(0, 20).map((order) => (
              <div key={order.id} className="card py-3 flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm">{order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
                  <p className="text-xs text-gray-500">{formatRelativeTime(order.createdAt)}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium">{formatINR(order.subtotal)}</span>
                  <span className="badge bg-gray-100 text-gray-600 ml-2 text-xs">{order.status.replace(/_/g, ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
