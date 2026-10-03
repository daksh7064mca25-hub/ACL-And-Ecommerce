import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DeliveryLocationModal from '@/components/DeliveryLocationModal';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { DeliveryLocationProvider } from '@/context/DeliveryLocationContext';

export const metadata: Metadata = {
  title: 'ExpertoStore | Premium Gear & Express Delivery',
  description: 'Shop curated high-performance tech, peripherals, and electronics with instant checkout, live delivery zone tracking, and secure Stripe payment processing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 flex flex-col min-h-screen antialiased selection:bg-indigo-500 selection:text-white">
        <AuthProvider>
          <DeliveryLocationProvider>
            <CartProvider>
              <Navbar />
              <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </main>
              <Footer />
              <DeliveryLocationModal />
            </CartProvider>
          </DeliveryLocationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
