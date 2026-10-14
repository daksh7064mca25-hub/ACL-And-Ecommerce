import type { Metadata } from 'next';
import NearbyProductsPageClient from './NearbyStoresClient';
import { siteConfig } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Nearby Stores & Delivery Zones',
  description:
    'Discover Experto Store fulfillment hubs, explore local delivery radiuses, and order products available for fast hyperlocal express dispatch.',
  alternates: {
    canonical: '/nearby',
  },
  openGraph: {
    title: `Nearby Stores & Delivery Zones | ${siteConfig.name}`,
    description:
      'Discover Experto Store fulfillment hubs, explore local delivery radiuses, and order products available for fast hyperlocal express dispatch.',
    url: '/nearby',
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: 'website',
    images: [
      {
        url: siteConfig.defaultOgImage,
        width: 1200,
        height: 630,
        alt: 'Experto Store Nearby Fulfillment Hubs',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Nearby Stores & Delivery Zones | ${siteConfig.name}`,
    description:
      'Discover Experto Store fulfillment hubs, explore local delivery radiuses, and order products available for fast hyperlocal express dispatch.',
    images: [siteConfig.defaultOgImage],
    creator: siteConfig.twitterHandle,
  },
};

export default function NearbyPage() {
  return <NearbyProductsPageClient />;
}
