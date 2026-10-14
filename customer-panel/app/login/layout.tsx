import type { Metadata } from 'next';
import { siteConfig } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Experto Store customer account to manage orders, addresses, and live deliveries.',
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: `Sign In | ${siteConfig.name}`,
    description: 'Sign in to your Experto Store account.',
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
