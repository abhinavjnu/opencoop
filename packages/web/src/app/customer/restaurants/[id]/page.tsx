'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatINR } from '@/lib/utils';
import type { Restaurant, MenuItem, OrderItem } from '@/lib/types';

export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Map<string, OrderItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([api.restaurants.get(id), api.restaurants.getMenu(id)])
      .then(([r, m]) => {
        setRestaurant(r);
        setMenu(m);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      if (existing) {
        next.set(item.id, { ...existing, quantity: existing.quantity + 1 });
      } else {
        next.set(item.id, {
          menuItemId: item.id,
          name: item.name,
          quantity: 1,
          unitPrice: item.price,
        });
      }
      return next;
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      if (existing && existing.quantity > 1) {
        next.set(itemId, { ...existing, quantity: existing.quantity - 1 });
      } else {
        next.delete(itemId);
      }
      return next;
    });
  }, []);

  const cartItems = Array.from(cart.values());
  const cartTotal = cartItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  const handleCheckout = () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    sessionStorage.setItem(
      'openfood_cart',
      JSON.stringify({
        restaurantId: id,
        restaurantName: restaurant?.name,
        items: cartItems,
        subtotal: cartTotal,
      }),
    );
    router.push('/customer/checkout');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="grid md:grid-cols-2 gap-4 mt-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card h-24 bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-red-50 text-error rounded-lg p-4">{error || 'Restaurant not found'}</div>
      </div>
    );
  }

  const categories = [...new Set(menu.map((m) => m.category))];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-coop-green-900">{restaurant.name}</h1>
        <p className="text-gray-600 mt-1">{restaurant.description}</p>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          <span>~{restaurant.averagePrepTime} min prep</span>
          <span className={`badge ${restaurant.isOpen ? 'bg-coop-green-100 text-coop-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {restaurant.isOpen ? 'Open' : 'Closed'}
          </span>
        </div>
        <p className="text-sm text-coop-green-700 mt-2 font-medium">
          This restaurant keeps 100% of the food price. Zero commissions.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {categories.map((category) => (
            <div key={category}>
              <h2 className="text-xl font-semibold text-coop-green-900 mb-4 capitalize">{category}</h2>
              <div className="space-y-3">
                {menu
                  .filter((m) => m.category === category)
                  .map((item) => {
                    const inCart = cart.get(item.id);
                    return (
                      <div key={item.id} className="card flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{item.name}</h3>
                          {item.description && (
                            <p className="text-sm text-gray-500 line-clamp-1">{item.description}</p>
                          )}
                          <p className="text-coop-green-800 font-semibold mt-1">{formatINR(item.price)}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {inCart ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="w-8 h-8 rounded-full border-2 border-coop-green-600 text-coop-green-600 flex items-center justify-center hover:bg-coop-green-50"
                              >
                                −
                              </button>
                              <span className="w-6 text-center font-medium">{inCart.quantity}</span>
                              <button
                                onClick={() => addToCart(item)}
                                className="w-8 h-8 rounded-full bg-coop-green-600 text-white flex items-center justify-center hover:bg-coop-green-700"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(item)}
                              className="btn-outline text-sm px-4 py-1.5"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="card sticky top-20">
            <h2 className="text-xl font-semibold text-coop-green-900 mb-4">Your Order</h2>
            {cartItems.length === 0 ? (
              <p className="text-gray-500 text-sm">Add items to get started</p>
            ) : (
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div key={item.menuItemId} className="flex justify-between text-sm">
                    <span>
                      {item.quantity}× {item.name}
                    </span>
                    <span className="font-medium">{formatINR(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t pt-3 flex justify-between font-semibold">
                  <span>Subtotal ({cartCount} items)</span>
                  <span>{formatINR(cartTotal)}</span>
                </div>
                <button onClick={handleCheckout} className="btn-primary w-full mt-2">
                  Proceed to Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
