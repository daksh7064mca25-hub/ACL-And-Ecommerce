import { cache } from 'react';
import type { Metadata } from 'next';
import { getPublicProductById, ProductItem } from '@/lib/api';

/**
 * Experto Store SEO & Open Graph Configuration
 */
export const siteConfig = {
  name: 'Experto Store',
  legalName: 'Experto Visuals Store',
  shortName: 'Experto Store',
  description:
    'Shop high-performance tech, electronics, and peripherals with instant checkout, live GPS delivery zone tracking, and secure payment processing.',
  defaultTitle: 'Experto Store | Hyperlocal Express Tech & Gear',
  titleTemplate: '%s | Experto Store',
  defaultOgImage: '/og-image.jpg',
  ogImageAlt: 'Experto Store - Hyperlocal Express Tech & Gear Storefront',
  locale: 'en_US',
  currency: 'INR',
  twitterHandle: '@ExpertoStore',
  keywords: [
    'Experto Store',
    'Hyperlocal Delivery',
    'Express Electronics',
    'Computer Peripherals',
    'Gaming Gear',
    'Tech Store',
    'Same-Day Delivery',
    'Live Rider Tracking',
  ],
};

/**
 * Returns the verified site base URL without trailing slash.
 * Prioritizes user-configured NEXT_PUBLIC_SITE_URL, then Vercel URL, then localhost:3001.
 */
export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.replace(/\/+$/, '');
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL.replace(/\/+$/, '')}`;
  }
  return 'http://localhost:3001';
}

/**
 * Converts a relative path into a full absolute URL for canonicals and sitemaps.
 */
export function getAbsoluteUrl(path: string = ''): string {
  const baseUrl = getSiteUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Converts an image path (local public asset, remote URL, or backend upload)
 * into a full absolute URL suitable for Open Graph and Twitter Cards.
 */
export function getAbsoluteImageUrl(imagePath?: string | null): string {
  if (!imagePath || imagePath.trim() === '') {
    return getAbsoluteUrl(siteConfig.defaultOgImage);
  }
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  if (imagePath.startsWith('/uploads') || imagePath.startsWith('uploads/')) {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
    const cleanUploadPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${apiBase}${cleanUploadPath}`;
  }
  return getAbsoluteUrl(imagePath);
}

/**
 * Deduplicated, cached product lookup for Server Components and generateMetadata.
 * Ensures the backend is queried at most once per request cycle.
 */
export const getCachedProductById = cache(async (id: string): Promise<ProductItem | null> => {
  if (!id || typeof id !== 'string') return null;
  try {
    const res = await getPublicProductById(id);
    if (res && res.success && res.product) {
      return res.product;
    }
    return null;
  } catch {
    // Avoid crashing metadata generation when product is not found or backend has an issue
    return null;
  }
});

/**
 * Generates reusable noindex robots metadata for private/transactional views.
 */
export function getNoIndexMetadata(title: string, description?: string): Metadata {
  return {
    title,
    description: description || siteConfig.description,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}
