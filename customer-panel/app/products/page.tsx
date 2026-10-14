import type { Metadata } from 'next';
import ProductsCatalogClient from './ProductsCatalogClient';
import { siteConfig } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Product Catalog',
  description:
    'Browse our full collection of high-performance electronics, tech peripherals, and gear with instant checkout and live GPS delivery zone tracking.',
  alternates: {
    canonical: '/products',
  },
  openGraph: {
    title: `Product Catalog | ${siteConfig.name}`,
    description:
      'Browse our full collection of high-performance electronics, tech peripherals, and gear with instant checkout and live GPS delivery zone tracking.',
    url: '/products',
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: 'website',
    images: [
      {
        url: siteConfig.defaultOgImage,
        width: 1200,
        height: 630,
        alt: 'Experto Store Product Catalog',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Product Catalog | ${siteConfig.name}`,
    description:
      'Browse our full collection of high-performance electronics, tech peripherals, and gear with instant checkout and live GPS delivery zone tracking.',
    images: [siteConfig.defaultOgImage],
    creator: siteConfig.twitterHandle,
  },
};

export default function ProductsPage() {
  return <ProductsCatalogClient />;
}
