'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Restaurant } from '@/lib/types';

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.restaurants
      .list()
      .then(setRestaurants)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-32 bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-red-50 text-error rounded-lg p-4">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-coop-green-900 mb-2">Restaurants</h1>
      <p className="text-gray-600 mb-8">
        Every restaurant keeps 100% of their food price. Zero commissions, always.
      </p>

      {restaurants.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          No restaurants are currently open. Check back soon!
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurants.map((r) => (
            <Link key={r.id} href={`/customer/restaurants/${r.id}`} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-xl font-semibold text-coop-green-900">{r.name}</h2>
                <span className={`badge ${r.isOpen ? 'bg-coop-green-100 text-coop-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {r.isOpen ? 'Open' : 'Closed'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{r.description}</p>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>~{r.averagePrepTime} min prep</span>
                {r.address && <span>{r.address.city}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
