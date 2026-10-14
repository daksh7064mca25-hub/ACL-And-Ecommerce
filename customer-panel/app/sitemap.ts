import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';
import { getPublicProducts } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const currentDate = new Date().toISOString();

  // Core static public pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/products`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/nearby`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  // Dynamic public product routes
  try {
    const productsRes = await getPublicProducts();
    if (productsRes && productsRes.success && Array.isArray(productsRes.products)) {
      const productRoutes: MetadataRoute.Sitemap = productsRes.products
        .filter((p) => Boolean(p && p._id))
        .map((product) => ({
          url: `${siteUrl}/products/${product._id}`,
          lastModified: product.updatedAt
            ? new Date(product.updatedAt).toISOString()
            : product.createdAt
            ? new Date(product.createdAt).toISOString()
            : currentDate,
          changeFrequency: 'weekly',
          priority: 0.8,
        }));

      return [...staticRoutes, ...productRoutes];
    }
  } catch (error) {
    // If backend is unreachable during sitemap generation, return static routes safely
    console.error('Failed to generate product sitemap entries:', error);
  }

  return staticRoutes;
}
