import type { Metadata } from 'next';
import { getNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = getNoIndexMetadata(
  'My Orders & Deliveries',
  'Track live deliveries, view purchase history, and manage refund requests.'
);

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
