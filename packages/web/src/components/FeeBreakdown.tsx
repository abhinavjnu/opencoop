import { formatINR } from '@/lib/utils';

interface FeeBreakdownProps {
  subtotal: number;
  deliveryFee: number;
  tip: number;
  total: number;
}

export default function FeeBreakdown({ subtotal, deliveryFee, tip, total }: FeeBreakdownProps) {
  const poolContribution = Math.round(deliveryFee * 0.1);
  const infraFee = Math.round(deliveryFee * 0.1);
  const workerReceives = deliveryFee - poolContribution - infraFee + tip;

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-coop-green-900">Transparent Fee Breakdown</h3>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Food subtotal</span>
          <span className="font-medium">{formatINR(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Delivery fee</span>
          <span className="font-medium">{formatINR(deliveryFee)}</span>
        </div>
        {tip > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Tip</span>
            <span className="font-medium">{formatINR(tip)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-200 pt-1.5 font-semibold">
          <span>Total</span>
          <span>{formatINR(total)}</span>
        </div>
      </div>

      <div className="bg-coop-green-50 rounded-lg p-3 space-y-1.5 text-sm">
        <h4 className="font-medium text-coop-green-800 text-xs uppercase tracking-wide">Where your money goes</h4>
        <div className="flex justify-between">
          <span className="text-coop-green-700">Restaurant receives</span>
          <span className="font-medium text-coop-green-900">100% of food price → {formatINR(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-coop-green-700">Worker receives</span>
          <span className="font-medium text-coop-green-900">{formatINR(workerReceives)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-coop-green-700">Worker guarantee pool</span>
          <span className="font-medium text-coop-green-900">{formatINR(poolContribution)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-coop-green-700">Coop infrastructure</span>
          <span className="font-medium text-coop-green-900">{formatINR(infraFee)}</span>
        </div>
      </div>
    </div>
  );
}
