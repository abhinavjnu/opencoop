'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatINR } from '@/lib/utils';
import type { MenuItem, Restaurant } from '@/lib/types';

export default function MenuManagementPage() {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', category: '' });
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const restaurants = await api.restaurants.list();
      const myRestaurant = restaurants.find((r: Restaurant) => r.userId === user?.userId) ?? null;
      if (myRestaurant) {
        setRestaurant(myRestaurant);
        const items = await api.restaurants.getMenu(myRestaurant.id);
        setMenu(items);
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

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant) return;
    setAdding(true);
    setError('');

    try {
      await api.restaurants.addMenuItem(restaurant.id, {
        name: newItem.name,
        description: newItem.description,
        price: Math.round(parseFloat(newItem.price) * 100),
        category: newItem.category,
      });
      setNewItem({ name: '', description: '', price: '', category: '' });
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setAdding(false);
    }
  }

  async function toggleAvailability(item: MenuItem) {
    if (!restaurant) return;
    try {
      await api.restaurants.updateMenuItem(restaurant.id, item.id, {
        isAvailable: !item.isAvailable,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-20 bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="card text-center py-12 text-gray-500">
          No restaurant profile found.
        </div>
      </div>
    );
  }

  const categories = [...new Set(menu.map((m) => m.category))];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-coop-green-900">Menu Management</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
          {showAddForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-error rounded-lg p-3 mb-6 text-sm">{error}</div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddItem} className="card mb-8 space-y-4">
          <h2 className="font-semibold text-coop-green-900">New Menu Item</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="text"
              value={newItem.name}
              onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))}
              className="input-field"
              placeholder="Item name"
              required
            />
            <input
              type="text"
              value={newItem.category}
              onChange={(e) => setNewItem((n) => ({ ...n, category: e.target.value }))}
              className="input-field"
              placeholder="Category (e.g., mains, sides)"
              required
            />
          </div>
          <input
            type="text"
            value={newItem.description}
            onChange={(e) => setNewItem((n) => ({ ...n, description: e.target.value }))}
            className="input-field"
            placeholder="Description"
          />
          <input
            type="number"
            value={newItem.price}
            onChange={(e) => setNewItem((n) => ({ ...n, price: e.target.value }))}
            className="input-field"
            placeholder="Price in ₹ (e.g., 150.00)"
            step="0.01"
            min="0"
            required
          />
          <button type="submit" disabled={adding} className="btn-primary">
            {adding ? 'Adding...' : 'Add Item'}
          </button>
        </form>
      )}

      {categories.map((category) => (
        <section key={category} className="mb-8">
          <h2 className="text-xl font-semibold text-coop-green-900 mb-4 capitalize">{category}</h2>
          <div className="space-y-3">
            {menu
              .filter((m) => m.category === category)
              .map((item) => (
                <div key={item.id} className="card flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-gray-500">{item.description}</p>
                    )}
                    <p className="text-coop-green-800 font-semibold mt-1">{formatINR(item.price)}</p>
                  </div>
                  <button
                    onClick={() => toggleAvailability(item)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      item.isAvailable
                        ? 'bg-coop-green-100 text-coop-green-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {item.isAvailable ? 'Available' : 'Unavailable'}
                  </button>
                </div>
              ))}
          </div>
        </section>
      ))}

      {menu.length === 0 && (
        <div className="card text-center py-12 text-gray-500">
          No menu items yet. Add your first item above.
        </div>
      )}
    </div>
  );
}
