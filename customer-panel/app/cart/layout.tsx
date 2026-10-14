import type { Metadata } from 'next';
import { getNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = getNoIndexMetadata(
  'Shopping Cart',
  'Review your selected items and proceed to express checkout.'
);

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
