import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/products', '/products/*', '/nearby'],
        disallow: [
          '/cart',
          '/checkout',
          '/orders',
          '/orders/*',
          '/cancel',
          '/success',
          '/login',
          '/signup',
          '/offline',
          '/api/*',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
