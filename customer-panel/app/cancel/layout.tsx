import type { Metadata } from 'next';
import { getNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = getNoIndexMetadata(
  'Payment Cancelled',
  'Your transaction was not completed. Your cart items are preserved.'
);

export default function CancelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
