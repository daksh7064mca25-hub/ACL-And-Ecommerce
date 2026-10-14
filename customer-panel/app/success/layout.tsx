import type { Metadata } from 'next';
import { getNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = getNoIndexMetadata(
  'Order Confirmed',
  'Thank you for your order. Live delivery updates are being prepared.'
);

export default function SuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
