import type { Metadata } from 'next';
import { siteConfig } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create an account on Experto Store to enjoy hyper-fast checkout and real-time delivery tracking.',
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: `Create Account | ${siteConfig.name}`,
    description: 'Create an account on Experto Store.',
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
