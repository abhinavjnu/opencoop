'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatINR } from '@/lib/utils';
import FeeBreakdown from '@/components/FeeBreakdown';
import type { OrderItem, Address } from '@/lib/types';

interface CartData {
  restaurantId: string;
  restaurantName: string;
  items: OrderItem[];
  subtotal: number;
}

export default function CheckoutPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [cart, setCart] = useState<CartData | null>(null);
  const [tip, setTip] = useState(0);
  const [address, setAddress] = useState<Address>({
    street: '',
    city: '',
    postalCode: '',
    lat: 12.9716,
    lng: 77.5946,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [estimatedDeliveryFee, setEstimatedDeliveryFee] = useState(5000);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const stored = sessionStorage.getItem('openfood_cart') ?? sessionStorage.getItem('opencoop_cart');
    if (!stored) {
      router.push('/customer/restaurants');
      return;
    }
    setCart(JSON.parse(stored));
    if (!sessionStorage.getItem('openfood_cart')) {
      sessionStorage.setItem('openfood_cart', stored);
      sessionStorage.removeItem('opencoop_cart');
    }

    api.governance.parameters().then((params) => {
      if (params) {
        const baseFee = params.baseDeliveryFee ?? 4000;
        const perKmRate = params.perKmRate ?? 1000;
        // ~3km average distance estimate; actual fee calculated server-side on order creation
        const estimatedDistanceKm = 3;
        setEstimatedDeliveryFee(baseFee + perKmRate * estimatedDistanceKm);
      }
    }).catch(() => {});
  }, [isAuthenticated, router]);

  if (!cart) return null;

  const total = cart.subtotal + estimatedDeliveryFee + tip;

  async function handleOrder() {
    if (!cart) return;
    if (!address.street || !address.city) {
      setError('Please fill in your delivery address');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const order = await api.orders.create({
        restaurantId: cart.restaurantId,
        items: cart.items,
        deliveryAddress: address,
        tip,
      });
      sessionStorage.removeItem('openfood_cart');
      sessionStorage.removeItem('opencoop_cart');
      router.push(`/customer/orders/${order.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-coop-green-900 mb-2">Checkout</h1>
      <p className="text-gray-600 mb-8">Order from {cart.restaurantName}</p>

      {error && (
        <div className="bg-red-50 text-error rounded-lg p-3 mb-6 text-sm">{error}</div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-coop-green-900 mb-4">Delivery Address</h2>
            <div className="space-y-3">
              <input
                type="text"
                value={address.street}
                onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))}
                className="input-field"
                placeholder="Street address"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                  className="input-field"
                  placeholder="City"
                />
                <input
                  type="text"
                  value={address.postalCode}
                  onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))}
                  className="input-field"
                  placeholder="Postal code"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-coop-green-900 mb-4">Tip for Worker</h2>
            <p className="text-sm text-gray-500 mb-3">100% of your tip goes directly to the delivery worker.</p>
            <div className="flex gap-2">
              {[0, 2000, 3000, 5000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setTip(amount)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tip === amount
                      ? 'bg-coop-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {amount === 0 ? 'No tip' : formatINR(amount)}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-coop-green-900 mb-4">Order Summary</h2>
            <div className="space-y-2">
              {cart.items.map((item) => (
                <div key={item.menuItemId} className="flex justify-between text-sm">
                  <span>{item.quantity}× {item.name}</span>
                  <span>{formatINR(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <FeeBreakdown
            subtotal={cart.subtotal}
            deliveryFee={estimatedDeliveryFee}
            tip={tip}
            total={total}
          />

          <button
            onClick={handleOrder}
            disabled={submitting}
            className="btn-primary w-full text-lg py-3"
          >
            {submitting ? 'Placing Order...' : `Place Order — ${formatINR(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
