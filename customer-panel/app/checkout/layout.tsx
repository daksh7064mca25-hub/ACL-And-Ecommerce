import type { Metadata } from 'next';
import { getNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = getNoIndexMetadata(
  'Secure Checkout',
  'Complete your order with 256-bit SSL encrypted Stripe payment processing.'
);

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
