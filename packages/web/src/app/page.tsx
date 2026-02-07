import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <section className="bg-gradient-to-br from-coop-green-900 via-coop-green-800 to-coop-green-900 text-white py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Food delivery by the people,
            <br />
            <span className="text-coop-amber-400">for the people.</span>
          </h1>
          <p className="text-xl md:text-2xl text-coop-green-200 max-w-3xl mx-auto mb-10">
            No commissions on restaurants. No algorithmic coercion of workers.
            No hidden fees. Just food, delivered fairly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn-secondary text-lg px-8 py-3">
              Join the Cooperative
            </Link>
            <Link href="/transparency" className="btn-outline border-white text-white hover:bg-coop-green-700 text-lg px-8 py-3">
              See Where Every Rupee Goes
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-coop-green-900 text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="w-16 h-16 bg-coop-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🍽️</span>
              </div>
              <h3 className="text-xl font-semibold text-coop-green-900 mb-2">For Restaurants</h3>
              <p className="text-gray-600">
                Keep 100% of your food price. Zero commissions. Zero lock-in.
                You set your menu, your hours, your terms.
              </p>
            </div>

            <div className="card text-center">
              <div className="w-16 h-16 bg-coop-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🚲</span>
              </div>
              <h3 className="text-xl font-semibold text-coop-green-900 mb-2">For Workers</h3>
              <p className="text-gray-600">
                See every job. Reject any job. No penalties, no hidden rankings.
                Daily minimum guarantee from the shared pool.
              </p>
            </div>

            <div className="card text-center">
              <div className="w-16 h-16 bg-coop-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🧑</span>
              </div>
              <h3 className="text-xl font-semibold text-coop-green-900 mb-2">For Customers</h3>
              <p className="text-gray-600">
                See exactly where your money goes. A transparent delivery fee — no
                surge pricing, no dark patterns. Fair food, fairly delivered.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-coop-cream py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-coop-green-900 text-center mb-12">
            Our Principles
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="flex gap-4">
              <div className="text-coop-green-600 text-2xl mt-0.5">✓</div>
              <div>
                <h3 className="font-semibold text-coop-green-900">No Extraction</h3>
                <p className="text-gray-600 text-sm">
                  Restaurants keep 100% of food revenue. Workers keep 80%+ of the delivery fee.
                  The rest goes to a transparent worker guarantee pool and infrastructure.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="text-coop-green-600 text-2xl mt-0.5">✓</div>
              <div>
                <h3 className="font-semibold text-coop-green-900">Worker Autonomy</h3>
                <p className="text-gray-600 text-sm">
                  Every worker sees every job. No hidden algorithms decide who gets what.
                  Reject unlimited jobs with zero penalties.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="text-coop-green-600 text-2xl mt-0.5">✓</div>
              <div>
                <h3 className="font-semibold text-coop-green-900">Democratic Governance</h3>
                <p className="text-gray-600 text-sm">
                  Workers and restaurants vote on delivery fees, pool rules, and dispute policies.
                  One member, one vote. No board of directors overrides.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="text-coop-green-600 text-2xl mt-0.5">✓</div>
              <div>
                <h3 className="font-semibold text-coop-green-900">Every Rupee Auditable</h3>
                <p className="text-gray-600 text-sm">
                  Immutable event log with cryptographic hash chain. Every transaction,
                  every payout, every vote — verifiable by anyone.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-coop-green-900 mb-4">
            Ready to join?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Whether you cook, deliver, or eat — you deserve a platform that works for you, not against you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register?role=restaurant" className="btn-primary text-lg px-8 py-3">
              Register as Restaurant
            </Link>
            <Link href="/register?role=worker" className="btn-secondary text-lg px-8 py-3">
              Register as Worker
            </Link>
            <Link href="/register?role=customer" className="btn-outline text-lg px-8 py-3">
              Order Food
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
