import type { Metadata } from 'next';
import { getNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = getNoIndexMetadata(
  'Offline',
  'You are currently offline. Check your internet connection.'
);

export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
