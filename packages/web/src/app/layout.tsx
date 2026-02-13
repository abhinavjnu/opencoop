import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'OpenFood — Cooperative Food Delivery',
  description: 'Food delivery by the people, for the people. No commissions, transparent fees, democratic governance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Header />
          <main className="min-h-[calc(100vh-4rem)]">
            {children}
          </main>
          <footer className="bg-coop-green-900 text-coop-green-200 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-sm">
                  OpenFood — A cooperative, not a corporation.
                </p>
                <p className="text-xs text-coop-green-400">
                  Every transaction is auditable. Every fee is transparent. Every voice counts.
                </p>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
