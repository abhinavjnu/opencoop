'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { ProposalCategory } from '@/lib/types';

const CATEGORIES: { value: ProposalCategory; label: string }[] = [
  { value: 'delivery_fee', label: 'Delivery Fee' },
  { value: 'pool_rules', label: 'Pool Rules' },
  { value: 'dispute_policy', label: 'Dispute Policy' },
  { value: 'membership', label: 'Membership' },
  { value: 'other', label: 'Other' },
];

export default function NewProposalPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProposalCategory>('other');
  const [hasParamChange, setHasParamChange] = useState(false);
  const [parameter, setParameter] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [proposedValue, setProposedValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const data: Parameters<typeof api.governance.createProposal>[0] = {
        title,
        description,
        category,
      };

      if (hasParamChange && parameter) {
        data.parameterChange = {
          parameter,
          currentValue: parseFloat(currentValue) || currentValue,
          proposedValue: parseFloat(proposedValue) || proposedValue,
        };
      }

      const result = await api.governance.createProposal(data);
      router.push(`/governance/${result.proposalId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-coop-green-900 mb-2">New Proposal</h1>
      <p className="text-gray-600 mb-8">
        Propose a change to the cooperative. Workers and restaurants will vote.
      </p>

      {error && (
        <div className="bg-red-50 text-error rounded-lg p-3 mb-6 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field"
            placeholder="What do you want to change?"
            required
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ProposalCategory)}
            className="input-field"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field min-h-[120px]"
            placeholder="Explain why this change is needed and how it benefits the cooperative..."
            required
          />
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasParamChange}
              onChange={(e) => setHasParamChange(e.target.checked)}
              className="accent-coop-green-600"
            />
            <span className="text-sm font-medium text-gray-700">This changes a system parameter</span>
          </label>
        </div>

        {hasParamChange && (
          <div className="card bg-coop-cream space-y-3">
            <input
              type="text"
              value={parameter}
              onChange={(e) => setParameter(e.target.value)}
              className="input-field"
              placeholder="Parameter name (e.g., baseDeliveryFee)"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                className="input-field"
                placeholder="Current value"
              />
              <input
                type="text"
                value={proposedValue}
                onChange={(e) => setProposedValue(e.target.value)}
                className="input-field"
                placeholder="Proposed value"
              />
            </div>
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Submitting...' : 'Submit Proposal'}
        </button>
      </form>
    </div>
  );
}
